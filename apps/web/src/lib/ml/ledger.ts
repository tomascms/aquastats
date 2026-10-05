import { api } from "../api";
import { weekStartMonday } from "../dates";
import { hasClockTime } from "../swim-time";
import type { TrainingRep } from "../training-context";
import type { TimeLog } from "../types";
import { bootstrapMean, gaussianCrps } from "./backtest";
import { MODELS, type AppPrediction, type ModelId } from "./production";

/*
 * The prediction ledger, client side: record before the outcome exists, read back, reconcile with
 * the times entered later, and judge each model on what really happened.
 */

export type LedgerEntry = {
  id: string;
  athleteId: string;
  workoutId: string;
  blockId: string;
  repNumber: number;
  targetDate: string;
  model: string;
  modelVersion: string;
  role: "champion" | "challenger";
  horizon: string;
  meanS: number;
  loS: number | null;
  hiS: number | null;
  nominal: number | null;
  sdS: number | null;
  confidence: string | null;
  details: { factors?: { key: string; pct: number }[]; newKind?: boolean };
  predictedAt: string;
};

export type LedgerItem = Omit<LedgerEntry, "id" | "model" | "modelVersion" | "role" | "horizon" | "predictedAt">;

const BATCH = 500;

/** Predictions for planned reps (no time yet), ready to be recorded. */
export function ledgerItems(predictions: Map<string, AppPrediction>, planned: TrainingRep[]): LedgerItem[] {
  const items: LedgerItem[] = [];
  for (const row of planned) {
    const prediction = predictions.get(row.log.id);
    if (!prediction || !(prediction.mean > 0)) continue;
    const round = (value: number | undefined) => (value == null || !Number.isFinite(value) ? null : Math.round(value * 1000) / 1000);
    items.push({
      athleteId: row.log.athleteId,
      workoutId: row.workoutId,
      blockId: row.blockId,
      repNumber: row.log.repNumber,
      targetDate: row.date,
      meanS: round(prediction.mean)!,
      loS: round(prediction.lo),
      hiS: round(prediction.hi),
      nominal: prediction.nominal ?? null,
      sdS: round(prediction.sd),
      confidence: prediction.confidence ?? null,
      details: { factors: prediction.factors.map((factor) => ({ key: factor.key, pct: Math.round(factor.pct * 100) / 100 })), newKind: prediction.newKind },
    });
  }
  return items;
}

export async function recordPredictions(model: ModelId, role: LedgerEntry["role"], items: LedgerItem[]): Promise<number> {
  let recorded = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const out = await api<{ recorded: number }>("/api/v1/predictions", {
      method: "POST",
      body: JSON.stringify({ model: MODELS[model].id, modelVersion: MODELS[model].version, role, horizon: "day", items: items.slice(i, i + BATCH) }),
    });
    recorded += out.recorded;
  }
  return recorded;
}

/* ---------- Offline queue ---------- */

const QUEUE_KEY = "aq_ledger_queue";
/** Older than this, a queued prediction is dropped: by then its rep has almost surely been swum. */
const QUEUE_MAX_AGE_MS = 3 * 86_400_000;

type QueuedBatch = { model: ModelId; role: LedgerEntry["role"]; items: LedgerItem[]; queuedAt: number };

function readQueue(): QueuedBatch[] {
  try {
    const raw = globalThis.localStorage?.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedBatch[]) : [];
    return Array.isArray(parsed) ? parsed.filter((batch) => Date.now() - batch.queuedAt < QUEUE_MAX_AGE_MS) : [];
  } catch {
    return [];
  }
}

function writeQueue(batches: QueuedBatch[]) {
  try {
    if (batches.length) globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(batches));
    else globalThis.localStorage?.removeItem(QUEUE_KEY);
  } catch {
    // Storage full or blocked: the predictions are simply not recorded.
  }
}

const isNetworkError = (error: unknown) => (error as { status?: number })?.status === 0;

/**
 * Records predictions, or keeps them on this device until the connection is back. Safe to retry:
 * the API keeps the first prediction per rep and refuses any that arrive after the rep's time.
 */
export async function recordOrQueue(model: ModelId, role: LedgerEntry["role"], items: LedgerItem[]): Promise<void> {
  if (!items.length) return;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!offline) {
    try {
      await recordPredictions(model, role, items);
      return;
    } catch (error) {
      if (!isNetworkError(error)) return; // the server answered: nothing to retry
    }
  }
  writeQueue([...readQueue(), { model, role, items, queuedAt: Date.now() }]);
}

/** Sends what was queued while offline. Batches the server answered (even with refusals) leave the queue. */
export async function flushQueuedPredictions(): Promise<number> {
  const pending = readQueue();
  if (!pending.length) return 0;
  const left: QueuedBatch[] = [];
  let sent = 0;
  for (const batch of pending) {
    try {
      sent += await recordPredictions(batch.model, batch.role, batch.items);
    } catch (error) {
      if (isNetworkError(error)) left.push(batch);
    }
  }
  writeQueue(left);
  return sent;
}

export function fetchLedger(athleteId?: string): Promise<LedgerEntry[]> {
  return api<LedgerEntry[]>(`/api/v1/predictions${athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : ""}`);
}

/* ---------- Reconciliation ---------- */

export type Outcome = {
  /** Ledger entry id, or the log id for reconstructed predictions. */
  id: string;
  athleteId: string;
  model: string;
  date: string;
  repKey: string;
  meanS: number;
  loS: number | null;
  hiS: number | null;
  sdS: number | null;
  actualS: number;
  /** (predicted − real) / real, in %. */
  errorPct: number;
  inside: boolean | null;
  crpsPct: number | null;
  logId: string;
};

export const repKey = (workoutId: string, blockId: string, athleteId: string, repNumber: number) => `${workoutId}|${blockId}|${athleteId}|${repNumber}`;

function outcome(base: Omit<Outcome, "errorPct" | "inside" | "crpsPct">): Outcome {
  return {
    ...base,
    errorPct: ((base.meanS - base.actualS) / base.actualS) * 100,
    inside: base.loS != null && base.hiS != null ? base.actualS >= base.loS && base.actualS <= base.hiS : null,
    crpsPct: base.sdS ? (gaussianCrps(base.meanS, base.sdS, base.actualS) / base.actualS) * 100 : null,
  };
}

/** Pairs each recorded prediction with the time entered afterwards (a corrected time simply re-pairs). */
export function reconcile(entries: LedgerEntry[], timeLogs: TimeLog[]): Outcome[] {
  const logs = new Map<string, TimeLog>();
  for (const log of timeLogs) {
    if (log.skipped || !hasClockTime(log.mm, log.ss, log.cc)) continue;
    logs.set(repKey(log.workoutId, log.blockId, log.athleteId, log.repNumber), log);
  }
  const out: Outcome[] = [];
  for (const entry of entries) {
    const key = repKey(entry.workoutId, entry.blockId, entry.athleteId, entry.repNumber);
    const log = logs.get(key);
    if (!log) continue;
    out.push(
      outcome({
        id: entry.id,
        athleteId: entry.athleteId,
        model: entry.model,
        date: entry.targetDate,
        repKey: key,
        meanS: entry.meanS,
        loS: entry.loS,
        hiS: entry.hiS,
        sdS: entry.sdS,
        actualS: log.mm * 60 + log.ss + log.cc / 100,
        logId: log.id,
      }),
    );
  }
  return out;
}

/** What a model would have predicted, without seeing the future (day-ahead replay of the history). */
export function reconstructedOutcomes(predictions: Map<string, AppPrediction>, rows: TrainingRep[]): Outcome[] {
  const out: Outcome[] = [];
  for (const row of rows) {
    const prediction = predictions.get(row.log.id);
    if (!prediction || !Number.isFinite(row.timeS)) continue;
    out.push(
      outcome({
        id: row.log.id,
        athleteId: row.log.athleteId,
        model: prediction.model,
        date: row.date,
        repKey: repKey(row.workoutId, row.blockId, row.log.athleteId, row.log.repNumber),
        meanS: prediction.mean,
        loS: prediction.lo ?? null,
        hiS: prediction.hi ?? null,
        sdS: prediction.sd ?? null,
        actualS: row.timeS,
        logId: row.log.id,
      }),
    );
  }
  return out;
}

/* ---------- Track record ---------- */

export type WeekRecord = { week: string; n: number; mapePct: number; coverage: number | null };
export type TrackRecord = { n: number; mapePct: number; biasPct: number; coverage: number | null; crpsPct: number | null; weekly: WeekRecord[] };

const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN);

export function trackRecord(outcomes: Outcome[]): TrackRecord {
  const withInterval = outcomes.filter((item) => item.inside != null);
  const withCrps = outcomes.filter((item) => item.crpsPct != null);
  const byWeek = new Map<string, Outcome[]>();
  for (const item of outcomes) byWeek.set(weekStartMonday(item.date), [...(byWeek.get(weekStartMonday(item.date)) ?? []), item]);
  return {
    n: outcomes.length,
    mapePct: mean(outcomes.map((item) => Math.abs(item.errorPct))),
    biasPct: mean(outcomes.map((item) => item.errorPct)),
    coverage: withInterval.length ? withInterval.filter((item) => item.inside).length / withInterval.length : null,
    crpsPct: withCrps.length ? mean(withCrps.map((item) => item.crpsPct!)) : null,
    weekly: [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, list]) => {
        const intervals = list.filter((item) => item.inside != null);
        return {
          week,
          n: list.length,
          mapePct: mean(list.map((item) => Math.abs(item.errorPct))),
          coverage: intervals.length ? intervals.filter((item) => item.inside).length / intervals.length : null,
        };
      }),
  };
}

/* ---------- Health of the model the coach sees (monitoring; docs/ml/monitorizacao.md) ---------- */

export type HealthAlert =
  | { kind: "coverage"; coverage: number; nominal: number; n: number }
  | { kind: "bias"; biasPct: number; n: number }
  | { kind: "drift"; recentPct: number; beforePct: number };

/** Thresholds fixed before any real data (monitoring plan). */
export const HEALTH = { minReps: 50, recentWeeks: 4, baselineWeeks: 8, coverageGap: 0.12, biasPct: 1, biasZ: 3, driftPp: 0.5 } as const;

/**
 * What would justify reverting the shown model: over the last weeks with data, the interval misses
 * far more (or less) often than it says, the errors lean to one side, or the error grew against the
 * weeks before. Nothing is said with fewer than HEALTH.minReps checked reps.
 */
export function healthAlerts(outcomes: Outcome[], nominal: number): HealthAlert[] {
  const weeks = [...new Set(outcomes.map((item) => weekStartMonday(item.date)))].sort();
  const recentWeeks = new Set(weeks.slice(-HEALTH.recentWeeks));
  const baselineWeeks = new Set(weeks.slice(-HEALTH.recentWeeks - HEALTH.baselineWeeks, -HEALTH.recentWeeks));
  const recent = outcomes.filter((item) => recentWeeks.has(weekStartMonday(item.date)));
  if (recent.length < HEALTH.minReps) return [];
  const alerts: HealthAlert[] = [];
  const intervals = recent.filter((item) => item.inside != null);
  if (intervals.length >= HEALTH.minReps) {
    const coverage = intervals.filter((item) => item.inside).length / intervals.length;
    if (Math.abs(coverage - nominal) > HEALTH.coverageGap) alerts.push({ kind: "coverage", coverage, nominal, n: intervals.length });
  }
  const errors = recent.map((item) => item.errorPct);
  const bias = mean(errors);
  const sd = Math.sqrt(errors.reduce((sum, value) => sum + (value - bias) ** 2, 0) / Math.max(1, errors.length - 1));
  if (Math.abs(bias) > HEALTH.biasPct && Math.abs(bias) / (sd / Math.sqrt(errors.length)) > HEALTH.biasZ) alerts.push({ kind: "bias", biasPct: bias, n: errors.length });
  const before = outcomes.filter((item) => baselineWeeks.has(weekStartMonday(item.date)));
  if (before.length >= HEALTH.minReps) {
    const recentPct = mean(recent.map((item) => Math.abs(item.errorPct)));
    const beforePct = mean(before.map((item) => Math.abs(item.errorPct)));
    if (recentPct - beforePct > HEALTH.driftPp) alerts.push({ kind: "drift", recentPct, beforePct });
  }
  return alerts;
}

/* ---------- Champion / challenger on real data ---------- */

export type Promotion = {
  paired: number;
  weeks: number;
  champion: { mapePct: number; crpsPct: number | null; coverage: number | null };
  challenger: { mapePct: number; crpsPct: number | null; coverage: number | null };
  dMape: { mean: number; lo: number; hi: number };
  ready: boolean;
  /** What is still missing before the challenger may replace the champion. */
  missing: ("reps" | "weeks" | "mape" | "crps" | "coverage")[];
};

export const PROMOTION_MIN_REPS = 200;
export const PROMOTION_MIN_WEEKS = 6;

/**
 * The challenger replaces the champion only when, on the same real reps: enough evidence (≥ 200 reps
 * over ≥ 6 weeks), lower MAPE with the 95 % interval (bootstrap over weeks) below zero, CRPS not
 * worse, and coverage no further from its nominal level.
 */
export function promotionReport(outcomes: Outcome[], champion: ModelId, challenger: ModelId): Promotion {
  const a = new Map(outcomes.filter((item) => item.model === MODELS[champion].id).map((item) => [item.repKey, item]));
  const pairs = outcomes.filter((item) => item.model === MODELS[challenger].id && a.has(item.repKey)).map((item) => ({ a: a.get(item.repKey)!, b: item }));
  const byWeek = new Map<string, number[]>();
  for (const pair of pairs) byWeek.set(weekStartMonday(pair.b.date), [...(byWeek.get(weekStartMonday(pair.b.date)) ?? []), Math.abs(pair.b.errorPct) - Math.abs(pair.a.errorPct)]);
  const weekly = [...byWeek.values()].map((list) => mean(list));
  const dMape = bootstrapMean(weekly, 4000, 99);
  const summary = (list: Outcome[]) => {
    const record = trackRecord(list);
    return { mapePct: record.mapePct, crpsPct: record.crpsPct, coverage: record.coverage };
  };
  const champ = summary(pairs.map((pair) => pair.a));
  const chall = summary(pairs.map((pair) => pair.b));
  const missing: Promotion["missing"] = [];
  if (pairs.length < PROMOTION_MIN_REPS) missing.push("reps");
  if (byWeek.size < PROMOTION_MIN_WEEKS) missing.push("weeks");
  if (!(dMape.hi < 0)) missing.push("mape");
  if (champ.crpsPct != null && chall.crpsPct != null && chall.crpsPct > champ.crpsPct) missing.push("crps");
  if (chall.coverage != null && champ.coverage != null && Math.abs(chall.coverage - MODELS[challenger].nominal) > Math.abs(champ.coverage - MODELS[champion].nominal) + 0.01) missing.push("coverage");
  return { paired: pairs.length, weeks: byWeek.size, champion: champ, challenger: chall, dMape, ready: missing.length === 0, missing };
}

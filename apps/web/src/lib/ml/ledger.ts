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

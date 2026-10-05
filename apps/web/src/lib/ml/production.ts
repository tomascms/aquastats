import { tx } from "@/i18n";
import { annotateTrainingReps, isPlausibleRep, type TrainingRep } from "../training-context";
import { predictTrainingTargets, type TrainingTarget } from "../training-prediction";
import { flattenInner, needsClockTime } from "../set";
import { hasClockTime } from "../swim-time";
import type { Athlete, Stroke, TimeLog, Workout } from "../types";
import { dayNumber, entryLoad, HORIZONS, isPlanned, plannedSets, Z80, type AthleteInfo, type Prediction, type TeamData } from "./backtest";
import { calibrated } from "./calibration";
import { runStateModel, type TeamForecast } from "./forecaster";
import type { AthleteFilter } from "./state-model";
import { teamSuspects, type Suspect } from "./quality";
import { DEFAULT_OPTIONS, type ForecastTerms } from "./state-model";

/*
 * What the app runs. Two models side by side:
 *   - "atual": the production model of training-prediction.ts (unchanged);
 *   - "estado": the state-space model with data-quality filtering and conformal intervals, the
 *     winner of the synthetic backtest (docs/ml/README.md).
 * One is the champion — its estimates are the ones the coach sees — and the other runs in shadow:
 * its predictions are recorded in the ledger but never shown. The champion is chosen at build time
 * (NEXT_PUBLIC_ML_CHAMPION=estado); the switch should only happen when the challenger also wins on
 * the real predictions reconciled in the ledger (ledger.ts → promotionReport).
 */

export const MODELS = {
  /** Band = ±1 residual SD: about 68 % nominal. */
  atual: { id: "atual", version: "1", label: "Modelo atual", nominal: 0.6826894921370859 },
  estado: { id: "estado", version: "2.0", label: "Modelo de estado", nominal: 0.8 },
} as const;
export type ModelId = keyof typeof MODELS;

export const CHAMPION: ModelId = process.env.NEXT_PUBLIC_ML_CHAMPION === "estado" ? "estado" : "atual";
export const CHALLENGER: ModelId = CHAMPION === "atual" ? "estado" : "atual";

export type Factor = { key: "new" | "form" | "return" | "day" | "set"; pct: number };

export type AppPrediction = Prediction & {
  model: ModelId;
  /** The 2–3 things that move this estimate most, largest first. */
  factors: Factor[];
  /** A kind of rep the athlete has never swum (timed): the estimate comes from teammates and physiology. */
  newKind: boolean;
};

const PLAN_PREFIX = "plan:";
export const planLogId = (workoutId: string, blockId: string, athleteId: string, repNumber: number) => `${PLAN_PREFIX}${workoutId}:${blockId}:${athleteId}:${repNumber}`;
export const isPlanLogId = (id: string) => id.startsWith(PLAN_PREFIX);

const STROKES: Stroke[] = ["free", "back", "breast", "fly", "im"];

/** Placeholder logs for the reps of `workout` that still have no time (only reps that take a time). */
function plannedLogs(workout: Workout, athleteId: string, timeLogs: TimeLog[]): TimeLog[] {
  const done = new Set(
    timeLogs
      .filter((log) => log.workoutId === workout.id && log.athleteId === athleteId && (log.skipped || hasClockTime(log.mm, log.ss, log.cc)))
      .map((log) => `${log.blockId}:${log.repNumber}`),
  );
  const out: TimeLog[] = [];
  for (const block of workout.blocks) {
    if (block.type !== "main") continue;
    const rounds = Math.max(1, block.rounds || 1);
    const innerN = flattenInner(block).length;
    for (let round = 1; round <= rounds; round += 1) {
      for (const inner of flattenInner(block, round)) {
        if (!needsClockTime(inner.intensity, block.type) || inner.stroke === "sub") continue;
        const repNumber = (round - 1) * innerN + inner.index + 1;
        if (done.has(`${block.id}:${repNumber}`)) continue;
        out.push({
          id: planLogId(workout.id, block.id, athleteId, repNumber),
          workoutId: workout.id,
          blockId: block.id,
          athleteId,
          repNumber,
          // Placeholder only so the rep is annotated; its time is replaced by NaN right after.
          mm: 1,
          ss: 0,
          cc: 0,
          splits: [],
          stroke: STROKES.includes(inner.stroke as Stroke) ? (inner.stroke as Stroke) : "free",
          pending: false,
          recordedAt: "",
        });
      }
    }
  }
  return out;
}

export type AppTeam = { team: TeamData; planned: TrainingRep[] };

/**
 * The team as the models see it: every athlete's annotated reps (the models learn from the whole
 * team) plus, for `plan`, the reps still to be swum, as planned rows (time NaN).
 */
export function appTeam(athletes: Athlete[], workouts: Workout[], timeLogs: TimeLog[], plan: Workout[] = []): AppTeam {
  const rows = new Map<string, TrainingRep[]>();
  const infos = new Map<string, AthleteInfo>();
  const load = new Map<string, ReturnType<typeof entryLoad>>();
  const planned: TrainingRep[] = [];
  let first = Number.POSITIVE_INFINITY;
  for (const athlete of athletes) {
    if (athlete.active === false) continue;
    const stubs = plan.filter((workout) => workout.athleteIds.includes(athlete.id)).flatMap((workout) => plannedLogs(workout, athlete.id, timeLogs));
    const list = annotateTrainingReps(workouts, stubs.length ? [...timeLogs, ...stubs] : timeLogs, athlete.id, athlete.wellness ?? [], athlete.groupName ?? "").map((row) =>
      isPlanLogId(row.log.id) ? { ...row, timeS: Number.NaN } : row,
    );
    infos.set(athlete.id, { id: athlete.id, group: athlete.groupName ?? "", wellness: athlete.wellness ?? [], dateOfBirth: athlete.dateOfBirth, gender: athlete.gender ?? "", primaryStroke: athlete.primaryStroke });
    load.set(athlete.id, entryLoad(workouts, athlete.id));
    if (!list.length) continue;
    rows.set(athlete.id, list);
    planned.push(...list.filter(isPlanned));
    const firstObserved = list.find((row) => !isPlanned(row));
    if (firstObserved) first = Math.min(first, dayNumber(firstObserved.date));
  }
  return { team: { rows, athletes: infos, load, anchorDay: Number.isFinite(first) ? first - 1 : 0, planned: plannedSets(workouts) }, planned };
}

/* ---------- The two models ---------- */

const FACTOR_FLOOR = 0.002;
const pct = (logValue: number) => (Math.exp(logValue) - 1) * 100;

function factorsOf(forecast: TeamForecast): Factor[] {
  const terms: ForecastTerms = forecast.terms;
  const out: Factor[] = [];
  if (forecast.newFactors > 0) out.push({ key: "new", pct: 0 });
  const candidates: Factor[] = [
    { key: "form", pct: pct(forecast.formDelta) },
    { key: "return", pct: pct(terms.returnDeficit) },
    { key: "day", pct: pct(terms.day) },
    { key: "set", pct: pct(terms.set) },
  ];
  out.push(...candidates.filter((factor) => Math.abs(factor.pct) >= FACTOR_FLOOR * 100).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)));
  return out.slice(0, 3);
}

/** Champion-quality state model: suspect times are not learned from, intervals are calibrated on real past errors. */
export function statePredictions(team: TeamData): Map<string, AppPrediction> {
  const suspects = teamSuspects(team.rows);
  const raw = runStateModel(team, HORIZONS.day, DEFAULT_OPTIONS, new Set(suspects.keys()));
  const base = {
    name: "estado",
    description: "",
    predict: () => {
      const out = new Map<string, Prediction>();
      for (const [id, forecast] of raw) {
        out.set(id, { mean: forecast.meanS, sd: forecast.meanS * forecast.logSd, lo: Math.exp(forecast.logMean - Z80 * forecast.logSd), hi: Math.exp(forecast.logMean + Z80 * forecast.logSd), nominal: 0.8 });
      }
      return out;
    },
  };
  const calibratedOut = calibrated(base, "estado", { scale: "model" }).predict(team, HORIZONS.day);
  const out = new Map<string, AppPrediction>();
  for (const [id, prediction] of calibratedOut) {
    const forecast = raw.get(id)!;
    out.set(id, { ...prediction, model: "estado", factors: factorsOf(forecast), newKind: forecast.newFactors > 0 });
  }
  return out;
}

/** The production model, per athlete and pool as the dashboard runs it; planned reps get a placeholder time it never uses. */
export function legacyPredictions(team: TeamData): Map<string, AppPrediction> {
  const out = new Map<string, AppPrediction>();
  for (const rows of team.rows.values()) {
    const byCourse = new Map<string, TrainingRep[]>();
    for (const row of rows) {
      // A planned rep's own time is never used for its own estimate (only earlier dates are), so any plausible placeholder works.
      const usable = isPlanned(row) ? { ...row, timeS: row.distanceM } : row;
      byCourse.set(row.course || "", [...(byCourse.get(row.course || "") ?? []), usable]);
    }
    for (const list of byCourse.values()) {
      for (const [id, target] of predictTrainingTargets(list)) {
        out.set(id, {
          mean: target.targetS,
          lo: target.lowS,
          hi: target.highS,
          nominal: 0.6826894921370859,
          sd: (target.highS - target.lowS) / 2,
          confidence: target.confidence,
          model: "atual",
          factors: [],
          newKind: false,
        });
      }
    }
  }
  return out;
}

/** The state model's estimates in the shape the training dashboard draws (when it is the champion). */
export function asTrainingTargets(predictions: Map<string, AppPrediction>): Map<string, TrainingTarget> {
  const out = new Map<string, TrainingTarget>();
  for (const [id, prediction] of predictions) {
    out.set(id, {
      targetS: prediction.mean,
      lowS: prediction.lo ?? prediction.mean,
      highS: prediction.hi ?? prediction.mean,
      levelS: prediction.mean,
      confidence: prediction.confidence === "alta" || prediction.confidence === "média" ? prediction.confidence : "baixa",
      groupN: 0,
      trainN: 0,
      basis: tx("Modelo de estado: histórico do atleta e da equipa"),
    });
  }
  return out;
}

export function predictionsFor(model: ModelId, team: TeamData): Map<string, AppPrediction> {
  return model === "estado" ? statePredictions(team) : legacyPredictions(team);
}

/* ---------- Data quality and honesty about what the model knows ---------- */

export function suspectTimes(team: TeamData): Map<string, Suspect> {
  return teamSuspects(team.rows);
}

export type LearningStatus = {
  /** Weeks between the athlete's first and latest timed rep. */
  weeks: number;
  reps: number;
  /** Under ~8 weeks of timed reps the estimates are still settling (backtest error curve, docs/ml/README.md). */
  learning: boolean;
};

/** Backtest: error ~1.9 % in weeks 2–3, ~1.55 % in weeks 8–15, ~1.25 % after 4 months. */
export const WEEKS_TO_SETTLE = 8;

export function learningStatus(rows: TrainingRep[]): LearningStatus {
  const timed = rows.filter((row) => !isPlanned(row) && isPlausibleRep(row));
  if (!timed.length) return { weeks: 0, reps: 0, learning: true };
  const weeks = (dayNumber(timed[timed.length - 1].date) - dayNumber(timed[0].date)) / 7;
  return { weeks, reps: timed.length, learning: weeks < WEEKS_TO_SETTLE || timed.length < 60 };
}

/* ---------- Active learning: which set to time ---------- */

export type TimingSuggestion = {
  athleteId: string;
  workoutId: string;
  blockId: string;
  /** Planned reps of that set for that athlete. */
  reps: number;
  /** Typical relative uncertainty (±%, one SD) the model has for this set before timing it. */
  uncertaintyPct: number;
  /** A kind of set the athlete has never been timed in. */
  newKind: boolean;
  score: number;
};

/** Where timing helps the model most: what it does not know yet (state variance, not rep-to-rep noise), times how many reps. */
export function setScore(forecasts: { logSd: number; newFactors: number }[], noiseSd: number): number {
  return forecasts.reduce((sum, item) => sum + Math.max(0, item.logSd ** 2 - noiseSd ** 2) + (item.newFactors > 0 ? noiseSd ** 2 : 0), 0);
}

export const setOf = (row: TrainingRep) => `${row.log.athleteId}|${row.workoutId}|${row.blockId}|${row.segmentIndex}|${row.round}`;

/** Ranks the planned sets of a session by how much timing them would teach the model. */
export function timingSuggestions(team: TeamData, planned: TrainingRep[]): TimingSuggestion[] {
  const raw = runStateModel(team, HORIZONS.day, DEFAULT_OPTIONS, new Set(teamSuspects(team.rows).keys()));
  const sets = new Map<string, TrainingRep[]>();
  for (const row of planned) sets.set(setOf(row), [...(sets.get(setOf(row)) ?? []), row]);
  const noise = DEFAULT_OPTIONS.repSdRel;
  const out: TimingSuggestion[] = [];
  for (const rows of sets.values()) {
    const forecasts = rows.map((row) => raw.get(row.log.id)).filter((item): item is TeamForecast => Boolean(item));
    if (!forecasts.length) continue;
    out.push({
      athleteId: rows[0].log.athleteId,
      workoutId: rows[0].workoutId,
      blockId: rows[0].blockId,
      reps: rows.length,
      uncertaintyPct: (forecasts.reduce((sum, item) => sum + item.logSd, 0) / forecasts.length) * 100,
      newKind: forecasts.some((item) => item.newFactors > 0),
      score: setScore(forecasts, noise),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Selection policy for the backtest: learn only from the set with the highest score per session. */
export function uncertaintyPolicy(filter: AthleteFilter, today: TrainingRep[], prior: (j: number) => [number, number]): Set<string> {
  const bySession = new Map<string, Map<string, TrainingRep[]>>();
  for (const row of today) {
    const session = bySession.get(row.workoutId) ?? new Map<string, TrainingRep[]>();
    session.set(setOf(row), [...(session.get(setOf(row)) ?? []), row]);
    bySession.set(row.workoutId, session);
  }
  const chosen = new Set<string>();
  for (const sets of bySession.values()) {
    let best: TrainingRep[] | null = null;
    let bestScore = -1;
    for (const rows of sets.values()) {
      const probe = filter.clone();
      const score = setScore(rows.map((row) => probe.forecast(row, prior)), DEFAULT_OPTIONS.repSdRel);
      if (score > bestScore) {
        bestScore = score;
        best = rows;
      }
    }
    for (const row of best ?? []) chosen.add(row.log.id);
  }
  return chosen;
}

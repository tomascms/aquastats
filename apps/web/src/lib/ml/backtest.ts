import { workoutBands } from "../season";
import { annotateTrainingReps, isPlausibleRep, type TrainingRep } from "../training-context";
import { groupKey } from "../training-prediction";
import type { TimeLog, WellnessEntry, Workout } from "../types";
import { createRng } from "./rng";

/*
 * Chronological backtest ("predict each rep using only the past"), harness v2.
 *
 * Horizons (docs/ml/protocolo.md §3):
 *   rep  — everything before the rep: earlier days, plus earlier reps of the same athlete that day;
 *   day  — dates before the rep's date (the main horizon);
 *   lead — forecasts from a fixed grid of origins every 7 days, for reps 1–7 (semana), 22–28 (mês)
 *          or 358–364 (ano) days ahead. When the plan is not known yet (≥ 22 days), the rep's
 *          plan-derived load fields and the entered load after the origin may not be used.
 * Every predictor promises this; `checkCausality` verifies it by perturbing the future.
 *
 * Real and synthetic data are never mixed: a Dataset is one or the other (`kind`).
 */

export type AthleteInfo = {
  id: string;
  group: string;
  wellness: WellnessEntry[];
  dateOfBirth?: string;
  gender?: string;
};

export type TruthRecord = {
  expectedS: number;
  dayAheadS: number;
  swumS: number;
  error: string | null;
  /** Generator v3: "should do" (current form, reference conditions) and "will do" without shocks. */
  capacityS?: number;
  systematicS?: number;
  cliff?: boolean;
};

export type Dataset = {
  kind: "synthetic" | "real";
  label: string;
  athletes: AthleteInfo[];
  workouts: Workout[];
  timeLogs: TimeLog[];
  /** Synthetic only: what actually generated each logged time. */
  truth?: Map<string, TruthRecord>;
  /** Synthetic only: which athletes depart from the group on purpose. */
  athleteTypes?: Map<string, "típico" | "atípico">;
};

/** "Should do": what current form allows for this kind of rep in reference conditions. */
export type CapacityPrediction = { mean: number; lo?: number; hi?: number; sd?: number };

export type Prediction = {
  /** "Will do": the time expected in the real, planned conditions. */
  mean: number;
  capacity?: CapacityPrediction;
  /** Probability that the set has broken (a rep fell off the curve) by this rep, inclusive. */
  pBreakBy?: number;
  /** Central predictive interval and its nominal coverage (e.g. 0.8). Omitted = point forecast only. */
  lo?: number;
  hi?: number;
  nominal?: number;
  /** Predictive standard deviation in seconds (for CRPS and intervals at a common level). */
  sd?: number;
  confidence?: string;
};

/** Training the coach entered for an athlete on one date (sessions never entered are simply absent). */
export type DayLoad = { meters: number; load: number; sessions: number };

export type TeamData = {
  /** Every annotated rep per athlete, plausible or not, in the order they were swum. */
  rows: Map<string, TrainingRep[]>;
  athletes: Map<string, AthleteInfo>;
  load: Map<string, Map<string, DayLoad>>;
  /** Day number of the day before the first rep: anchors the grid of forecast origins. */
  anchorDay: number;
  /** Reps planned per set, by `${workoutId}|${blockId}|${segmentIndex}` (a missing tail can then be told apart). */
  planned?: Map<string, number>;
};

export const plannedKey = (workoutId: string, blockId: string, segmentIndex: number) => `${workoutId}|${blockId}|${segmentIndex}`;

/** Planned reps of every set of these workouts (the site's own set structure). */
export function plannedSets(workouts: Workout[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const workout of workouts) {
    for (const block of workout.blocks) {
      block.segments
        .filter((segment) => segment.reps >= 1 && segment.distanceM > 0)
        .forEach((segment, index) => out.set(plannedKey(workout.id, block.id, index), segment.reps));
    }
  }
  return out;
}

export type LeadHorizon = { kind: "lead"; name: string; minLead: number; maxLead: number; planKnown: boolean };
export type Horizon = { kind: "rep"; name: string } | { kind: "day"; name: string } | LeadHorizon;

export const HORIZONS = {
  rep: { kind: "rep", name: "próxima rep" },
  day: { kind: "day", name: "dia" },
  semana: { kind: "lead", name: "semana", minLead: 1, maxLead: 7, planKnown: true },
  mes: { kind: "lead", name: "mês", minLead: 22, maxLead: 28, planKnown: false },
  ano: { kind: "lead", name: "ano", minLead: 358, maxLead: 364, planKnown: false },
} satisfies Record<string, Horizon>;

export type Predictor = {
  name: string;
  description: string;
  predict(team: TeamData, horizon: Horizon): Map<string, Prediction>;
};

const DAY_MS = 86_400_000;
export const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
export const isoDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** The forecast origin (a day number) of a rep swum on `date` for a lead horizon. */
export function originOf(date: string, horizon: LeadHorizon, anchorDay: number): number {
  const target = dayNumber(date);
  const span = horizon.maxLead - horizon.minLead + 1;
  const offset = (((target - horizon.minLead - anchorDay) % span) + span) % span;
  return target - horizon.minLead - offset;
}

/** Last day whose data may be used for this rep under this horizon (rep/day: the day before). */
export function lastUsableDay(row: TrainingRep, horizon: Horizon, anchorDay: number): number {
  return horizon.kind === "lead" ? originOf(row.date, horizon, anchorDay) : dayNumber(row.date) - 1;
}

/** A rep that is planned but has no time yet (its time is NaN): forecast it, never learn from it. */
export const isPlanned = (row: TrainingRep) => Number.isNaN(row.timeS);

/** Training entered per date for one athlete: metres and intensity-weighted load of the workouts they were in. */
export function entryLoad(workouts: Workout[], athleteId: string): Map<string, DayLoad> {
  const days = new Map<string, DayLoad>();
  for (const workout of workouts) {
    if (!workout.athleteIds.includes(athleteId)) continue;
    const split = workoutBands(workout);
    const meters = Object.values(split.bands).reduce((sum, value) => sum + value, 0);
    const day = days.get(workout.date) ?? { meters: 0, load: 0, sessions: 0 };
    day.meters += meters;
    day.load += split.load;
    day.sessions += 1;
    days.set(workout.date, day);
  }
  return days;
}

export function teamData(dataset: Dataset): TeamData {
  const rows = new Map<string, TrainingRep[]>();
  const athletes = new Map<string, AthleteInfo>();
  const load = new Map<string, Map<string, DayLoad>>();
  let first = Number.POSITIVE_INFINITY;
  for (const athlete of dataset.athletes) {
    athletes.set(athlete.id, athlete);
    const list = annotateTrainingReps(dataset.workouts, dataset.timeLogs, athlete.id, athlete.wellness, athlete.group);
    if (list.length) {
      rows.set(athlete.id, list);
      first = Math.min(first, dayNumber(list[0].date));
    }
    load.set(athlete.id, entryLoad(dataset.workouts, athlete.id));
  }
  return { rows, athletes, load, anchorDay: Number.isFinite(first) ? first - 1 : 0, planned: plannedSets(dataset.workouts) };
}

/* ---------- Metrics ---------- */

export type Metrics = {
  eligible: number;
  n: number;
  predictedShare: number;
  maeS: number;
  mapePct: number;
  medianApePct: number;
  rmsePct: number;
  /** Mean signed error in % (positive = predicted slower than swum). */
  biasPct: number;
  intervalN: number;
  nominal: number | null;
  coverage: number | null;
  widthPct: number | null;
  /** Winkler interval score at the model's own nominal level, % of the time (lower is better). */
  intervalScorePct: number | null;
  /** Coverage of mean ± 1.2816·sd: every model's interval re-expressed at 80 %. */
  coverage80: number | null;
  /** Gaussian CRPS in % of the time (lower is better). */
  crpsPct: number | null;
};

export type Pair = { row: TrainingRep; prediction: Prediction | undefined; actual: number };

export const Z80 = 1.2815515655446004;

/** CRPS of a normal N(mu, sd) at y (Gneiting & Raftery 2007). */
export function gaussianCrps(mu: number, sd: number, y: number): number {
  if (!(sd > 0)) return Math.abs(y - mu);
  const z = (y - mu) / sd;
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const cdf = 0.5 * (1 + erf(z / Math.SQRT2));
  return sd * (z * (2 * cdf - 1) + 2 * pdf - 1 / Math.sqrt(Math.PI));
}

/** Abramowitz–Stegun 7.1.26 (|error| < 1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN);
const medianOf = (values: number[]) => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function metricsOf(pairs: Pair[]): Metrics {
  const hit = pairs.filter((pair): pair is Pair & { prediction: Prediction } => Boolean(pair.prediction));
  const ape = hit.map((pair) => Math.abs(pair.prediction.mean - pair.actual) / pair.actual);
  const withInterval = hit.filter((pair) => pair.prediction.lo != null && pair.prediction.hi != null && pair.prediction.nominal != null);
  const withSd = hit.filter((pair) => pair.prediction.sd != null && pair.prediction.sd > 0);
  const nominals = [...new Set(withInterval.map((pair) => pair.prediction.nominal!))];
  return {
    eligible: pairs.length,
    n: hit.length,
    predictedShare: pairs.length ? hit.length / pairs.length : NaN,
    maeS: avg(hit.map((pair) => Math.abs(pair.prediction.mean - pair.actual))),
    mapePct: avg(ape) * 100,
    medianApePct: medianOf(ape) * 100,
    rmsePct: Math.sqrt(avg(hit.map((pair) => ((pair.prediction.mean - pair.actual) / pair.actual) ** 2))) * 100,
    biasPct: avg(hit.map((pair) => (pair.prediction.mean - pair.actual) / pair.actual)) * 100,
    intervalN: withInterval.length,
    nominal: nominals.length === 1 ? nominals[0] : withInterval.length ? avg(withInterval.map((pair) => pair.prediction.nominal!)) : null,
    coverage: withInterval.length
      ? withInterval.filter((pair) => pair.actual >= pair.prediction.lo! && pair.actual <= pair.prediction.hi!).length / withInterval.length
      : null,
    widthPct: withInterval.length ? avg(withInterval.map((pair) => (pair.prediction.hi! - pair.prediction.lo!) / pair.actual)) * 100 : null,
    intervalScorePct: withInterval.length
      ? avg(
          withInterval.map(({ prediction: p, actual: y }) => {
            const alpha = 1 - p.nominal!;
            const score = p.hi! - p.lo! + (2 / alpha) * Math.max(0, p.lo! - y) + (2 / alpha) * Math.max(0, y - p.hi!);
            return score / y;
          }),
        ) * 100
      : null,
    coverage80: withSd.length
      ? withSd.filter((pair) => Math.abs(pair.actual - pair.prediction.mean) <= Z80 * pair.prediction.sd!).length / withSd.length
      : null,
    crpsPct: withSd.length ? avg(withSd.map((pair) => gaussianCrps(pair.prediction.mean, pair.prediction.sd!, pair.actual) / pair.actual)) * 100 : null,
  };
}

/* ---------- Evaluation rows and slices ---------- */

export const HISTORY_BUCKETS = ["0", "1", "2–3", "4–7", "8–15", "16–31", "32+"] as const;
export const WEEK_BUCKETS = ["sem 0–1", "sem 2–3", "sem 4–7", "sem 8–15", "sem 16–51", "ano 2", "ano 3+"] as const;

export function historyBucket(n: number): (typeof HISTORY_BUCKETS)[number] {
  if (n === 0) return "0";
  if (n === 1) return "1";
  if (n <= 3) return "2–3";
  if (n <= 7) return "4–7";
  if (n <= 15) return "8–15";
  if (n <= 31) return "16–31";
  return "32+";
}

export function weekBucket(weeks: number): (typeof WEEK_BUCKETS)[number] {
  if (weeks < 2) return "sem 0–1";
  if (weeks < 4) return "sem 2–3";
  if (weeks < 8) return "sem 4–7";
  if (weeks < 16) return "sem 8–15";
  if (weeks < 52) return "sem 16–51";
  if (weeks < 104) return "ano 2";
  return "ano 3+";
}

export type EvalRow = {
  row: TrainingRep;
  athleteId: string;
  /** Earlier reps (dates before) of the same athlete and group: pool, distance, stroke, intensity, gear. */
  groupHistory: number;
  weeksOfHistory: number;
  clean: boolean;
};

/** Every plausible rep (what the coach sees in the app), with the history it had when it was swum. */
export function evaluationRows(team: TeamData, dataset: Dataset): EvalRow[] {
  const out: EvalRow[] = [];
  for (const [athleteId, rows] of team.rows) {
    const valid = rows.filter(isPlausibleRep);
    if (!valid.length) continue;
    const first = dayNumber(valid[0].date);
    const counts = new Map<string, number>();
    let pending: TrainingRep[] = [];
    let currentDate = "";
    const flush = () => {
      for (const row of pending) counts.set(groupKey(row), (counts.get(groupKey(row)) ?? 0) + 1);
      pending = [];
    };
    for (const row of valid) {
      if (row.date !== currentDate) {
        flush();
        currentDate = row.date;
      }
      out.push({
        row,
        athleteId,
        groupHistory: counts.get(groupKey(row)) ?? 0,
        weeksOfHistory: (dayNumber(row.date) - first) / 7,
        clean: dataset.truth ? dataset.truth.get(row.log.id)?.error == null : true,
      });
      pending.push(row);
    }
  }
  return out;
}

export type BacktestReport = {
  predictor: string;
  dataset: string;
  kind: Dataset["kind"];
  horizon: string;
  /** On clean reps (synthetic: without a typing error; real: all plausible reps). */
  overall: Metrics;
  /** On every plausible rep, typing errors included. */
  overallAll: Metrics;
  byHistory: Record<string, Metrics>;
  byWeeks: Record<string, Metrics>;
  byAthlete: Record<string, Metrics>;
  byIntensity: Record<string, Metrics>;
  byConfidence: Record<string, Metrics>;
  byType: Record<string, Metrics>;
  capacity: CapacityMetrics | null;
  breaks: BreakMetrics | null;
  runtimeMs: number;
};

function sliceBy<T extends { pair: Pair }>(items: T[], keyOf: (item: T) => string, order?: readonly string[]): Record<string, Metrics> {
  const groups = new Map<string, Pair[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = groups.get(key) ?? [];
    list.push(item.pair);
    groups.set(key, list);
  }
  const keys = order ? order.filter((key) => groups.has(key)) : [...groups.keys()].sort();
  return Object.fromEntries(keys.map((key) => [key, metricsOf(groups.get(key)!)]));
}

export type Scored = { item: EvalRow; pair: Pair };

/** Every evaluation rep with its prediction (missing when the model abstained). */
export function scorePredictions(predictions: Map<string, Prediction>, evalRows: EvalRow[]): Scored[] {
  return evalRows.map((item) => ({ item, pair: { row: item.row, prediction: predictions.get(item.row.log.id), actual: item.row.timeS } }));
}

export function reportOf(name: string, dataset: Dataset, horizon: Horizon, scored: Scored[], runtimeMs: number, extras: { breaks?: BreakMetrics | null } = {}): BacktestReport {
  const clean = scored.filter(({ item }) => item.clean);
  return {
    predictor: name,
    dataset: dataset.label,
    kind: dataset.kind,
    horizon: horizon.name,
    overall: metricsOf(clean.map(({ pair }) => pair)),
    overallAll: metricsOf(scored.map(({ pair }) => pair)),
    byHistory: sliceBy(clean, ({ item }) => historyBucket(item.groupHistory), HISTORY_BUCKETS),
    byWeeks: sliceBy(clean, ({ item }) => weekBucket(item.weeksOfHistory), WEEK_BUCKETS),
    byAthlete: sliceBy(clean, ({ item }) => item.athleteId),
    byIntensity: sliceBy(clean, ({ pair }) => pair.row.intensity),
    byConfidence: sliceBy(
      clean.filter(({ pair }) => pair.prediction?.confidence),
      ({ pair }) => pair.prediction!.confidence!,
    ),
    byType: dataset.athleteTypes ? sliceBy(clean, ({ item }) => dataset.athleteTypes!.get(item.athleteId) ?? "típico") : {},
    capacity: capacityMetrics(scored, dataset),
    breaks: extras.breaks ?? null,
    runtimeMs,
  };
}

export function runBacktest(predictor: Predictor, dataset: Dataset, horizon: Horizon = HORIZONS.day, team = teamData(dataset), evalRows = evaluationRows(team, dataset)): { report: BacktestReport; scored: Scored[] } {
  const started = performance.now();
  const predictions = predictor.predict(team, horizon);
  const runtimeMs = performance.now() - started;
  const scored = scorePredictions(predictions, evalRows);
  // Breaks are scored on clean sets only (a typing error is not a break).
  const typos = new Set(dataset.truth ? [...dataset.truth.entries()].filter(([, truth]) => truth.error).map(([id]) => id) : []);
  const breaks = breakMetrics(predictions, observedSets(team, typos));
  return { report: reportOf(predictor.name, dataset, horizon, scored, runtimeMs, { breaks }), scored };
}

/** Synthetic only: error of the best possible day-ahead estimate and of the within-day truth, on clean reps. */
export function oracleFloor(dataset: Dataset, team: TeamData, evalRows = evaluationRows(team, dataset)): { dayAhead: Metrics; withinDay: Metrics } | null {
  if (!dataset.truth) return null;
  const rows = evalRows.filter((item) => item.clean);
  const pairs = (field: "dayAheadS" | "expectedS") =>
    rows.map((item) => {
      const truth = dataset.truth!.get(item.row.log.id);
      return { row: item.row, actual: item.row.timeS, prediction: truth ? { mean: truth[field] } : undefined };
    });
  return { dayAhead: metricsOf(pairs("dayAheadS")), withinDay: metricsOf(pairs("expectedS")) };
}

/* ---------- "Should do", cost of conditions and set breaks (protocol v3) ---------- */

/** Operational "reference conditions": 1st or 2nd rep of the set, rest ≥ 2× the rep, < 1.5 km swum before. */
export function isReferenceRep(row: TrainingRep): boolean {
  if (row.repInSegment > 2 || row.restSeconds == null || !(row.loadBeforeM < 1500)) return false;
  return row.restSeconds - row.timeS >= 2 * row.timeS;
}

export const setIdOf = (row: TrainingRep) => `${row.workoutId}|${row.log.athleteId}|${row.blockId}|${row.segmentIndex}|${row.round}`;

export type ObservedSet = { id: string; date: string; athleteId: string; rows: TrainingRep[]; brokeAt: number | null };

/**
 * Operational break: the first rep (from the 3rd on) at least 4 % slower than the median of the
 * earlier reps of the same set. Only sets with ≥ 3 logged plausible reps; positions are logged order.
 */
export function observedSets(team: TeamData, exclude: Set<string> = new Set()): ObservedSet[] {
  const sets = new Map<string, TrainingRep[]>();
  for (const rows of team.rows.values()) {
    for (const row of rows) {
      if (!isPlausibleRep(row) || exclude.has(row.log.id)) continue;
      const id = setIdOf(row);
      sets.set(id, [...(sets.get(id) ?? []), row]);
    }
  }
  const out: ObservedSet[] = [];
  for (const [id, list] of sets) {
    if (list.length < 3) continue;
    const ordered = [...list].sort((a, b) => a.log.repNumber - b.log.repNumber);
    let brokeAt: number | null = null;
    for (let i = 2; i < ordered.length && brokeAt == null; i += 1) {
      const earlier = ordered.slice(0, i).map((row) => row.timeS).sort((a, b) => a - b);
      const median = earlier.length % 2 ? earlier[(earlier.length - 1) / 2] : (earlier[earlier.length / 2 - 1] + earlier[earlier.length / 2]) / 2;
      if (ordered[i].timeS >= median * 1.04) brokeAt = i + 1;
    }
    out.push({ id, date: ordered[0].date, athleteId: ordered[0].log.athleteId, rows: ordered, brokeAt });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export type CapacityMetrics = {
  /** Against the synthetic truth. */
  n: number;
  mapePct: number;
  biasPct: number;
  coverage80: number | null;
  intervalScorePct: number | null;
  /** Against observed reps in reference conditions (the proxy that exists for real data). */
  nRef: number;
  mapeRefPct: number;
  coverage80Ref: number | null;
  /** Cost of conditions ("will do" over "should do"): mean absolute error in percentage points. */
  costMaePp: number;
};

export function capacityMetrics(scored: Scored[], dataset: Dataset): CapacityMetrics | null {
  const withCap = scored.filter((item) => item.item.clean && item.pair.prediction?.capacity);
  if (!withCap.length) return null;
  const truthOf = (item: Scored) => dataset.truth?.get(item.item.row.log.id);
  const vsTruth = withCap.filter((item) => truthOf(item)?.capacityS != null);
  const cover = (list: Scored[], target: (item: Scored) => number) => {
    const intervals = list.filter((item) => item.pair.prediction!.capacity!.lo != null && item.pair.prediction!.capacity!.hi != null);
    return intervals.length ? intervals.filter((item) => target(item) >= item.pair.prediction!.capacity!.lo! && target(item) <= item.pair.prediction!.capacity!.hi!).length / intervals.length : null;
  };
  const truthCap = (item: Scored) => truthOf(item)!.capacityS!;
  const iscore = vsTruth.filter((item) => item.pair.prediction!.capacity!.lo != null);
  const ref = withCap.filter((item) => isReferenceRep(item.item.row));
  const costs = vsTruth.filter((item) => truthOf(item)?.systematicS != null);
  return {
    n: vsTruth.length,
    mapePct: avg(vsTruth.map((item) => Math.abs(item.pair.prediction!.capacity!.mean / truthCap(item) - 1))) * 100,
    biasPct: avg(vsTruth.map((item) => item.pair.prediction!.capacity!.mean / truthCap(item) - 1)) * 100,
    coverage80: cover(vsTruth, truthCap),
    intervalScorePct: iscore.length
      ? avg(
          iscore.map((item) => {
            const c = item.pair.prediction!.capacity!;
            const y = truthCap(item);
            return (c.hi! - c.lo! + 10 * Math.max(0, c.lo! - y) + 10 * Math.max(0, y - c.hi!)) / y;
          }),
        ) * 100
      : null,
    nRef: ref.length,
    mapeRefPct: avg(ref.map((item) => Math.abs(item.pair.prediction!.capacity!.mean / item.pair.actual - 1))) * 100,
    coverage80Ref: cover(ref, (item) => item.pair.actual),
    costMaePp: avg(
      costs.map((item) => {
        const predicted = item.pair.prediction!.mean / item.pair.prediction!.capacity!.mean - 1;
        const real = truthOf(item)!.systematicS! / truthCap(item) - 1;
        return Math.abs(predicted - real) * 100;
      }),
    ),
  };
}

export type BreakMetrics = {
  sets: number;
  breakRate: number;
  brier: number;
  logLoss: number;
  /** Reference: the team's break rate up to the day before. */
  brierBase: number;
  logLossBase: number;
  /** Sets that broke: |predicted break rep − observed| (predicted = first rep with P ≥ 0.5, else one past the logged reps). */
  repMae: number;
};

export function breakMetrics(predictions: Map<string, Prediction>, sets: ObservedSet[]): BreakMetrics | null {
  const scoredSets = sets.filter((set) => set.rows.every((row) => predictions.get(row.log.id)?.pBreakBy != null));
  if (!scoredSets.length) return null;
  const clip = (p: number) => Math.min(1 - 1e-4, Math.max(1e-4, p));
  let brier = 0;
  let logLoss = 0;
  let brierBase = 0;
  let logLossBase = 0;
  let seenSets = 0;
  let seenBroken = 0;
  const repErrors: number[] = [];
  let currentDate = "";
  let pendingSets = 0;
  let pendingBroken = 0;
  for (const set of scoredSets) {
    if (set.date !== currentDate) {
      seenSets += pendingSets;
      seenBroken += pendingBroken;
      pendingSets = 0;
      pendingBroken = 0;
      currentDate = set.date;
    }
    const y = set.brokeAt != null ? 1 : 0;
    const p = clip(predictions.get(set.rows[set.rows.length - 1].log.id)!.pBreakBy!);
    const base = clip((seenBroken + 1) / (seenSets + 2));
    brier += (p - y) ** 2;
    logLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    brierBase += (base - y) ** 2;
    logLossBase += -(y * Math.log(base) + (1 - y) * Math.log(1 - base));
    if (y) {
      const predictedAt = set.rows.findIndex((row) => predictions.get(row.log.id)!.pBreakBy! >= 0.5);
      repErrors.push(Math.abs((predictedAt < 0 ? set.rows.length + 1 : predictedAt + 1) - set.brokeAt!));
    }
    pendingSets += 1;
    pendingBroken += y;
  }
  const n = scoredSets.length;
  return {
    sets: n,
    breakRate: scoredSets.filter((set) => set.brokeAt != null).length / n,
    brier: brier / n,
    logLoss: logLoss / n,
    brierBase: brierBase / n,
    logLossBase: logLossBase / n,
    repMae: repErrors.length ? avg(repErrors) : Number.NaN,
  };
}

/* ---------- Paired comparison ---------- */

export type PairedSample = {
  n: number;
  mapeA: number;
  mapeB: number;
  crpsA: number | null;
  crpsB: number | null;
  calA: number | null;
  calB: number | null;
};

/** Champion (A) vs challenger (B) on the reps both predicted (clean reps only). */
export function pairedSample(a: Scored[], b: Scored[]): PairedSample {
  const byId = new Map(b.map((item) => [item.item.row.log.id, item]));
  const common: { a: Pair & { prediction: Prediction }; b: Pair & { prediction: Prediction } }[] = [];
  for (const item of a) {
    if (!item.item.clean || !item.pair.prediction) continue;
    const other = byId.get(item.item.row.log.id);
    if (!other?.pair.prediction) continue;
    common.push({ a: item.pair as Pair & { prediction: Prediction }, b: other.pair as Pair & { prediction: Prediction } });
  }
  const ma = metricsOf(common.map((pair) => pair.a));
  const mb = metricsOf(common.map((pair) => pair.b));
  return {
    n: common.length,
    mapeA: ma.mapePct,
    mapeB: mb.mapePct,
    crpsA: ma.crpsPct,
    crpsB: mb.crpsPct,
    calA: ma.coverage80 == null ? null : Math.abs(ma.coverage80 - 0.8) * 100,
    calB: mb.coverage80 == null ? null : Math.abs(mb.coverage80 - 0.8) * 100,
  };
}

/** Mean and percentile 95 % CI of the mean by bootstrap (resampling the replicates). */
export function bootstrapMean(values: number[], iterations = 10_000, seed = 12345): { mean: number; lo: number; hi: number } {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { mean: NaN, lo: NaN, hi: NaN };
  const mean = avg(finite);
  if (finite.length === 1) return { mean, lo: mean, hi: mean };
  const rng = createRng(seed);
  const means = new Float64Array(iterations);
  for (let i = 0; i < iterations; i += 1) {
    let sum = 0;
    for (let j = 0; j < finite.length; j += 1) sum += finite[Math.floor(rng.next() * finite.length)];
    means[i] = sum / finite.length;
  }
  means.sort();
  return { mean, lo: means[Math.floor(0.025 * iterations)], hi: means[Math.floor(0.975 * iterations) - 1] };
}

/* ---------- Leakage check ---------- */

export type CausalityViolation = { logId: string; date: string; cutoff: string; before: number; after: number };

const samePrediction = (a: Prediction | undefined, b: Prediction | undefined) =>
  (!a && !b) || Boolean(a && b && Math.abs(a.mean - b.mean) < 1e-9 && Math.abs((a.sd ?? 0) - (b.sd ?? 0)) < 1e-9);

/**
 * Perturbs everything a prediction may not see and checks that no earlier prediction moves.
 * - day: times on or after the cutoff date change (and some later reps disappear); reps up to the
 *   cutoff date keep their predictions — so a model that peeks at the rep it predicts, or at the
 *   same day, fails;
 * - rep: as day, but the cutoff falls in the middle of each athlete's day, and only reps before
 *   the cutoff rep (inclusive) are checked;
 * - lead: times after a cutoff origin change; if the plan is not known, so do the plan-derived
 *   fields of those reps and the entered load. Forecasts from origins up to the cutoff must not move.
 */
export function checkCausality(predictor: Predictor, team: TeamData, horizon: Horizon = HORIZONS.day, cutoffs = 3, seed = 7): CausalityViolation[] {
  const dates = [...new Set([...team.rows.values()].flatMap((rows) => rows.map((row) => row.date)))].sort();
  if (dates.length < 4) return [];
  const original = predictor.predict(team, horizon);
  const violations: CausalityViolation[] = [];
  for (let k = 1; k <= cutoffs; k += 1) {
    const cutoff = dates[Math.floor((dates.length * k) / (cutoffs + 1))];
    const cutoffDay = dayNumber(cutoff);
    const rng = createRng(seed + k);
    // Moves a time without changing whether it is plausible, so no rep appears or disappears by accident.
    const jitter = (row: TrainingRep): TrainingRep => {
      const timeS = row.timeS * rng.uniform(0.93, 1.07);
      return isPlausibleRep({ timeS, distanceM: row.distanceM }) === isPlausibleRep(row) ? { ...row, timeS } : row;
    };
    const rows = new Map<string, TrainingRep[]>();
    const keep = new Map<string, Set<string>>();
    for (const [athleteId, list] of team.rows) {
      const checked = new Set<string>();
      if (horizon.kind === "lead") {
        rows.set(
          athleteId,
          list
            .filter((row) => dayNumber(row.date) <= cutoffDay || originOf(row.date, horizon, team.anchorDay) <= cutoffDay || rng.chance(0.8))
            .map((row) => {
              if (dayNumber(row.date) <= cutoffDay) return row;
              // The target day's wellness is never known at a forecast origin.
              const moved = { ...jitter(row), sleepHours: row.sleepHours == null ? 9 : null, gymType: row.gymType ? null : ("strength" as const) };
              return horizon.planKnown
                ? moved
                : { ...moved, loadBeforeM: moved.loadBeforeM * rng.uniform(0.5, 1.5), weeklyLoadM: moved.weeklyLoadM * rng.uniform(0.5, 1.5), dayLoadBeforeM: moved.dayLoadBeforeM * rng.uniform(0.5, 1.5) };
            }),
        );
        for (const row of list) if (originOf(row.date, horizon, team.anchorDay) <= cutoffDay) checked.add(row.log.id);
      } else {
        const sameDay = list.filter((row) => row.date === cutoff);
        const pivot = horizon.kind === "rep" && sameDay.length ? sameDay[Math.floor(sameDay.length / 2)] : null;
        const pivotIndex = pivot ? list.indexOf(pivot) : -1;
        rows.set(
          athleteId,
          list
            .filter((row) => row.date <= cutoff || rng.chance(0.8))
            .map((row, index) => {
              const after = horizon.kind === "rep" ? (pivot ? index >= pivotIndex : row.date >= cutoff) : row.date >= cutoff;
              return after ? jitter(row) : row;
            }),
        );
        list.forEach((row, index) => {
          if (horizon.kind === "rep" ? (pivot ? index <= pivotIndex && row.date <= cutoff : row.date <= cutoff) : row.date <= cutoff) checked.add(row.log.id);
        });
      }
      keep.set(athleteId, checked);
    }
    const load = new Map<string, Map<string, DayLoad>>();
    for (const [athleteId, days] of team.load) {
      const copy = new Map<string, DayLoad>();
      for (const [date, value] of days) {
        const after = dayNumber(date) > cutoffDay;
        copy.set(date, horizon.kind === "lead" && !horizon.planKnown && after ? { ...value, meters: value.meters * rng.uniform(0.5, 1.5), load: value.load * rng.uniform(0.5, 1.5) } : value);
      }
      load.set(athleteId, copy);
    }
    // Wellness entered after the cutoff (and, for forecasts, on the cutoff's later days) changes too.
    const athletes = new Map<string, AthleteInfo>();
    for (const [athleteId, info] of team.athletes) {
      athletes.set(athleteId, {
        ...info,
        wellness: info.wellness.map((entry) =>
          dayNumber(entry.date) > cutoffDay ? { ...entry, sleepHours: entry.sleepHours == null ? 6 : entry.sleepHours - 1.5, gym: entry.gym ? null : "strength" } : entry,
        ),
      });
    }
    const after = predictor.predict({ ...team, rows, load, athletes }, horizon);
    for (const [athleteId, list] of team.rows) {
      const checked = keep.get(athleteId)!;
      for (const row of list) {
        if (!checked.has(row.log.id)) continue;
        const a = original.get(row.log.id);
        const b = after.get(row.log.id);
        if (!samePrediction(a, b)) violations.push({ logId: row.log.id, date: row.date, cutoff, before: a?.mean ?? NaN, after: b?.mean ?? NaN });
      }
    }
  }
  return violations;
}

import { isPlausibleRep, type TrainingRep } from "../training-context";
import type { Gear, Intensity, Stroke, WellnessEntry } from "../types";

/*
 * Aquastats state-space model (phase 2): what a rep should take, for one athlete, on one day.
 *
 *   log(time) = structure(rep; β_athlete) + r(intensity)·(L + e + R) + s + noise
 *
 * Structure — physiology, with priors the athlete's own data corrects:
 *   engine (log of a fresh 100 m freestyle, 50 m pool, push start; prior from age and sex) and a
 *   Riegel exponent link every distance and intensity: training zones are fractions of critical
 *   speed (the 1500 m pace on the athlete's curve), race-pace reps run at the event's pace;
 *   strokes, gear, 25 m-pool turns, dives, fatigue inside a set and the first rep are factors.
 *   Each factor starts at the team's estimate (partial pooling: what teammates already showed),
 *   or at the physiological prior while the team has not shown it, so a brand-new kind of rep has
 *   an estimate from its very first time — with an honestly wide uncertainty.
 *
 * Form — several time scales at once, instead of one window:
 *   s  session effect (reset every session);
 *   e  day effect, AR(1) from one day to the next;
 *   L  level: a random walk with the development drift expected at the athlete's age;
 *   ν  the athlete's own deviation from that drift (slow trend);
 *   R  return deficit: after a break it jumps by γ·h(break length) and is then trained away —
 *      it shrinks with the training load actually entered, so a progressive September ramp
 *      recovers it gradually, and γ is learned (from the athlete, else from teammates' returns).
 *
 * Learning: a Kalman filter updates everything after every rep, robustly (Huber weights: a typo
 * or a freak rep barely moves the state), with an adaptive noise level and a CUSUM regime
 * detector that speeds learning up when the errors keep pointing the same way (injury, illness,
 * a change nobody entered). Suspect times are predicted but never learned from.
 */

export type AthleteMeta = { id: string; dateOfBirth?: string; gender?: string; wellness?: WellnessEntry[]; primaryStroke?: Stroke | "" };
export type DayLoadMap = Map<string, { meters: number; load: number; sessions: number }>;

export type StateModelOptions = {
  levelSdPerDay: number;
  dayPhi: number;
  daySd: number;
  sessionSd: number;
  repSdRel: number;
  repSdAbs: number;
  huber: number;
  returnTau: number;
  breakDays: number;
  cusumK: number;
  cusumH: number;
  /** Learn context effects (morning, 2nd session, sleep, gym, metres before). */
  context: boolean;
  /** Fitness–fatigue impulse responses (Banister) from the training entered. */
  banister: boolean;
  fitnessTau: number;
  fatigueTau: number;
  /** Forecasts made before the plan exists foresee the usual summer break. */
  seasonal: boolean;
  /** Individual in-set fatigue with a cliff (fatigue.ts). */
  fatigueGrid: boolean;
  /** With the grid on, keep the linear position-by-rest term for gradual fatigue (the grid then only adds the cliff). */
  fatigueKeepLinear: boolean;
  /** Weight of "same time last year, adjusted for growth" in forecasts made before the plan exists (0 = off): a few weeks ahead / a year ahead. */
  seasonalAnchor: number;
  seasonalAnchorYear: number;
  /** E1: one Riegel exponent up to 100 m and another beyond (critical speed included), the second shrunk to the first. */
  riegelPiecewise: boolean;
  /** E2: the athlete's declared primary stroke gets a pooled "primary advantage" factor. */
  primaryStroke: boolean;
  /** E3: race results are observations of the same engine (MAX from a dive, plus a pooled race factor). */
  races: boolean;
  /** E4: share of the previous rep's error (same set) added to the next forecast, rep horizon only (0 = off). */
  withinSetAR: number;
  /** E8: lagged and self-reported context — sleep two nights before, gym the day before, perceived recovery (needs `context`). */
  contextLagged: boolean;
  /** E9: a CUSUM per structural factor — errors that keep pointing the same way on one factor loosen the team's prior on it. */
  factorCusum: boolean;
  /** E11: extra level uncertainty per week of break (faster learning right after a return) and the break length (days) at which the deficit is ~63 % of γ. */
  returnLevelSd: number;
  returnShapeDays: number;
  /** E12: the individual fatigue profile only acts for an athlete once it has learned from this many sets (0 = always). */
  fatigueMinSets: number;
  /** E12: drop the volume-sensitivity dimension of the fatigue profile (not identifiable). */
  fatigueNoVolume: boolean;
  /** E12: recalibration of the break probability, logit(p′) = a + b·logit(p) (fitted on tuning seeds). */
  breakCalibration: [number, number] | null;
};

/** Tuned on the tuning seeds only (scripts in docs/ml/protocolo.md §5); physiological starting points in comments. */
export const DEFAULT_OPTIONS: StateModelOptions = {
  levelSdPerDay: 0.0008, // start 0.0015
  dayPhi: 0.3, // start 0.6
  daySd: 0.009, // start 0.006
  sessionSd: 0.004,
  repSdRel: 0.013, // start 0.009
  repSdAbs: 0.15,
  huber: 3,
  returnTau: 20, // start 12 typical training days
  breakDays: 10,
  cusumK: 0.5,
  cusumH: 5,
  context: false,
  banister: false,
  fitnessTau: 42,
  fatigueTau: 7,
  seasonal: false,
  fatigueGrid: false,
  fatigueKeepLinear: false,
  seasonalAnchor: 0,
  seasonalAnchorYear: 0,
  riegelPiecewise: false,
  primaryStroke: false,
  races: false,
  withinSetAR: 0,
  contextLagged: false,
  factorCusum: false,
  returnLevelSd: 0.004,
  returnShapeDays: 21,
  fatigueMinSets: 0,
  fatigueNoVolume: false,
  breakCalibration: null,
};

/* ---------- State layout ---------- */

const ZONES = ["SUAVE", "A1", "A2", "A3", "PROG", "PA"] as const;
const STROKES = ["back", "breast", "fly", "im"] as const;
const GEARS: Gear[] = ["legs", "fins", "paddles", "pullbuoy", "arms", "parachute", "suit"];

export const IX = {
  engine: 0,
  k: 1,
  zone: Object.fromEntries(ZONES.map((zone, i) => [zone, 2 + i])) as Record<(typeof ZONES)[number], number>,
  racePace: 8,
  max: 9,
  stroke: Object.fromEntries(STROKES.map((stroke, i) => [stroke, 10 + i])) as Record<(typeof STROKES)[number], number>,
  gear: Object.fromEntries(GEARS.map((gear, i) => [gear, 14 + i])) as Record<Gear, number>,
  turn: 21,
  block: 22,
  fatigue: 23,
  drift: 24,
  first: 25,
  /** Increment of the Riegel exponent beyond 100 m (E1). */
  kLong: 26,
  /** Primary-stroke advantage (E2). */
  primary: 27,
  /** Race conditions vs a training MAX (E3). */
  race: 28,
  gamma: 29,
  morning: 30,
  second: 31,
  sleep: 32,
  wellnessMissing: 33,
  gym: 34,
  loadBefore: 35,
  fitness: 36,
  fatigue2: 37,
  /** Lagged context (E8): short sleep two nights before, gym the day before. */
  sleepPrev: 38,
  gymPrev: 39,
  /** Perceived recovery (1–5) entered with the wellness (E8). */
  recovery: 40,
  L: 41,
  nu: 42,
  e: 43,
  s: 44,
  R: 45,
};
export const N = 46;
/** Coefficients shared through the team estimate (everything structural and contextual except the engine). */
const POOLED = Array.from({ length: IX.L }, (_, j) => j).filter((j) => j !== IX.engine);

const lg = Math.log;
/** Physiological prior per coefficient: mean and SD (log-time units unless noted). */
const PRIOR: [number, number][] = (() => {
  const p: [number, number][] = new Array(N).fill(null).map(() => [0, 0]);
  p[IX.engine] = [lg(66), 0.12];
  p[IX.k] = [1.07, 0.03];
  const zone: Record<(typeof ZONES)[number], number> = { SUAVE: 0.8, A1: 0.88, A2: 0.94, A3: 1, PROG: 0.97, PA: 1.06 };
  for (const name of ZONES) p[IX.zone[name]] = [-lg(zone[name]), 0.035];
  p[IX.racePace] = [0.01, 0.02];
  p[IX.max] = [0.015, 0.02];
  p[IX.stroke.back] = [lg(1.1), 0.05];
  p[IX.stroke.breast] = [lg(1.24), 0.05];
  p[IX.stroke.fly] = [lg(1.07), 0.05];
  p[IX.stroke.im] = [lg(1.12), 0.05];
  p[IX.gear.legs] = [lg(1.35), 0.12];
  p[IX.gear.fins] = [lg(0.89), 0.04];
  p[IX.gear.paddles] = [lg(0.965), 0.02];
  p[IX.gear.pullbuoy] = [lg(1.05), 0.03];
  p[IX.gear.arms] = [lg(1.05), 0.03];
  p[IX.gear.parachute] = [lg(1.12), 0.04];
  p[IX.gear.suit] = [lg(0.99), 0.01];
  p[IX.turn] = [-0.05, 0.02];
  p[IX.block] = [-0.7, 0.3];
  p[IX.fatigue] = [0.004, 0.006];
  p[IX.drift] = [0.0005, 0.001];
  p[IX.first] = [0, 0.01];
  // Agnostic about the sign: the data decide whether the curve bends beyond 100 m.
  p[IX.kLong] = [0, 0.02];
  // Swimmers are usually relatively faster in their main stroke; how much is learned from the team.
  p[IX.primary] = [-0.02, 0.02];
  p[IX.race] = [-0.01, 0.02];
  p[IX.gamma] = [0.035, 0.02];
  // Context: small effects, strongly shrunk — the data has to insist before they move.
  p[IX.morning] = [0.005, 0.008];
  p[IX.second] = [0.003, 0.006];
  p[IX.sleep] = [0.002, 0.003];
  p[IX.wellnessMissing] = [0, 0.003];
  p[IX.gym] = [0.005, 0.008];
  p[IX.loadBefore] = [0.001, 0.002];
  // Banister: more fitness than usual → faster; more fatigue than usual → slower (per unit of relative impulse).
  p[IX.fitness] = [-0.02, 0.015];
  p[IX.fatigue2] = [0.015, 0.012];
  p[IX.sleepPrev] = [0.001, 0.002];
  p[IX.gymPrev] = [0, 0.006];
  // Feeling fresher (recovery above 3) → faster; small, strongly shrunk.
  p[IX.recovery] = [-0.002, 0.004];
  p[IX.L] = [0, 0.03];
  p[IX.nu] = [0, 0.01 / 365];
  p[IX.e] = [0, 0.006];
  p[IX.s] = [0, 0.004];
  p[IX.R] = [0, 0.001];
  return p;
})();

/* ---------- Physiological priors that depend on the athlete ---------- */

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

function interpolate(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i += 1) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/** Typical fresh 100 m freestyle (50 m pool, push start) of a competitive club swimmer by age. */
const T100_BY_AGE: Record<"M" | "F", [number, number][]> = {
  M: [[11, 74], [12, 70], [14, 63], [16, 59.5], [18, 57.5], [22, 56]],
  F: [[11, 74], [12, 71], [14, 66], [16, 64], [18, 63], [22, 62.5]],
};
/** Expected improvement per year (log-time) by age: young swimmers get faster just by growing. */
const DEVELOPMENT_BY_AGE: Record<"M" | "F", [number, number][]> = {
  M: [[10, -0.06], [12, -0.05], [14, -0.035], [16, -0.02], [18, -0.01], [22, -0.002]],
  F: [[10, -0.06], [12, -0.045], [14, -0.025], [16, -0.01], [18, -0.004], [22, 0]],
};

function ageOn(meta: AthleteMeta, day: number): number | null {
  if (!meta.dateOfBirth) return null;
  return (day - dayNumber(meta.dateOfBirth)) / 365.25;
}

function sexOf(meta: AthleteMeta): "M" | "F" | null {
  return meta.gender === "M" || meta.gender === "F" ? meta.gender : null;
}

export function enginePrior(meta: AthleteMeta, day: number): [number, number] {
  const age = ageOn(meta, day);
  const sex = sexOf(meta);
  if (age == null) return PRIOR[IX.engine];
  const table = sex ? T100_BY_AGE[sex] : T100_BY_AGE.M.map(([a, t], i) => [a, (t + T100_BY_AGE.F[i][1]) / 2] as [number, number]);
  return [lg(interpolate(table, age)), sex ? 0.08 : 0.1];
}

export function developmentPerDay(meta: AthleteMeta, day: number): number {
  const age = ageOn(meta, day);
  if (age == null) return 0;
  const sex = sexOf(meta) ?? "F";
  return interpolate(DEVELOPMENT_BY_AGE[sex], age) / 365.25;
}

/* ---------- The observation for one rep ---------- */

const RESPONSE: Record<Intensity, number> = { SUAVE: 0.6, A1: 0.6, A2: 0.8, A3: 0.9, PROG: 0.9, PA: 1, MAX: 1, P50: 1, P100: 1, P200: 1, P400: 1 };
const HARD: ReadonlySet<Intensity> = new Set(["PA", "MAX", "P50", "P100", "P200", "P400"]);

export const extraTurnsShare = (distance: number) => {
  const extra = Math.max(0, Math.ceil(distance / 25) - 1) - Math.max(0, Math.ceil(distance / 50) - 1);
  return distance > 0 ? extra / (distance / 25) : 0;
};

type Observation = { offset: number; idx: number[]; val: number[] };

/** Which structural refinements this athlete's model uses (E1, E2) and the wellness by date for lagged context (E8). */
type Shape = { piecewise: boolean; primary: Stroke | "" | null; wellness?: Map<string, WellnessEntry> | null };
const PLAIN: Shape = { piecewise: false, primary: null };
const previousDay = (iso: string) => new Date((dayNumber(iso) - 1) * DAY_MS).toISOString().slice(0, 10);

/** What context a forecast may use: the rep's own day (sleep, gym) only when it is known. */
export type ContextAccess = {
  use: boolean;
  dayKnown: boolean;
  planKnown: boolean;
  impulse?: { fitness: number; fatigue: number } | null;
  /** In-set fatigue is handled outside (fatigue.ts): drop the linear position-by-rest term. */
  noLinearFatigue?: boolean;
  /** The observation is a race (E3): the race factor applies. */
  race?: boolean;
};

/** Extra log-time from outside the linear model (e.g. the expected in-set fatigue) and its variance. */
export type Offset = { offset: number; variance: number };
const NO_OFFSET: Offset = { offset: 0, variance: 0 };
const NO_CONTEXT: ContextAccess = { use: false, dayKnown: false, planKnown: false };

/** Sparse observation vector of a rep: log(time) = offset + Σ val·state[idx]. */
function observe(row: TrainingRep, approxTime: number | null, context: ContextAccess = NO_CONTEXT, shape: Shape = PLAIN): Observation {
  const idx: number[] = [IX.engine];
  const val: number[] = [1];
  const d = row.distanceM;
  let offset = 0;
  if (row.intensity === "MAX") {
    idx.push(IX.k, IX.max);
    val.push(lg(d / 100), 1);
    if (shape.piecewise && d > 100) {
      idx.push(IX.kLong);
      val.push(lg(d / 100));
    }
  } else if (row.intensity === "P50" || row.intensity === "P100" || row.intensity === "P200" || row.intensity === "P400") {
    const event = Number(row.intensity.slice(1));
    offset = lg(d / event);
    idx.push(IX.k, IX.racePace);
    val.push(lg(event / 100), 1);
    if (shape.piecewise && event > 100) {
      idx.push(IX.kLong);
      val.push(lg(event / 100));
    }
  } else {
    offset = lg(d / 1500);
    idx.push(IX.k, IX.zone[row.intensity as (typeof ZONES)[number]]);
    val.push(lg(15), 1);
    if (shape.piecewise) {
      idx.push(IX.kLong);
      val.push(lg(15));
    }
  }
  if (row.stroke && row.stroke !== "free") {
    idx.push(IX.stroke[row.stroke as Exclude<Stroke, "free">]);
    val.push(1);
    if (shape.primary && row.stroke === shape.primary) {
      idx.push(IX.primary);
      val.push(1);
    }
  }
  for (const gear of row.gear) {
    idx.push(IX.gear[gear]);
    val.push(1);
  }
  if (row.course === "scm") {
    const share = extraTurnsShare(d);
    if (share) {
      idx.push(IX.turn);
      val.push(share);
    }
  }
  if (row.fromBlock) {
    idx.push(IX.block);
    val.push(Math.min(1, d / 50) / (approxTime ?? d * 0.65));
  }
  const position = row.repInSegment - 1;
  if (row.segmentReps > 1) {
    if (HARD.has(row.intensity)) {
      const rest = row.restSeconds != null ? Math.max(0, row.restSeconds - (approxTime ?? d * 0.65)) : 30;
      if (position > 0 && !context.noLinearFatigue) {
        idx.push(IX.fatigue);
        val.push(position * Math.exp(-rest / 90));
      }
    } else if (position > 0 && row.intensity !== "SUAVE" && row.intensity !== "A1") {
      idx.push(IX.drift);
      val.push(position);
    }
    if (position === 0) {
      idx.push(IX.first);
      val.push(1);
    }
  }
  if (context.use) {
    if (row.shift === "morning") {
      idx.push(IX.morning);
      val.push(1);
    }
    if (row.trainedEarlierToday) {
      idx.push(IX.second);
      val.push(1);
    }
    // Wellness not filled in is not "slept 8 h": it gets its own indicator (missing is information).
    if (context.dayKnown && row.sleepHours != null) {
      idx.push(IX.sleep);
      val.push(Math.max(0, 8 - row.sleepHours));
      if (row.gymType === "strength" || row.gymType === "explosive") {
        idx.push(IX.gym);
        val.push(row.gymType === "strength" ? 1 : 0.7);
      }
    } else {
      idx.push(IX.wellnessMissing);
      val.push(1);
    }
    if (context.planKnown && HARD.has(row.intensity) && row.loadBeforeM > 0) {
      idx.push(IX.loadBefore);
      val.push(row.loadBeforeM / 1000);
    }
    if (context.dayKnown && shape.wellness) {
      const today = shape.wellness.get(row.date);
      const before = shape.wellness.get(previousDay(row.date));
      if (before?.sleepHours != null) {
        idx.push(IX.sleepPrev);
        val.push(Math.max(0, 8 - before.sleepHours));
      }
      if (before?.gym === "strength" || before?.gym === "explosive") {
        idx.push(IX.gymPrev);
        val.push(before.gym === "strength" ? 1 : 0.7);
      }
      if (today?.recovery != null) {
        idx.push(IX.recovery);
        val.push(today.recovery - 3);
      }
    }
  }
  if (context.race) {
    idx.push(IX.race);
    val.push(1);
  }
  const response = RESPONSE[row.intensity];
  if (context.impulse) {
    idx.push(IX.fitness, IX.fatigue2);
    val.push(response * context.impulse.fitness, response * context.impulse.fatigue);
  }
  idx.push(IX.L, IX.e, IX.R, IX.s);
  val.push(response, response, response, 1);
  return { offset, idx, val };
}

/* ---------- Per-athlete filter ---------- */

/** Log-time contributions of the dynamic parts of a forecast (for explanations; 0.01 ≈ 1 % slower). */
export type ForecastTerms = { form: number; returnDeficit: number; day: number; session: number; set: number };

export type Forecast = {
  meanS: number;
  logMean: number;
  logSd: number;
  /** Inactive coefficients this rep needed (cold start). */
  newFactors: number;
  terms: ForecastTerms;
};

export class AthleteFilter {
  z = new Float64Array(N);
  P = new Float64Array(N * N);
  active = new Uint8Array(N);
  /** Prior variance at activation, to tell informed coefficients apart. */
  initVar = new Float64Array(N);
  day: number | null = null;
  lastTrainingDay: number | null = null;
  lastSession = "";
  noiseScale = 1;
  cusumPos = 0;
  cusumNeg = 0;
  dayZ: number[] = [];
  /** Training entered per day, for the return-deficit decay and the athlete's habits. */
  loadHistory: { day: number; load: number }[] = [];
  observations = 0;
  /** Banister impulses (sum of entered load, exponentially forgotten) and the day they refer to. */
  fitnessImpulse = 0;
  fatigueImpulse = 0;
  /** Breaks seen so far (first day of the gap, length in days): the athlete's own calendar. */
  breaks: { start: number; length: number }[] = [];
  /** Days on which the regime detector fired (errors kept pointing the same way). */
  regimeShifts: number[] = [];
  /** E9: running CUSUM of standardised errors per structural factor (positive and negative sides). */
  factorCusumPos = new Float64Array(N);
  factorCusumNeg = new Float64Array(N);
  /** Filtered form (level + return deficit) at the end of every day with data: the athlete's seasons, for year-on-year comparisons. */
  formLog: { day: number; mean: number }[] = [];

  constructor(
    readonly meta: AthleteMeta,
    readonly options: StateModelOptions,
  ) {
    for (const j of [IX.L, IX.nu, IX.e, IX.s, IX.R]) {
      this.z[j] = PRIOR[j][0];
      this.P[j * N + j] = PRIOR[j][1] ** 2;
      this.active[j] = 1;
    }
  }

  clone(): AthleteFilter {
    const copy = new AthleteFilter(this.meta, this.options);
    copy.z.set(this.z);
    copy.P.set(this.P);
    copy.active.set(this.active);
    copy.initVar.set(this.initVar);
    copy.day = this.day;
    copy.lastTrainingDay = this.lastTrainingDay;
    copy.lastSession = this.lastSession;
    copy.noiseScale = this.noiseScale;
    copy.loadHistory = [...this.loadHistory];
    copy.observations = this.observations;
    copy.fitnessImpulse = this.fitnessImpulse;
    copy.fatigueImpulse = this.fatigueImpulse;
    copy.breaks = [...this.breaks];
    copy.formLog = this.formLog;
    copy.factorCusumPos.set(this.factorCusumPos);
    copy.factorCusumNeg.set(this.factorCusumNeg);
    return copy;
  }

  activate(j: number, mean: number, sd: number) {
    if (this.active[j]) return;
    this.z[j] = mean;
    for (let i = 0; i < N; i += 1) {
      this.P[j * N + i] = 0;
      this.P[i * N + j] = 0;
    }
    this.P[j * N + j] = sd * sd;
    this.initVar[j] = sd * sd;
    this.active[j] = 1;
  }

  /** x[i] += a·x[j] on the state (an elementary transition), keeping P = F P Fᵀ. */
  private addScaled(i: number, j: number, a: number) {
    if (!a) return;
    this.z[i] += a * this.z[j];
    for (let c = 0; c < N; c += 1) this.P[i * N + c] += a * this.P[j * N + c];
    for (let r = 0; r < N; r += 1) this.P[r * N + i] += a * this.P[r * N + j];
  }

  private scale(i: number, a: number) {
    this.z[i] *= a;
    for (let c = 0; c < N; c += 1) this.P[i * N + c] *= a;
    for (let r = 0; r < N; r += 1) this.P[r * N + i] *= a;
  }

  /** Typical entered load of a training day, and how often the athlete trains (share of days). */
  private habits(day: number): { load: number; frequency: number } {
    const recent = this.loadHistory.filter((item) => day - item.day <= 56 && item.load > 0);
    if (recent.length < 5) return { load: recent.length ? recent.reduce((sum, item) => sum + item.load, 0) / recent.length : 4, frequency: 5 / 7 };
    const sorted = recent.map((item) => item.load).sort((a, b) => a - b);
    return { load: sorted[Math.floor(sorted.length / 2)], frequency: Math.min(1, new Set(recent.map((item) => item.day)).size / 56) };
  }

  /** Fitness and fatigue relative to what the athlete's usual training would sustain (0 = usual). */
  impulse(): { fitness: number; fatigue: number } | null {
    if (this.day == null || this.loadHistory.length < 10) return null;
    const recent = this.loadHistory.filter((item) => this.day! - item.day <= 180);
    const span = Math.max(28, Math.min(180, this.day - Math.min(...recent.map((item) => item.day))));
    const daily = recent.reduce((sum, item) => sum + item.load, 0) / span;
    if (!(daily > 0)) return null;
    const clip = (value: number) => Math.max(-1.5, Math.min(1.5, value));
    const o = this.options;
    return {
      fitness: clip(this.fitnessImpulse / (daily / (1 - Math.exp(-1 / o.fitnessTau))) - 1),
      fatigue: clip(this.fatigueImpulse / (daily / (1 - Math.exp(-1 / o.fatigueTau))) - 1),
    };
  }

  /** Critical speed (m/s) implied by the engine and the Riegel exponent: the 1500 m pace on the athlete's curve, at today's form. */
  criticalSpeed(): number {
    const engine = this.active[IX.engine] ? this.z[IX.engine] : PRIOR[IX.engine][0];
    const k = this.active[IX.k] ? this.z[IX.k] : PRIOR[IX.k][0];
    const kLong = this.options.riegelPiecewise ? (this.active[IX.kLong] ? this.z[IX.kLong] : PRIOR[IX.kLong][0]) : 0;
    return 1500 / Math.exp(engine + (k + kLong) * Math.log(15) + this.form());
  }

  private wellnessByDate: Map<string, WellnessEntry> | null = null;

  /** The structural refinements this athlete's observations use. */
  shape(): Shape {
    if (this.options.contextLagged && !this.wellnessByDate) this.wellnessByDate = new Map((this.meta.wellness ?? []).map((entry) => [entry.date, entry]));
    return { piecewise: this.options.riegelPiecewise, primary: this.options.primaryStroke ? (this.meta.primaryStroke ?? null) : null, wellness: this.wellnessByDate };
  }

  /** Current form: level plus return deficit (log-time, 0 = the athlete's engine). */
  form(): number {
    return this.z[IX.L] + this.z[IX.R];
  }

  logForm() {
    if (this.day == null) return;
    const last = this.formLog[this.formLog.length - 1];
    if (last && last.day === this.day) last.mean = this.form();
    else this.formLog.push({ day: this.day, mean: this.form() });
  }

  /** Form logged closest to `day` (within `tolerance` days), or null. */
  formNear(day: number, tolerance = 10): number | null {
    let best: { day: number; mean: number } | null = null;
    for (const item of this.formLog) {
      if (Math.abs(item.day - day) > tolerance) continue;
      if (!best || Math.abs(item.day - day) < Math.abs(best.day - day)) best = item;
    }
    return best ? best.mean : null;
  }

  /** Current form minus its average over the previous `days` days (log-time; negative = faster than lately). */
  recentFormDelta(days = 56): number {
    if (this.day == null) return 0;
    let sum = 0;
    let n = 0;
    for (const item of this.formLog) {
      if (item.day < this.day && this.day - item.day <= days) {
        sum += item.mean;
        n += 1;
      }
    }
    return n ? this.form() - sum / n : 0;
  }

  /** Moves the forecast's form towards `target` by `weight` (seasonal anchors). */
  nudgeForm(target: number, weight: number) {
    this.z[IX.L] += weight * (target - this.form());
  }

  /** A break of `gap` days without training: the return deficit jumps (γ learned), the level gets less certain. */
  applyBreak(gap: number, gammaPrior: [number, number]) {
    this.activate(IX.gamma, gammaPrior[0], gammaPrior[1]);
    this.addScaled(IX.R, IX.gamma, 1 - Math.exp(-(gap - 7) / this.options.returnShapeDays));
    this.P[IX.L * N + IX.L] += this.options.returnLevelSd ** 2 * (gap / 7);
  }

  /** Puts a deficit in place for an athlete whose data starts right after a break of unknown length. */
  startsAfterBreak(gammaPrior: [number, number], days = 35) {
    this.activate(IX.gamma, gammaPrior[0], gammaPrior[1]);
    this.addScaled(IX.R, IX.gamma, 1 - Math.exp(-(days - 7) / this.options.returnShapeDays));
  }

  /**
   * Moves the state to `day`.
   * `loads` = training entered on the days strictly between the current day and `day`, or null when
   * the plan is not known yet (the athlete's habits are assumed and no break is foreseen).
   * `trainsToday` = `day` itself is a training day (it has a session).
   */
  advance(day: number, loads: { day: number; load: number }[] | null, trainsToday: boolean, gammaPrior: [number, number]) {
    if (this.day == null) {
      this.day = day;
      if (trainsToday) this.lastTrainingDay = day;
      return;
    }
    const dt = day - this.day;
    if (dt <= 0) return;
    const o = this.options;
    const habits = this.habits(this.day);
    if (loads) {
      // Breaks: a long stretch with no training entered → return deficit jumps, level gets less certain.
      const trainingDays = [...loads.filter((item) => item.load > 0).map((item) => item.day), ...(trainsToday ? [day] : [])];
      let previous = this.lastTrainingDay;
      for (const trainingDay of trainingDays) {
        const gap = previous == null ? 0 : trainingDay - previous;
        if (gap >= o.breakDays) {
          this.applyBreak(gap, gammaPrior);
          this.breaks.push({ start: previous!, length: gap });
        }
        previous = trainingDay;
      }
      this.lastTrainingDay = previous;
      for (const item of loads) this.loadHistory.push(item);
      if (this.loadHistory.length > 400) this.loadHistory.splice(0, this.loadHistory.length - 400);
    }
    // Banister impulses: decay to `day`, adding the training entered (or, without a plan, the usual training).
    const t1 = o.fitnessTau;
    const t2 = o.fatigueTau;
    if (loads) {
      let at = this.day;
      for (const item of loads) {
        this.fitnessImpulse = this.fitnessImpulse * Math.exp(-(item.day - at) / t1) + item.load;
        this.fatigueImpulse = this.fatigueImpulse * Math.exp(-(item.day - at) / t2) + item.load;
        at = item.day;
      }
      this.fitnessImpulse *= Math.exp(-(day - at) / t1);
      this.fatigueImpulse *= Math.exp(-(day - at) / t2);
    } else {
      const daily = habits.load * habits.frequency;
      const fill = (tau: number) => (daily * (1 - Math.exp(-dt / tau))) / (1 - Math.exp(-1 / tau));
      this.fitnessImpulse = this.fitnessImpulse * Math.exp(-dt / t1) + fill(t1);
      this.fatigueImpulse = this.fatigueImpulse * Math.exp(-dt / t2) + fill(t2);
    }
    // Return deficit trained away by the load swum, in typical training days.
    const trained = loads ? loads.reduce((sum, item) => sum + item.load, 0) / habits.load : dt * habits.frequency;
    if (this.active[IX.gamma]) this.scale(IX.R, Math.exp(-trained / o.returnTau));
    // Level: development drift for the athlete's age, the athlete's own trend, random walk.
    this.z[IX.L] += developmentPerDay(this.meta, this.day) * dt;
    this.addScaled(IX.L, IX.nu, dt);
    this.P[IX.L * N + IX.L] += o.levelSdPerDay ** 2 * dt;
    this.P[IX.nu * N + IX.nu] += (0.004 / 365) ** 2 * dt;
    // Day effect: AR(1).
    const a = Math.pow(o.dayPhi, dt);
    this.scale(IX.e, a);
    this.P[IX.e * N + IX.e] += o.daySd ** 2 * (1 - a * a);
    // Structural factors drift very slowly (technique, growth).
    for (let j = 0; j < IX.gamma; j += 1) if (this.active[j]) this.P[j * N + j] += 1e-8 * dt;
    this.day = day;
  }

  newSession(key: string) {
    if (key === this.lastSession) return;
    this.lastSession = key;
    this.z[IX.s] = 0;
    for (let i = 0; i < N; i += 1) {
      this.P[IX.s * N + i] = 0;
      this.P[i * N + IX.s] = 0;
    }
    this.P[IX.s * N + IX.s] = this.options.sessionSd ** 2;
  }

  private obsNoise(approxTime: number): number {
    const o = this.options;
    return (o.repSdRel ** 2 + (o.repSdAbs / approxTime) ** 2) * this.noiseScale;
  }

  forecast(row: TrainingRep, prior: (j: number) => [number, number], access: ContextAccess = NO_CONTEXT, extra: Offset = NO_OFFSET): Forecast {
    const context = this.options.banister ? { ...access, impulse: this.impulse() } : access;
    let newFactors = 0;
    const first = observe(row, null, context, this.shape());
    for (const j of first.idx) {
      if (!this.active[j]) {
        const [m, sd] = prior(j);
        this.activate(j, m, sd);
      }
      // A structural factor still at its starting uncertainty: this kind of rep has not been timed yet.
      if (j < IX.gamma && this.P[j * N + j] >= 0.95 * this.initVar[j]) newFactors += 1;
    }
    // Linearise the dive gain around the prediction without it.
    const approx = Math.exp(first.offset + first.idx.reduce((sum, j, i) => sum + (j === IX.block ? 0 : first.val[i] * this.z[j]), 0));
    const obs = observe(row, approx, context, this.shape());
    let mean = obs.offset + extra.offset;
    for (let i = 0; i < obs.idx.length; i += 1) mean += obs.val[i] * this.z[obs.idx[i]];
    let variance = 0;
    for (let a = 0; a < obs.idx.length; a += 1) {
      const ra = obs.idx[a] * N;
      for (let b = 0; b < obs.idx.length; b += 1) variance += obs.val[a] * obs.val[b] * this.P[ra + obs.idx[b]];
    }
    const meanS = Math.exp(mean);
    variance += this.obsNoise(meanS) + extra.variance;
    const terms: ForecastTerms = { form: 0, returnDeficit: 0, day: 0, session: 0, set: 0 };
    for (let i = 0; i < obs.idx.length; i += 1) {
      const j = obs.idx[i];
      const part = obs.val[i] * this.z[j];
      if (j === IX.L) terms.form += part;
      else if (j === IX.R) terms.returnDeficit += part;
      else if (j === IX.e) terms.day += part;
      else if (j === IX.s) terms.session += part;
      else if (j === IX.fatigue || j === IX.drift || j === IX.first) terms.set += part;
    }
    terms.set += extra.offset;
    return { meanS, logMean: mean, logSd: Math.sqrt(Math.max(variance, 1e-10)), newFactors, terms };
  }

  /** Robust Kalman update with one rep. Returns the standardised innovation. */
  update(row: TrainingRep, prior: (j: number) => [number, number], access: ContextAccess = NO_CONTEXT, extra: Offset = NO_OFFSET): number {
    const context = this.options.banister ? { ...access, impulse: this.impulse() } : access;
    const f = this.forecast(row, prior, access, extra);
    const obs = observe(row, Math.exp(f.logMean - extra.offset), context, this.shape());
    const y = Math.log(row.timeS);
    const ph = new Float64Array(N);
    for (let a = 0; a < obs.idx.length; a += 1) {
      const j = obs.idx[a];
      const v = obs.val[a];
      for (let r = 0; r < N; r += 1) ph[r] += this.P[r * N + j] * v;
    }
    let hph = 0;
    for (let a = 0; a < obs.idx.length; a += 1) hph += obs.val[a] * ph[obs.idx[a]];
    const noise = this.obsNoise(f.meanS) + extra.variance;
    let innovation = y - f.logMean;
    const s = hph + noise;
    const zScore = innovation / Math.sqrt(s);
    // Huber: beyond c standard deviations the rep counts as if it were noisier.
    const c = this.options.huber;
    const sEff = Math.abs(zScore) > c ? s * (Math.abs(zScore) / c) : s;
    if (!Number.isFinite(innovation)) innovation = 0;
    for (let r = 0; r < N; r += 1) this.z[r] += (ph[r] / sEff) * innovation;
    for (let r = 0; r < N; r += 1) {
      const kr = ph[r] / sEff;
      if (!kr) continue;
      for (let col = 0; col < N; col += 1) this.P[r * N + col] -= kr * ph[col];
    }
    for (let j = 0; j < N; j += 1) if (this.P[j * N + j] < 1e-14) this.P[j * N + j] = 1e-14;
    // Adaptive noise level (slow) from clipped squared standardised innovations.
    this.noiseScale = Math.min(3, Math.max(0.5, 0.99 * this.noiseScale + 0.01 * Math.min(zScore * zScore, 9)));
    this.dayZ.push(Math.max(-3, Math.min(3, zScore)));
    this.observations += 1;
    if (this.options.factorCusum && Number.isFinite(zScore)) {
      // The same error, attributed to every structural factor of this rep: a factor whose errors keep the
      // same sign rep after rep is off for this athlete, so its uncertainty is reopened (the team prior weighs less).
      const clipped = Math.max(-3, Math.min(3, zScore));
      for (const j of obs.idx) {
        if (j >= IX.gamma || j === IX.engine || j === IX.k) continue;
        this.factorCusumPos[j] = Math.max(0, this.factorCusumPos[j] + clipped - 0.5);
        this.factorCusumNeg[j] = Math.min(0, this.factorCusumNeg[j] + clipped + 0.5);
        if (this.factorCusumPos[j] > 4 || this.factorCusumNeg[j] < -4) {
          this.factorCusumPos[j] = 0;
          this.factorCusumNeg[j] = 0;
          this.P[j * N + j] += 0.25 * this.initVar[j];
        }
      }
    }
    return zScore;
  }

  /** End of a day of data: CUSUM on the day's mean standardised error; a persistent shift speeds learning up. */
  closeDay(): boolean {
    if (!this.dayZ.length) return false;
    const mean = this.dayZ.reduce((sum, value) => sum + value, 0) / this.dayZ.length;
    this.dayZ = [];
    const o = this.options;
    this.cusumPos = Math.max(0, this.cusumPos + mean - o.cusumK);
    this.cusumNeg = Math.min(0, this.cusumNeg + mean + o.cusumK);
    if (this.cusumPos > o.cusumH || this.cusumNeg < -o.cusumH) {
      this.cusumPos = 0;
      this.cusumNeg = 0;
      this.P[IX.L * N + IX.L] += 0.015 ** 2;
      if (this.day != null) this.regimeShifts.push(this.day);
      return true;
    }
    return false;
  }
}

/* ---------- Team pooling ---------- */

/** The team's current estimate of each structural factor, from teammates who have informed it. */
export class TeamPool {
  private estimate = new Map<number, [number, number]>();
  engineOffset: [number, number] | null = null;

  refresh(filters: AthleteFilter[], engineRef: Map<AthleteFilter, number>) {
    this.estimate.clear();
    for (const j of POOLED) {
      const informed = filters.filter((f) => f.active[j] && f.P[j * N + j] < 0.5 * f.initVar[j]);
      if (informed.length < 2) continue;
      let wSum = 0;
      let mSum = 0;
      for (const f of informed) {
        const w = 1 / f.P[j * N + j];
        wSum += w;
        mSum += w * f.z[j];
      }
      const mean = mSum / wSum;
      const spread = informed.reduce((sum, f) => sum + (f.z[j] - mean) ** 2, 0) / (informed.length - 1);
      const within = informed.reduce((sum, f) => sum + f.P[j * N + j], 0) / informed.length;
      const between = Math.max(0, spread - within);
      const priorSd = PRIOR[j][1];
      const sd = Math.min(priorSd, Math.max(priorSd * 0.25, Math.sqrt(between + within)));
      this.estimate.set(j, [mean, sd]);
    }
    const residuals = filters.filter((f) => f.active[IX.engine] && f.observations >= 20 && engineRef.has(f)).map((f) => f.z[IX.engine] - engineRef.get(f)!);
    if (residuals.length >= 2) {
      const mean = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
      const sd = Math.sqrt(residuals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (residuals.length - 1));
      this.engineOffset = [mean, Math.max(0.03, Math.min(0.1, sd))];
    }
  }

  prior(j: number, filter: AthleteFilter, day: number): [number, number] {
    if (j === IX.engine) {
      const [mean, sd] = enginePrior(filter.meta, day);
      return this.engineOffset ? [mean + this.engineOffset[0], Math.min(sd, this.engineOffset[1] * 1.5)] : [mean, sd];
    }
    return this.estimate.get(j) ?? PRIOR[j];
  }
}

export { isPlausibleRep };

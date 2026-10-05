import type { Gear, Intensity, PoolCourse, RepDetail, SetSegment, Shift, Stroke, TimeLog, WellnessEntry, Workout, WorkoutBlock } from "../types";
import { createRng, type Rng } from "./rng";

/*
 * SYNTHETIC training data (generator v2) — for validating prediction methods only. Never mixed with
 * real data: every id starts with "syn-" and every dataset carries kind: "synthetic". Only fields
 * the site's forms ask for are produced: workouts and sets, rep times, athletes (date of birth,
 * sex, group, main stroke), wellness (sleep, gym, recovery) and race results.
 *
 * Built from physiology, and on purpose slightly different from what the prediction models assume,
 * so a model cannot win by mirroring the generator:
 *   - distance–time from a piecewise power law (one exponent up to 100 m, another beyond), athlete-
 *     specific; critical speed (CS) taken on that curve at 1500 m;
 *   - growth: an athlete's potential improves with age along a saturating curve that differs by sex;
 *   - training zones as athlete-specific fractions of CS; race-pace reps from the event's pace;
 *   - turns gain seconds that grow on slower laps, dive vs push, stroke and gear factors;
 *   - fatigue inside a set from W′ balance (drained above CS, exponential recovery in the rest);
 *   - day-to-day state from three impulse-response components — fitness (slow), fatigue (fast),
 *     feel for the water (lost quickly on breaks) — with "muscle memory": fitness rebuilds faster
 *     while it is below the athlete's earlier peak;
 *   - seasons with Christmas, Easter and August breaks, a progressive return in September, late
 *     returners, injuries and illness;
 *   - an AR(1) daily form shock and a session shock nobody can see in advance;
 *   - context nobody logs perfectly: morning sessions, a second session, sleep, gym;
 *   - heavy-tailed rep noise, hand-timing error and typing errors (wrong minute, swapped digits,
 *     a split instead of the final time, two swimmers' times swapped);
 *   - missing data that carries information: race-pace sets get timed far more than aerobic ones,
 *     sessions with no times, sessions never entered, wellness filled more on bad nights.
 *
 * v3 — every athlete is different, and the differences matter:
 *   - an individual anaerobic reserve W′ (8–50 m) and recovery time constant (30–240 s); the reserve
 *     available for a set shrinks with the volume already swum (5–30 % per 4 km);
 *   - a real cliff: when a rep needs more W′ than is left, the rest of it is swum at critical speed —
 *     the rep falls off the curve; after such a break some swimmers abandon the set (the reps that
 *     follow are never logged: censored data), and some coaches skip logging the bad rep;
 *   - capacity moves dimension by dimension: W′ follows the anaerobic work of the last weeks,
 *     recovery follows short-rest work, each at the athlete's own speed (for some, not at all);
 *   - gym, sleep and time of day act with an individual sign (positive, none or negative) and lag
 *     (gym the day before, sleep two nights before);
 *   - about one athlete in five is atypical on purpose (extreme reserve or recovery, unusual kick,
 *     reversed context effects);
 *   - truth per rep includes the capacity time ("should do": current form, reference conditions),
 *     the systematic time in the real conditions ("will do" without the shocks) and the break.
 */

export const SYNTHETIC_PREFIX = "syn-";
/** Bumped whenever generated data changes; results in docs/ml/results name the version they used. */
export const GENERATOR_VERSION = "3.0";

export type GroupName = "velocidade" | "intermedio" | "fundo";
export type Phase = "ramp" | "general" | "specific" | "competitive" | "taper" | "transition";
export type EntryError = "minute" | "digits" | "split" | "swap";

export type DataLevel = "completos" | "em-falta";
export type MetersLevel = "baixo" | "base" | "alto";
export type ContextLevel = "nenhum" | "basico" | "carga" | "bem-estar";
export type Variant = { data: DataLevel; meters: MetersLevel; context: ContextLevel };
export const DEFAULT_VARIANT: Variant = { data: "em-falta", meters: "base", context: "carga" };
export const DATA_LEVELS: DataLevel[] = ["completos", "em-falta"];
export const METERS_LEVELS: MetersLevel[] = ["baixo", "base", "alto"];
export const CONTEXT_LEVELS: ContextLevel[] = ["nenhum", "basico", "carga", "bem-estar"];

export type AthleteProfile = {
  sex: "M" | "F";
  primaryStroke: Stroke;
  dateOfBirth: string;
  /** Adult potential: 100 m freestyle, 50 m pool, push start, fresh (s). */
  t100Adult: number;
  /** Growth: potential time = adult × (1 + devA·exp(−(age − 12)/devTau)). */
  devA: number;
  devTau: number;
  riegelShort: number;
  riegelLong: number;
  zone: Record<"SUAVE" | "A1" | "A2" | "A3" | "PROG" | "PA", number>;
  racePaceMult: number;
  strokeMult: Record<Stroke, number>;
  gearMult: Record<Gear, number>;
  /** Seconds a turn saves at race pace; grows on slower laps. */
  turnSec: number;
  turnSlowExp: number;
  blockGainS: number;
  dPrimeM: number;
  dPrimeTauS: number;
  dPrimeKappa: number;
  aerobicDrift: number;
  loadBeforePerKm: number;
  firstRepPct: number;
  morningPct: number;
  secondPct: number;
  sleepPctPerHour: number;
  gymStrengthPct: number;
  gymDays: number[];
  banister: { tau1: number; tau2: number; tau3: number; a1: number; a2: number; a3: number; memory: number };
  /** Fraction of W′ lost per 4 km already swum in the session. */
  volumeSens: number;
  /** How fast W′ follows the anaerobic work of the last weeks (0 = never changes). */
  adaptW: number;
  /** How fast recovery follows short-rest work (0 = never changes). */
  adaptTau: number;
  /** Signed effects on times (+ = slower): gym the same day, gym the day before, per hour of sleep under 8 last night / two nights before. */
  gymSameDay: number;
  gymNextDay: number;
  sleepNight: number;
  sleepTwoNights: number;
  /** Chance of abandoning a set after a rep breaks. */
  abandonShare: number;
  atypical: boolean;
  dayPhi: number;
  daySd: number;
  sessionSd: number;
  repSd: number;
  repDf: number;
  timingSd: number;
  errorRate: number;
  attendance: number;
  logShare: number;
  wellnessShare: number;
};

export type SyntheticAthlete = {
  id: string;
  name: string;
  group: GroupName;
  gender: "M" | "F";
  dateOfBirth: string;
  primaryStroke: Stroke;
  wellness: WellnessEntry[];
  profile: AthleteProfile;
  /** First and last season (index) the athlete trains with the team. */
  joinSeason: number;
  leaveSeason: number;
  /** Weekly snapshot of the parts of capacity that move with training (for parameter recovery). */
  trajectory: { date: string; dPrimeM: number; tauS: number }[];
};

export type RepTruth = {
  athleteId: string;
  /** Everything systematic, including that day's and that session's shock: the within-day floor. */
  expectedS: number;
  /** Best possible estimate the day before: the session shock unknown, the day shock at its AR(1) forecast. */
  dayAheadS: number;
  loggedS: number;
  /** What was actually swum (before any typing error), to the hundredth. */
  swumS: number;
  error: EntryError | null;
  /** "Should do": current form in reference conditions (rested, full reserve, no session volume, no context, no shocks). */
  capacityS: number;
  /** "Will do" without the day and session shocks: everything systematic in the real conditions. */
  systematicS: number;
  /** The rep needed more W′ than was left (it fell off the curve). */
  cliff: boolean;
  /** Set this rep belongs to, the planned number of reps in it, and the first rep (1-based) that hit the cliff. */
  setKey: string;
  setPlanned: number;
  setCliffAt: number | null;
  setAbandoned: boolean;
};

export type SyntheticRace = {
  athleteId: string;
  date: string;
  distanceM: number;
  stroke: Stroke;
  course: PoolCourse;
  priority: "A" | "B";
  expectedS: number;
  timeS: number;
};

export type SyntheticDataset = {
  kind: "synthetic";
  label: string;
  scenario: string;
  variant: Variant;
  seed: number;
  athletes: SyntheticAthlete[];
  workouts: Workout[];
  timeLogs: TimeLog[];
  truth: Map<string, RepTruth>;
  races: SyntheticRace[];
  meets: { date: string; priority: "A" | "B" }[];
  /** First and last day with data entered in the app. */
  dataStart: string;
  dataEnd: string;
  /** Per season: the team's return day and each athlete's own return day. */
  returns: { season: number; team: string; athletes: Record<string, string> }[];
  athleteTypes: Map<string, "típico" | "atípico">;
};

export type ScenarioConfig = {
  label: string;
  athletes: number;
  /** Year of the first season's September return. */
  firstSeason: number;
  seasons: number;
  /** Data window: weeks after the first return, and its length (null = until the end). */
  dataFromWeek: number;
  dataWeeks: number | null;
  /** Weeks of training in the last season before the data ends (null = whole season). */
  lastSeasonWeeks: number | null;
  /** August break before each season after the first, in weeks. */
  breakWeeks: number;
  lateReturnShare: number;
  /** Late-return share in the last season, when it differs (regresso-tardia). */
  lastSeasonLateShare?: number;
  sessionsPerWeek: Record<GroupName, number>;
  /** How keen the coach is on timing (scales the chance a set is timed when data is missing). */
  timingKeenness: number;
  athleteLogShare: [number, number];
  wellnessShare: [number, number];
  errorRate: [number, number];
  /** Athletes joining after the first season (multi-year). */
  arrivals: number;
};

const COMMON = {
  athleteLogShare: [0.6, 0.95] as [number, number],
  wellnessShare: [0.1, 0.6] as [number, number],
  errorRate: [0.003, 0.01] as [number, number],
  sessionsPerWeek: { velocidade: 5, intermedio: 6, fundo: 7 },
  timingKeenness: 0.8,
  lateReturnShare: 0.15,
  breakWeeks: 7,
  arrivals: 0,
};

export const SCENARIOS = {
  arranque: {
    ...COMMON,
    label: "Arranque: 6 semanas a meio da época",
    athletes: 6,
    firstSeason: 2025,
    seasons: 1,
    dataFromWeek: 5,
    dataWeeks: 6,
    lastSeasonWeeks: null,
    sessionsPerWeek: { velocidade: 4, intermedio: 5, fundo: 6 },
    timingKeenness: 0.7,
    athleteLogShare: [0.55, 0.95],
    errorRate: [0.004, 0.012],
  },
  esparso: {
    ...COMMON,
    label: "Esparso: 12 semanas, poucos treinos e tempos",
    athletes: 6,
    firstSeason: 2025,
    seasons: 1,
    dataFromWeek: 0,
    dataWeeks: 12,
    lastSeasonWeeks: null,
    sessionsPerWeek: { velocidade: 3, intermedio: 4, fundo: 5 },
    timingKeenness: 0.55,
    athleteLogShare: [0.5, 0.9],
    wellnessShare: [0, 0.4],
    errorRate: [0.004, 0.012],
  },
  tipico: {
    ...COMMON,
    label: "Típico: 26 semanas desde o regresso de setembro",
    athletes: 8,
    firstSeason: 2025,
    seasons: 1,
    dataFromWeek: 0,
    dataWeeks: 26,
    lastSeasonWeeks: null,
  },
  denso: {
    ...COMMON,
    label: "Denso: 40 semanas, muitos treinos e tempos",
    athletes: 6,
    firstSeason: 2025,
    seasons: 1,
    dataFromWeek: 0,
    dataWeeks: 40,
    lastSeasonWeeks: null,
    sessionsPerWeek: { velocidade: 6, intermedio: 8, fundo: 9 },
    timingKeenness: 1,
    athleteLogShare: [0.7, 1],
    wellnessShare: [0.2, 0.8],
    errorRate: [0.002, 0.008],
  },
  multiano: {
    ...COMMON,
    label: "Multi-ano: 4 épocas com férias de agosto e crescimento",
    athletes: 8,
    firstSeason: 2022,
    seasons: 4,
    dataFromWeek: 0,
    dataWeeks: null,
    lastSeasonWeeks: null,
    arrivals: 2,
  },
  "regresso-curta": {
    ...COMMON,
    label: "Regresso após pausa curta (3 semanas)",
    athletes: 8,
    firstSeason: 2024,
    seasons: 2,
    dataFromWeek: 0,
    dataWeeks: null,
    lastSeasonWeeks: 12,
    breakWeeks: 3,
    lateReturnShare: 0.1,
  },
  "regresso-longa": {
    ...COMMON,
    label: "Regresso após pausa longa (7 semanas)",
    athletes: 8,
    firstSeason: 2024,
    seasons: 2,
    dataFromWeek: 0,
    dataWeeks: null,
    lastSeasonWeeks: 12,
    breakWeeks: 7,
    lateReturnShare: 0.1,
  },
  "regresso-tardia": {
    ...COMMON,
    label: "Regresso tardio: ~40 % dos atletas voltam 3–5 semanas depois",
    athletes: 8,
    firstSeason: 2024,
    seasons: 2,
    dataFromWeek: 0,
    dataWeeks: null,
    lastSeasonWeeks: 12,
    breakWeeks: 7,
    lateReturnShare: 0.1,
    lastSeasonLateShare: 0.4,
  },
} satisfies Record<string, ScenarioConfig>;

export type ScenarioName = keyof typeof SCENARIOS;
export const BASE_SCENARIOS: ScenarioName[] = ["arranque", "esparso", "tipico", "denso"];
export const REGIME_SCENARIOS: ScenarioName[] = ["multiano", "regresso-curta", "regresso-longa", "regresso-tardia"];

const DAY_MS = 86_400_000;
export const dayOf = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
export const isoOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
/** 0 = Monday. */
const weekdayOf = (day: number) => (((day + 3) % 7) + 7) % 7;
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
const GROUPS: GroupName[] = ["velocidade", "intermedio", "fundo"];

/** Physiological load per metre relative to swimming at CS: cubic in relative speed. */
const loadPerMeter = (relSpeed: number) => Math.pow(relSpeed, 3);

/** How much day-to-day form shows in a rep: easy aerobic swimming is paced, hard reps are not. */
const RESPONSIVENESS: Record<Intensity, number> = {
  SUAVE: 0.4,
  A1: 0.5,
  A2: 0.7,
  A3: 0.85,
  PROG: 0.85,
  PA: 1,
  MAX: 1,
  P50: 1,
  P100: 1,
  P200: 1,
  P400: 1,
};

function makeProfile(rng: Rng, group: GroupName, config: ScenarioConfig, birthYearMid: number): AthleteProfile {
  const sex = rng.chance(0.5) ? "M" : "F";
  const talent = clamp(rng.normal(), -2, 2);
  const t100Adult = clamp((sex === "M" ? 55.5 : 61.5) - 2.6 * talent + rng.normal(0, 0.8), 49, 72);
  const riegelShort =
    group === "velocidade" ? rng.uniform(1.07, 1.1) : group === "fundo" ? rng.uniform(1.05, 1.075) : rng.uniform(1.06, 1.085);
  const riegelLong = riegelShort + rng.uniform(-0.025, 0.015);
  const primaryStroke = rng.weighted<Stroke>([
    { value: "free", weight: 4 },
    { value: "back", weight: 2 },
    { value: "breast", weight: 2 },
    { value: "fly", weight: 1.5 },
    { value: "im", weight: 1 },
  ]);
  const strokeMult: Record<Stroke, number> = {
    free: 1,
    back: rng.uniform(1.07, 1.14),
    breast: rng.uniform(1.18, 1.32),
    fly: rng.uniform(1.03, 1.12),
    im: rng.uniform(1.09, 1.16),
  };
  if (primaryStroke !== "free") strokeMult[primaryStroke] -= rng.uniform(0.02, 0.05);
  const logUniform = (lo: number, hi: number) => lo * Math.pow(hi / lo, rng.next());
  const dPrime = group === "velocidade" ? logUniform(15, 50) : group === "fundo" ? logUniform(8, 25) : logUniform(10, 35);
  const birthYear = birthYearMid + rng.int(-3, 3);
  const dateOfBirth = isoOf(dayOf(`${birthYear}-01-01`) + rng.int(0, 364));
  return {
    sex,
    primaryStroke,
    dateOfBirth,
    t100Adult,
    devA: (sex === "F" ? 0.15 : 0.22) * rng.uniform(0.6, 1.4),
    devTau: (sex === "F" ? 2.2 : 3) * rng.uniform(0.8, 1.2),
    riegelShort,
    riegelLong,
    zone: {
      SUAVE: rng.normal(0.79, 0.02),
      A1: rng.normal(0.865, 0.015),
      A2: rng.normal(0.925, 0.015),
      A3: rng.normal(0.99, 0.012),
      PROG: rng.normal(0.97, 0.012),
      PA: rng.normal(1.065, 0.015),
    },
    racePaceMult: rng.uniform(0.975, 1),
    strokeMult,
    gearMult: {
      fins: rng.uniform(0.86, 0.91),
      paddles: rng.uniform(0.95, 0.98),
      pullbuoy: rng.uniform(1.03, 1.08),
      legs: rng.uniform(1.25, 1.5),
      arms: rng.uniform(1.03, 1.08),
      parachute: rng.uniform(1.08, 1.17),
      suit: rng.uniform(0.985, 0.995),
    },
    turnSec: rng.uniform(0.55, 1.05),
    turnSlowExp: rng.uniform(0.5, 1.5),
    blockGainS: rng.uniform(0.5, 1),
    dPrimeM: dPrime,
    dPrimeTauS: 30 * Math.pow(8, rng.next()),
    dPrimeKappa: rng.uniform(0.04, 0.1),
    aerobicDrift: rng.uniform(0.0003, 0.001),
    loadBeforePerKm: rng.uniform(0, 0.0035),
    firstRepPct: rng.normal(0.004, 0.006),
    morningPct: rng.normal(0.006, 0.008),
    secondPct: Math.max(0, rng.normal(0.004, 0.003)),
    sleepPctPerHour: Math.max(0, rng.normal(0.002, 0.0015)),
    gymStrengthPct: Math.max(0, rng.normal(0.007, 0.004)),
    gymDays: rng.chance(0.6) ? [1, 3] : [],
    banister: {
      tau1: rng.uniform(35, 50),
      tau2: rng.uniform(5, 10),
      tau3: rng.uniform(12, 22),
      a1: rng.uniform(0.05, 0.08),
      a2: rng.uniform(0.02, 0.04),
      a3: rng.uniform(0.03, 0.05),
      memory: rng.uniform(0.5, 1.5),
    },
    dayPhi: rng.uniform(0.4, 0.8),
    daySd: rng.uniform(0.005, 0.011),
    sessionSd: rng.uniform(0.003, 0.006),
    repSd: rng.uniform(0.006, 0.013),
    repDf: rng.int(4, 6),
    timingSd: rng.uniform(0.08, 0.2),
    errorRate: rng.uniform(config.errorRate[0], config.errorRate[1]),
    attendance: rng.uniform(0.85, 0.97),
    logShare: rng.uniform(config.athleteLogShare[0], config.athleteLogShare[1]),
    wellnessShare: rng.uniform(config.wellnessShare[0], config.wellnessShare[1]),
    volumeSens: rng.uniform(0.05, 0.3),
    adaptW: rng.uniform(0, 1),
    adaptTau: rng.chance(0.4) ? 0 : rng.uniform(0, 0.6),
    gymSameDay: rng.normal(0.005, 0.008),
    gymNextDay: rng.normal(-0.002, 0.006),
    sleepNight: rng.normal(0.002, 0.003),
    sleepTwoNights: rng.normal(0.001, 0.002),
    abandonShare: rng.uniform(0.3, 0.7),
    atypical: false,
  };
}

/** An athlete who departs from the group on purpose: extreme reserve or recovery, unusual kick, reversed context. */
function makeAtypical(rng: Rng, p: AthleteProfile): AthleteProfile {
  const extremeReserve = rng.chance(0.5);
  return {
    ...p,
    atypical: true,
    dPrimeM: extremeReserve ? (rng.chance(0.5) ? rng.uniform(6, 9) : rng.uniform(45, 60)) : p.dPrimeM,
    dPrimeTauS: extremeReserve ? p.dPrimeTauS : rng.chance(0.5) ? rng.uniform(22, 32) : rng.uniform(220, 320),
    gearMult: { ...p.gearMult, legs: rng.chance(0.5) ? rng.uniform(1.12, 1.18) : rng.uniform(1.55, 1.7) },
    zone: { ...p.zone, A2: p.zone.A2 * (rng.chance(0.5) ? 0.96 : 1.04) },
    morningPct: -Math.abs(p.morningPct) - 0.01,
    gymSameDay: -Math.abs(p.gymSameDay) - 0.006,
    sleepNight: -Math.abs(p.sleepNight),
    gymDays: [1, 3],
  };
}

const ageOn = (p: AthleteProfile, day: number) => (day - dayOf(p.dateOfBirth)) / 365.25;

/** Fresh, max-effort time over `distance` on `day` (50 m pool, push start): growth × piecewise power law. */
function maxTime(p: AthleteProfile, distance: number, day: number): number {
  const t100 = p.t100Adult * (1 + p.devA * Math.exp(-(ageOn(p, day) - 12) / p.devTau));
  const k = distance <= 100 ? p.riegelShort : p.riegelLong;
  return t100 * Math.pow(distance / 100, k);
}

const criticalSpeed = (p: AthleteProfile, day: number) => 1500 / maxTime(p, 1500, day);

function targetSpeed(p: AthleteProfile, intensity: Intensity, distance: number, day: number): number {
  switch (intensity) {
    case "MAX":
      return distance / maxTime(p, distance, day);
    case "P50":
    case "P100":
    case "P200":
    case "P400": {
      const event = Number(intensity.slice(1));
      return (event / maxTime(p, event, day)) * p.racePaceMult;
    }
    default:
      return criticalSpeed(p, day) * p.zone[intensity];
  }
}

/** Extra walls in a 25 m pool compared with a 50 m pool for this distance. */
export const extraTurns = (distance: number) => Math.max(0, Math.ceil(distance / 25) - 1) - Math.max(0, Math.ceil(distance / 50) - 1);

type RepSpec = { distanceM: number; intensity: Intensity; fromBlock: boolean; gear: Gear[]; stroke: Stroke };

/** Fresh time of a rep with everything structural applied (stroke, gear, pool, start). */
function structuralTime(p: AthleteProfile, rep: RepSpec, course: PoolCourse, day: number): { timeS: number; relSpeed: number } {
  const v = targetSpeed(p, rep.intensity, rep.distanceM, day);
  let time = rep.distanceM / v;
  time *= p.strokeMult[rep.stroke];
  for (const gear of rep.gear) time *= p.gearMult[gear];
  if (course === "scm") {
    const lap = time / (rep.distanceM / 25);
    const raceLap = maxTime(p, 100, day) / 4;
    time -= extraTurns(rep.distanceM) * p.turnSec * Math.pow(lap / raceLap, p.turnSlowExp);
  }
  if (rep.fromBlock) time -= p.blockGainS * Math.min(1, rep.distanceM / 50);
  return { timeS: time, relSpeed: rep.distanceM / time / criticalSpeed(p, day) };
}

/* ---------- Sets the coach writes ---------- */

type BuiltSet = {
  rounds: number;
  reps: number;
  distanceM: number;
  intensity: Intensity;
  restS: number;
  fromBlock?: boolean;
  gear?: Gear[];
  stroke?: "free" | "primary" | "im";
  betweenRoundsM?: number;
};

type SetTemplate = {
  key: string;
  weights: Record<Phase, number>;
  group?: Partial<Record<GroupName, number>>;
  build(rng: Rng): BuiltSet;
};

const W = (ramp: number, general: number, specific: number, competitive: number, taper: number): Record<Phase, number> => ({
  ramp,
  general,
  specific,
  competitive,
  taper,
  transition: general * 0.5,
});

const SETS: SetTemplate[] = [
  { key: "a2-100", weights: W(5, 5, 2, 1, 0), build: (r) => ({ rounds: 1, reps: r.int(8, 16), distanceM: 100, intensity: "A2", restS: 15 }) },
  { key: "a2-200", weights: W(3, 4, 1, 0.5, 0), group: { fundo: 2, velocidade: 0.5 }, build: (r) => ({ rounds: 1, reps: r.int(5, 8), distanceM: 200, intensity: "A2", restS: 20 }) },
  { key: "a2-400", weights: W(1, 2, 0.5, 0, 0), group: { fundo: 3, velocidade: 0.2 }, build: (r) => ({ rounds: 1, reps: r.int(3, 5), distanceM: 400, intensity: "A2", restS: 30 }) },
  { key: "a3-100", weights: W(0.5, 2, 4, 2, 0.5), build: (r) => ({ rounds: 1, reps: r.int(8, 12), distanceM: 100, intensity: "A3", restS: 20 }) },
  { key: "a3-200", weights: W(0.3, 1, 3, 1, 0), group: { fundo: 2, velocidade: 0.4 }, build: (r) => ({ rounds: 1, reps: r.int(4, 6), distanceM: 200, intensity: "A3", restS: 30 }) },
  { key: "prog-100", weights: W(0.5, 2, 2, 0.5, 0), build: () => ({ rounds: 3, reps: 4, distanceM: 100, intensity: "PROG", restS: 15, betweenRoundsM: 100 }) },
  { key: "pull-200", weights: W(3, 3, 1, 0.3, 0), build: (r) => ({ rounds: 1, reps: r.int(5, 8), distanceM: 200, intensity: "A2", restS: 20, gear: ["paddles", "pullbuoy"] }) },
  { key: "arms-100", weights: W(1.5, 1.5, 1, 0.3, 0), build: (r) => ({ rounds: 1, reps: r.int(6, 10), distanceM: 100, intensity: "A2", restS: 15, gear: ["arms"] }) },
  { key: "kick-50", weights: W(3, 3, 2, 1, 1), build: (r) => ({ rounds: 1, reps: r.int(8, 12), distanceM: 50, intensity: "A2", restS: 15, gear: ["legs"] }) },
  { key: "kick-fins-25", weights: W(0, 0.5, 1, 1, 1), build: () => ({ rounds: 1, reps: 8, distanceM: 25, intensity: "MAX", restS: 35, gear: ["legs", "fins"] }) },
  { key: "pa-50", weights: W(0.2, 1, 3, 2, 1), build: (r) => ({ rounds: 1, reps: r.int(10, 16), distanceM: 50, intensity: "PA", restS: r.int(25, 35) }) },
  { key: "pa-100", weights: W(0, 0.5, 2, 1, 0), build: (r) => ({ rounds: 1, reps: r.int(5, 8), distanceM: 100, intensity: "PA", restS: 40 }) },
  { key: "p100-50", weights: W(0, 0, 1, 3, 2), group: { velocidade: 2, fundo: 0.3 }, build: (r) => ({ rounds: 1, reps: r.int(6, 8), distanceM: 50, intensity: "P100", restS: r.int(60, 80), fromBlock: true }) },
  { key: "p200-100", weights: W(0, 0, 2, 3, 1), group: { velocidade: 0.4, fundo: 1.5 }, build: (r) => ({ rounds: 1, reps: r.int(5, 8), distanceM: 100, intensity: "P200", restS: 40 }) },
  { key: "p200-broken", weights: W(0, 0, 1, 2, 1), build: () => ({ rounds: 3, reps: 4, distanceM: 50, intensity: "P200", restS: 15, betweenRoundsM: 100 }) },
  { key: "p400-100", weights: W(0, 0, 0.5, 1, 0.5), group: { fundo: 3, velocidade: 0 }, build: () => ({ rounds: 1, reps: 4, distanceM: 100, intensity: "P400", restS: 15 }) },
  { key: "p50-25", weights: W(0, 0, 0.5, 2, 2), group: { velocidade: 3, fundo: 0.3 }, build: () => ({ rounds: 1, reps: 6, distanceM: 25, intensity: "P50", restS: 60, fromBlock: true }) },
  { key: "max-25", weights: W(0, 0.3, 1, 2, 3), group: { velocidade: 2 }, build: (r) => ({ rounds: 1, reps: r.int(6, 8), distanceM: 25, intensity: "MAX", restS: 50, fromBlock: true }) },
  { key: "max-50", weights: W(0, 0, 0.5, 2, 2), build: () => ({ rounds: 1, reps: 4, distanceM: 50, intensity: "MAX", restS: 150, fromBlock: true }) },
  { key: "stroke-50", weights: W(0, 1, 2, 2, 1), build: (r) => ({ rounds: 1, reps: r.int(8, 12), distanceM: 50, intensity: "PA", restS: 30, stroke: "primary" }) },
  { key: "stroke-100", weights: W(1, 2, 2, 1, 0), build: () => ({ rounds: 1, reps: 6, distanceM: 100, intensity: "A3", restS: 20, stroke: "primary" }) },
  { key: "im-100", weights: W(0.5, 1, 1, 0.5, 0), build: (r) => ({ rounds: 1, reps: r.int(4, 6), distanceM: 100, intensity: "A3", restS: 20, stroke: "im" }) },
  { key: "parachute-50", weights: W(0, 0.3, 1, 1, 0), group: { velocidade: 2 }, build: () => ({ rounds: 1, reps: 6, distanceM: 50, intensity: "PA", restS: 40, gear: ["parachute"] }) },
];

/** In the first weeks back only these intensities are swum; the ramp opens up week by week. */
const RAMP_ALLOWED: Intensity[][] = [["A2"], ["A2"], ["A2", "A3", "PROG"], ["A2", "A3", "PROG", "PA"]];

const UNTIMED: Intensity[] = ["SUAVE", "A1"];

/** Chance the coach times a set, by what it is (missing data is informative). */
function timingChance(set: BuiltSet): number {
  const racePace = set.intensity.startsWith("P") && set.intensity !== "PROG" && set.intensity !== "PA";
  const base = racePace || set.intensity === "MAX" ? 0.85 : set.intensity === "PA" ? 0.7 : set.intensity === "A2" ? 0.3 : 0.5;
  return set.gear?.some((gear) => gear === "legs" || gear === "pullbuoy" || gear === "arms") ? base * 0.7 : base;
}

/* ---------- Calendar ---------- */

type Season = {
  index: number;
  returnDay: number;
  endDay: number;
  meets: { day: number; priority: "A" | "B" }[];
  offDays: Set<number>;
  lcmFromDay: number;
  aWeeks: number[];
};

const A_WEEKS = [13, 27, 44];
const B_WEEKS = [6, 10, 19, 23, 32, 36, 40];

function buildSeasons(config: ScenarioConfig): Season[] {
  const sep = dayOf(`${config.firstSeason}-09-15`);
  let returnDay = sep - weekdayOf(sep);
  const seasons: Season[] = [];
  for (let index = 0; index < config.seasons; index += 1) {
    const meets = [
      ...A_WEEKS.map((w) => ({ day: returnDay + w * 7 + 5, priority: "A" as const })),
      ...B_WEEKS.map((w) => ({ day: returnDay + w * 7 + 5, priority: "B" as const })),
    ].sort((a, b) => a.day - b.day);
    const offDays = new Set<number>();
    for (let d = 1; d <= 10; d += 1) offDays.add(returnDay + A_WEEKS[0] * 7 + 5 + d);
    for (let d = 1; d <= 7; d += 1) offDays.add(returnDay + A_WEEKS[1] * 7 + 5 + d);
    const endDay = returnDay + A_WEEKS[2] * 7 + 5;
    seasons.push({ index, returnDay, endDay, meets, offDays, lcmFromDay: returnDay + 30 * 7, aWeeks: A_WEEKS });
    returnDay = endDay + 2 + config.breakWeeks * 7;
  }
  return seasons;
}

function phaseOf(season: Season, day: number): Phase {
  const w = Math.floor((day - season.returnDay) / 7);
  if (w <= 3) return "ramp";
  const next = season.aWeeks.find((a) => a >= w);
  const previous = [...season.aWeeks].reverse().find((a) => a < w);
  if (previous != null && w - previous <= 1) return "transition";
  if (next != null && next - w <= 1) return "taper";
  const sinceCycle = previous == null ? w - 4 : w - previous - 2;
  if (sinceCycle < 5) return "general";
  if (next != null && next - w <= 5) return "competitive";
  return "specific";
}

function weekSlots(sessions: number): { weekday: number; shift: Shift }[] {
  const base: { weekday: number; shift: Shift }[] =
    sessions <= 3
      ? [0, 2, 4].map((weekday) => ({ weekday, shift: "afternoon" as Shift }))
      : sessions === 4
        ? [0, 1, 3, 4].map((weekday) => ({ weekday, shift: "afternoon" as Shift }))
        : [0, 1, 2, 3, 4].map((weekday) => ({ weekday, shift: "afternoon" as Shift }));
  const slots = base.slice(0, Math.min(sessions, base.length));
  if (sessions >= 6) slots.push({ weekday: 5, shift: "morning" });
  for (const weekday of [1, 3, 0, 2, 4].slice(0, Math.max(0, sessions - 6))) slots.push({ weekday, shift: "morning" });
  return slots.sort((a, b) => a.weekday - b.weekday || (a.shift === "morning" ? -1 : 1));
}

/* ---------- Generation ---------- */

type State = {
  fitness: number;
  fatigue: number;
  feel: number;
  peak: number;
  dayShock: number;
  lastTrainingShock: { day: number; value: number } | null;
  /** Anaerobic work (W′ spent, m) and short-rest hard reps, exponentially weighted over ~4 weeks, and their reference levels. */
  anaerobicDose: number;
  shortRestDose: number;
  anaerobicRef: number | null;
  shortRestRef: number | null;
  /** Today's W′ and recovery time constant. */
  dPrimeM: number;
  tauS: number;
  gymYesterday: boolean;
  sleepYesterday: number;
};

function segmentOf(rep: Omit<RepSpec, "stroke"> & { stroke: Stroke | "" }, reps: number, sendOff: number): SetSegment {
  const detail: RepDetail = { intensity: rep.intensity, sendOffSeconds: sendOff, fromBlock: rep.fromBlock, gear: rep.gear, stroke: rep.stroke };
  return {
    reps,
    distanceM: rep.distanceM,
    intensity: rep.intensity,
    sendOffSeconds: sendOff,
    fromBlock: rep.fromBlock,
    gear: rep.gear,
    stroke: rep.stroke,
    splitMarks: [],
    details: Array.from({ length: reps }, () => ({ ...detail, gear: [...detail.gear] })),
  };
}

const roundUp5 = (seconds: number) => Math.min(600, Math.max(30, Math.ceil(seconds / 5) * 5));

function digitsSwap(timeS: number): number {
  const minutes = Math.floor(timeS / 60);
  const seconds = Math.floor(timeS - minutes * 60);
  const cents = timeS - minutes * 60 - seconds;
  const swapped = (seconds % 10) * 10 + Math.floor(seconds / 10);
  // The site's form refuses seconds above 59, so such a slip never reaches the database.
  return swapped > 59 ? Number.NaN : minutes * 60 + swapped + cents;
}

const METERS_FACTOR: Record<MetersLevel, number> = { baixo: 0.7, base: 1, alto: 1.3 };
/** Typical physiological load of one session (calibrated on the generator itself). */
const SESSION_LOAD = 2.6;

type SlotResult = {
  athleteId: string;
  blockId: string;
  repNumber: number;
  stroke: Stroke;
  swum: number;
  expected: number;
  dayAhead: number;
  timed: boolean;
  errorRate: number;
  capacity: number;
  systematic: number;
  cliff: boolean;
  set: { key: string; planned: number; cliffAt: number | null; abandoned: boolean };
};

/** softplus with scale s: smooth max(0, x). */
const softplus = (x: number, s: number) => (x / s > 30 ? x : s * Math.log1p(Math.exp(x / s)));

export type GenerateOptions = {
  /** Id prefix (several teams generated side by side must not share ids). */
  prefix?: string;
  /** Team-level talent shift (log-time, + = slower) — other teams are separate cohorts. */
  talentShift?: number;
  /** Share of atypical athletes (default 0.2). */
  atypicalShare?: number;
};

export function generateDataset(name: ScenarioName | ScenarioConfig, seed: number, variant: Variant = DEFAULT_VARIANT, options: GenerateOptions = {}): SyntheticDataset {
  const config: ScenarioConfig = typeof name === "string" ? SCENARIOS[name] : name;
  const rng = createRng(seed);
  const prefix = options.prefix ?? SYNTHETIC_PREFIX;
  const complete = variant.data === "completos";
  const metersFactor = METERS_FACTOR[variant.meters];
  const seasons = buildSeasons(config);
  const first = seasons[0];
  const last = seasons[seasons.length - 1];
  const dataStart = first.returnDay + config.dataFromWeek * 7;
  const dataEnd =
    config.dataWeeks != null
      ? dataStart + config.dataWeeks * 7 - 1
      : config.lastSeasonWeeks != null
        ? last.returnDay + config.lastSeasonWeeks * 7 - 1
        : last.endDay;
  // Physiology starts with 8 weeks of training before the first August break, so nobody starts at an artificial steady state.
  const preSeasonEnd = first.returnDay - config.breakWeeks * 7 - 2;
  const simStart = preSeasonEnd - 56;

  const athletes: SyntheticAthlete[] = Array.from({ length: config.athletes + config.arrivals }, (_, index) => {
    const group = GROUPS[index % GROUPS.length];
    const base = makeProfile(rng, group, config, config.firstSeason - 15);
    const shifted = options.talentShift ? { ...base, t100Adult: base.t100Adult * Math.exp(options.talentShift) } : base;
    const profile = rng.chance(options.atypicalShare ?? 0.2) ? makeAtypical(rng, shifted) : shifted;
    const arrival = index >= config.athletes;
    const joinSeason = arrival ? Math.min(config.seasons - 1, 1 + (index - config.athletes)) : 0;
    const leaveSeason = !arrival && config.seasons >= 3 && index === config.athletes - 1 ? 1 : config.seasons - 1;
    return {
      id: `${prefix}ath-${String(index + 1).padStart(2, "0")}`,
      name: `Sintético ${index + 1}`,
      group,
      gender: profile.sex,
      dateOfBirth: profile.dateOfBirth,
      primaryStroke: profile.primaryStroke,
      wellness: [],
      profile,
      joinSeason,
      leaveSeason,
      trajectory: [],
    };
  });

  // Individual returns, injuries and illness per season.
  const returns: SyntheticDataset["returns"] = [];
  const personalReturn = new Map<string, number>();
  const unavailable = new Map<string, Set<number>>();
  for (const athlete of athletes) unavailable.set(athlete.id, new Set());
  for (const season of seasons) {
    const record: Record<string, string> = {};
    const lateShare = season.index === seasons.length - 1 && config.lastSeasonLateShare != null ? config.lastSeasonLateShare : config.lateReturnShare;
    for (const athlete of athletes) {
      const late = rng.chance(lateShare) ? rng.int(3, 5) * 7 + rng.int(0, 4) : 0;
      personalReturn.set(`${athlete.id}|${season.index}`, season.returnDay + late);
      record[athlete.id] = isoOf(season.returnDay + late);
      const off = unavailable.get(athlete.id)!;
      if (rng.chance(0.12)) {
        const from = season.returnDay + rng.int(42, 280);
        const length = rng.int(14, 35);
        for (let d = 0; d < length; d += 1) off.add(from + d);
      }
      if (rng.chance(0.5)) {
        const from = season.returnDay + rng.int(14, 290);
        const length = rng.int(4, 10);
        for (let d = 0; d < length; d += 1) off.add(from + d);
      }
    }
    returns.push({ season: season.index, team: isoOf(season.returnDay), athletes: record });
  }

  const seasonOf = (day: number): Season | null => {
    for (let i = seasons.length - 1; i >= 0; i -= 1) if (day >= seasons[i].returnDay) return day <= seasons[i].endDay ? seasons[i] : null;
    return null;
  };

  const steadyDaily = new Map<string, number>();
  for (const athlete of athletes) steadyDaily.set(athlete.id, (config.sessionsPerWeek[athlete.group] * metersFactor * SESSION_LOAD) / 7);

  const state = new Map<string, State>();
  for (const athlete of athletes) {
    const daily = steadyDaily.get(athlete.id)!;
    const b = athlete.profile.banister;
    const fitness = daily / (1 - Math.exp(-1 / b.tau1));
    state.set(athlete.id, {
      fitness,
      fatigue: daily / (1 - Math.exp(-1 / b.tau2)),
      feel: daily / (1 - Math.exp(-1 / b.tau3)),
      peak: fitness,
      dayShock: 0,
      lastTrainingShock: null,
      anaerobicDose: 0,
      shortRestDose: 0,
      anaerobicRef: null,
      shortRestRef: null,
      dPrimeM: athlete.profile.dPrimeM,
      tauS: athlete.profile.dPrimeTauS,
      gymYesterday: false,
      sleepYesterday: 7.6,
    });
  }

  const workouts: Workout[] = [];
  const timeLogs: TimeLog[] = [];
  const truth = new Map<string, RepTruth>();
  const races: SyntheticRace[] = [];
  let workoutCounter = 0;
  let logCounter = 0;
  const slotsByGroup = new Map(GROUPS.map((group) => [group, weekSlots(Math.max(2, Math.round(config.sessionsPerWeek[group] * metersFactor)))]));
  const allMeets = seasons.flatMap((season) => season.meets);

  for (let day = simStart; day <= dataEnd; day += 1) {
    const weekday = weekdayOf(day);
    const season = seasonOf(day);
    const preSeason = day <= preSeasonEnd;
    const phase: Phase | null = season ? phaseOf(season, day) : preSeason ? "specific" : null;
    const inData = day >= dataStart;
    const iso = isoOf(day);
    const seasonWeek = season ? Math.floor((day - season.returnDay) / 7) : 99;

    const formToday = new Map<string, { perf: number; shock: number; forecast: number; sleep: number; sleepBefore: number; gym: boolean; gymYesterday: boolean }>();
    const anaerobicToday = new Map<string, number>();
    const shortRestToday = new Map<string, number>();
    for (const athlete of athletes) {
      const s = state.get(athlete.id)!;
      const p = athlete.profile;
      const b = p.banister;
      const daily = steadyDaily.get(athlete.id)!;
      const ss1 = daily / (1 - Math.exp(-1 / b.tau1));
      const ss2 = daily / (1 - Math.exp(-1 / b.tau2));
      const ss3 = daily / (1 - Math.exp(-1 / b.tau3));
      s.fitness *= Math.exp(-1 / b.tau1);
      s.fatigue *= Math.exp(-1 / b.tau2);
      s.feel *= Math.exp(-1 / b.tau3);
      s.peak = Math.max(s.fitness, s.peak * Math.exp(-1 / 365));
      // Best forecast of today's shock from what could have been observed: the last training day's shock.
      const forecast = s.lastTrainingShock ? Math.pow(p.dayPhi, day - s.lastTrainingShock.day) * s.lastTrainingShock.value : 0;
      s.dayShock = p.dayPhi * s.dayShock + rng.normal(0, p.daySd * Math.sqrt(1 - p.dayPhi ** 2));
      const feel = Math.min(1.1, s.feel / ss3);
      const perf = b.a1 * (s.fitness / ss1 - 1) - b.a2 * (s.fatigue / ss2 - 1) - b.a3 * Math.max(0, 1 - feel);
      const sleep = clamp(Math.round(rng.normal(7.6, 0.9) * 2) / 2, 4.5, 10);
      // Capacity dimension by dimension: W′ follows recent anaerobic work, recovery follows short-rest work.
      if (s.anaerobicRef != null && s.anaerobicRef > 0) {
        s.dPrimeM = p.dPrimeM * clamp(1 + p.adaptW * 0.5 * (s.anaerobicDose / s.anaerobicRef - 1), 0.75, 1.6);
      }
      if (s.shortRestRef != null && s.shortRestRef > 0) {
        s.tauS = p.dPrimeTauS * clamp(1 - p.adaptTau * 0.4 * (s.shortRestDose / s.shortRestRef - 1), 0.6, 1.25);
      }
      if (weekday === 0 && day >= dataStart) athlete.trajectory.push({ date: iso, dPrimeM: s.dPrimeM, tauS: s.tauS });
      formToday.set(athlete.id, {
        perf,
        shock: s.dayShock,
        forecast,
        sleep,
        sleepBefore: s.sleepYesterday,
        gym: p.gymDays.includes(weekday) && phase !== "taper" && phase !== "ramp",
        gymYesterday: s.gymYesterday,
      });
    }

    const isActive = (athlete: SyntheticAthlete) => {
      const index = season ? season.index : 0;
      if (index < athlete.joinSeason || index > athlete.leaveSeason) return false;
      if (preSeason) return athlete.joinSeason === 0;
      if (!season) return false;
      if (day < personalReturn.get(`${athlete.id}|${season.index}`)!) return false;
      return !unavailable.get(athlete.id)!.has(day);
    };

    const dailyLoad = new Map<string, number>();
    const sessionsToday = new Map<string, number>();
    const meetToday = allMeets.find((meet) => meet.day === day);

    if (meetToday && inData && season) {
      for (const athlete of athletes) {
        if (!isActive(athlete)) continue;
        const p = athlete.profile;
        const form = formToday.get(athlete.id)!;
        const course: PoolCourse = day >= season.lcmFromDay ? "lcm" : "scm";
        const events: number[] = athlete.group === "velocidade" ? [50, 100] : athlete.group === "fundo" ? [200, 400] : [100, 200];
        for (const distanceM of events) {
          const stroke = distanceM >= 400 ? "free" : p.primaryStroke;
          const rep: RepSpec = { distanceM, intensity: "MAX", fromBlock: true, gear: [], stroke };
          const structural = structuralTime(p, rep, course, day);
          const expected = structural.timeS * (1 - form.perf - 0.01) * (1 + form.shock) * p.gearMult.suit;
          races.push({
            athleteId: athlete.id,
            date: iso,
            distanceM,
            stroke,
            course,
            priority: meetToday.priority,
            expectedS: expected,
            timeS: Math.round(expected * (1 + rng.normal(0, 0.006)) * 100) / 100,
          });
        }
      }
    }

    const teamTrains = phase != null && !meetToday && !(season?.offDays.has(day) ?? false);
    if (teamTrains) {
      for (const group of GROUPS) {
        const members = athletes.filter((athlete) => athlete.group === group);
        const active = members.filter(isActive);
        if (!active.length) continue;
        for (const slot of slotsByGroup.get(group)!.filter((item) => item.weekday === weekday)) {
          if ((phase === "taper" || (phase === "ramp" && seasonWeek <= 1)) && slot.shift === "morning") continue;
          if (phase === "transition" && rng.chance(0.3)) continue;
          const present = active.filter((athlete) => rng.chance(athlete.profile.attendance));
          if (!present.length) continue;
          const course: PoolCourse = season && day >= season.lcmFromDay ? (rng.chance(0.7) ? "lcm" : "scm") : rng.chance(0.08) ? "lcm" : "scm";
          const ref = members[0].profile;
          const refTime = (rep: RepSpec) => active.reduce((sum, athlete) => sum + structuralTime(athlete.profile, rep, course, day).timeS, 0) / active.length;
          const refCs = criticalSpeed(ref, day);

          const blocks: WorkoutBlock[] = [
            {
              id: "b1",
              type: "warmup",
              rounds: 1,
              noSendOff: false,
              betweenRounds: null,
              segments: [
                segmentOf({ distanceM: 400, intensity: "SUAVE", fromBlock: false, gear: [], stroke: "" }, 1, roundUp5(400 / (refCs * 0.8) + 20)),
                segmentOf({ distanceM: 50, intensity: "A1", fromBlock: false, gear: [], stroke: "" }, 6, roundUp5(50 / (refCs * 0.87) + 15)),
              ],
            },
          ];
          const rampScale = phase === "ramp" ? 0.6 + 0.1 * seasonWeek : 1;
          let setCount = phase === "taper" ? 1 : phase === "general" ? rng.int(2, 3) : rng.int(1, 3);
          if (metersFactor < 1 && setCount > 1 && rng.chance(0.5)) setCount -= 1;
          if (metersFactor > 1 && rng.chance(0.5)) setCount += 1;
          const used = new Set<string>();
          const primaryBlocks = new Set<string>();
          const builtByBlock = new Map<string, BuiltSet>();
          const allowed = phase === "ramp" ? RAMP_ALLOWED[Math.min(3, seasonWeek)] : null;
          for (let k = 0; k < setCount; k += 1) {
            const template = rng.weighted(
              SETS.filter((item) => !used.has(item.key)).map((item) => ({
                value: item,
                weight: phase ? item.weights[phase] * (item.group?.[group] ?? 1) + 1e-6 : 1,
              })),
            );
            used.add(template.key);
            const built = template.build(rng);
            if (allowed && !allowed.includes(built.intensity)) {
              built.intensity = "A2";
              built.fromBlock = false;
            }
            built.reps = Math.max(3, Math.round(built.reps * rampScale * Math.sqrt(metersFactor)));
            const stroke: Stroke = built.stroke === "im" ? "im" : "free";
            const repSpec: RepSpec = {
              distanceM: built.distanceM,
              intensity: built.intensity,
              fromBlock: Boolean(built.fromBlock),
              gear: built.gear ?? [],
              stroke: built.stroke === "primary" ? ref.primaryStroke : stroke,
            };
            const sendOff = roundUp5(refTime(repSpec) + built.restS);
            const id = `b${blocks.length + 1}`;
            if (built.stroke === "primary") primaryBlocks.add(id);
            builtByBlock.set(id, built);
            blocks.push({
              id,
              type: "main",
              rounds: built.rounds,
              noSendOff: false,
              betweenRounds: built.betweenRoundsM ? { distanceM: built.betweenRoundsM } : null,
              segments: [segmentOf({ ...repSpec, stroke: built.stroke === "primary" || repSpec.stroke === "free" ? "" : repSpec.stroke }, built.reps, sendOff)],
            });
          }
          // Untimed aerobic volume (continuous A1 / pull), the bulk of the metres.
          if (phase !== "taper" && rng.chance(0.75)) {
            const reps = Math.max(1, Math.round(rng.int(2, 4) * metersFactor * (phase === "ramp" ? 0.7 : 1)));
            blocks.push({
              id: `b${blocks.length + 1}`,
              type: "main",
              rounds: 1,
              noSendOff: false,
              betweenRounds: null,
              segments: [segmentOf({ distanceM: 400, intensity: "A1", fromBlock: false, gear: rng.chance(0.4) ? ["pullbuoy"] : [], stroke: "" }, reps, roundUp5(400 / (refCs * 0.865) + 30))],
            });
          }
          blocks.push({
            id: `b${blocks.length + 1}`,
            type: "recovery",
            rounds: 1,
            noSendOff: false,
            betweenRounds: null,
            segments: [segmentOf({ distanceM: 200, intensity: "SUAVE", fromBlock: false, gear: [], stroke: "" }, 1, roundUp5(200 / (refCs * 0.8) + 20))],
          });

          // What the coach enters in the app.
          const recorded = inData && (complete || rng.chance(0.92));
          const noTimesToday = !complete && rng.chance(0.2);
          const timedBlocks = new Set(
            blocks
              .filter((block) => block.type === "main" && !UNTIMED.includes(block.segments[0].intensity))
              .filter((block) => complete || (!noTimesToday && rng.chance(Math.min(0.97, timingChance(builtByBlock.get(block.id)!) * config.timingKeenness))))
              .map((block) => block.id),
          );

          const results: SlotResult[] = [];
          for (const athlete of present) {
            const p = athlete.profile;
            const form = formToday.get(athlete.id)!;
            const sessionIndex = (sessionsToday.get(athlete.id) ?? 0) + 1;
            sessionsToday.set(athlete.id, sessionIndex);
            const sessionShock = rng.normal(0, p.sessionSd);
            const cs = criticalSpeed(p, day);
            const s = state.get(athlete.id)!;
            const context =
              (slot.shift === "morning" ? p.morningPct : 0) +
              (sessionIndex > 1 ? p.secondPct : 0) +
              p.sleepNight * Math.max(0, 8 - form.sleep) +
              p.sleepTwoNights * Math.max(0, 8 - form.sleepBefore) +
              (form.gym && slot.shift === "afternoon" ? p.gymSameDay : 0) +
              (form.gymYesterday ? p.gymNextDay : 0);
            const timedHere = complete || rng.chance(p.logShare);
            let metersBefore = 0;
            let load = 0;
            for (const block of blocks) {
              const segment = block.segments[0];
              const primary = primaryBlocks.has(block.id);
              const innerReps = block.segments.reduce((sum, item) => sum + item.reps, 0);
              for (let round = 1; round <= block.rounds; round += 1) {
                // The reserve available for this set: today's W′, less what the session's volume has already cost.
                const wMax = s.dPrimeM * (1 - p.volumeSens * Math.min(1.5, metersBefore / 4000));
                let dBal = wMax;
                const set = { key: `${block.id}|${round}`, planned: segment.reps, cliffAt: null as number | null, abandoned: false };
                for (let item = 0; item < segment.reps; item += 1) {
                  const stroke: Stroke = primary ? p.primaryStroke : segment.stroke && segment.stroke !== "sub" ? segment.stroke : "free";
                  const rep: RepSpec = { distanceM: segment.distanceM, intensity: segment.intensity, fromBlock: segment.fromBlock, gear: segment.gear, stroke };
                  const structural = structuralTime(p, rep, course, day);
                  const capacity = structural.timeS * (1 - RESPONSIVENESS[rep.intensity] * form.perf);
                  const deficit = 1 - clamp(dBal / Math.max(1, wMax), 0, 1);
                  const wPenalty = p.dPrimeKappa * 0.5 * deficit ** 2;
                  const drift = UNTIMED.includes(rep.intensity) ? 0 : structural.relSpeed < 1 ? p.aerobicDrift * item : 0;
                  const loadPenalty = RESPONSIVENESS[rep.intensity] >= 0.85 ? p.loadBeforePerKm * (metersBefore / 1000) : 0;
                  const intended = capacity * (1 + context) * (1 + wPenalty + drift + loadPenalty + (item === 0 ? p.firstRepPct : 0));
                  // The cliff: not enough W′ left to hold the intended pace — the rest of the rep is swum at critical speed.
                  const need = Math.max(0, (rep.distanceM / intended - cs) * intended);
                  const atCs = (rep.distanceM - Math.max(0, dBal)) / cs;
                  const cliff = need > dBal && atCs > intended;
                  const systematic = cliff ? intended + softplus(atCs - intended, 0.25) : intended;
                  if (cliff && set.cliffAt == null) set.cliffAt = item + 1;
                  const expected = systematic * (1 + RESPONSIVENESS[rep.intensity] * form.shock) * (1 + sessionShock);
                  const dayAhead = systematic * (1 + RESPONSIVENESS[rep.intensity] * form.forecast);
                  const observed = expected * (1 + p.repSd * rng.studentT(p.repDf)) + rng.normal(0, p.timingSd);
                  const swum = Math.max(rep.distanceM * 0.45, observed);
                  const speed = rep.distanceM / swum;
                  if (speed > cs) {
                    dBal -= (speed - cs) * swum;
                    anaerobicToday.set(athlete.id, (anaerobicToday.get(athlete.id) ?? 0) + (speed - cs) * swum);
                  }
                  const rest = Math.max(5, segment.sendOffSeconds - swum);
                  if (speed > cs && rest < swum) shortRestToday.set(athlete.id, (shortRestToday.get(athlete.id) ?? 0) + 1);
                  dBal = wMax - (wMax - dBal) * Math.exp(-rest / s.tauS);
                  metersBefore += rep.distanceM;
                  load += (rep.distanceM * loadPerMeter(structural.relSpeed)) / 1000;
                  // A broken rep is sometimes not logged (the coach skips a bad time).
                  const skippedBad = cliff && systematic / intended > 1.06 && rng.chance(0.3);
                  const timed = recorded && timedHere && timedBlocks.has(block.id) && !skippedBad && (complete || rng.chance(0.96));
                  results.push({
                    athleteId: athlete.id,
                    blockId: block.id,
                    repNumber: (round - 1) * innerReps + item + 1,
                    stroke,
                    swum,
                    expected,
                    dayAhead,
                    timed,
                    errorRate: p.errorRate,
                    capacity,
                    systematic,
                    cliff,
                    set,
                  });
                  // After a clear break some swimmers stop: the rest of the set is never swum or logged (censored).
                  if (cliff && systematic / intended > 1.06 && item < segment.reps - 1 && rng.chance(p.abandonShare)) {
                    set.abandoned = true;
                    break;
                  }
                }
                if (block.betweenRounds && round < block.rounds) {
                  metersBefore += block.betweenRounds.distanceM;
                  load += (block.betweenRounds.distanceM * loadPerMeter(0.8)) / 1000;
                }
              }
            }
            dailyLoad.set(athlete.id, (dailyLoad.get(athlete.id) ?? 0) + load);
          }

          if (!recorded) continue;
          // Typing errors, including two swimmers' times swapped in the same rep.
          const logged = new Map<SlotResult, { value: number; error: EntryError | null }>();
          for (const result of results) if (result.timed) logged.set(result, { value: Math.round(result.swum * 100) / 100, error: null });
          for (const [result, entry] of logged) {
            if (entry.error || !rng.chance(result.errorRate)) continue;
            const kind = rng.weighted<EntryError>([
              { value: "minute", weight: 3 },
              { value: "digits", weight: 3 },
              { value: "split", weight: result.swum >= 50 ? 2 : 0.5 },
              { value: "swap", weight: 2 },
            ]);
            if (kind === "swap") {
              const partner = [...logged.keys()].find(
                (other) => other !== result && other.blockId === result.blockId && other.repNumber === result.repNumber && !logged.get(other)!.error,
              );
              if (!partner) continue;
              const mine = entry.value;
              entry.value = logged.get(partner)!.value;
              entry.error = "swap";
              logged.set(partner, { value: mine, error: "swap" });
              continue;
            }
            let value = entry.value;
            if (kind === "minute") value += value > 75 && rng.chance(0.5) ? -60 : 60;
            else if (kind === "digits") value = digitsSwap(value);
            else value = value * rng.uniform(0.47, 0.5);
            if (!Number.isFinite(value)) continue;
            entry.value = Math.max(0.5, Math.round(value * 100) / 100);
            entry.error = kind;
          }

          const loggedBlocks = new Set([...logged.keys()].map((result) => result.blockId));
          const stored = blocks.filter((block) =>
            variant.context === "nenhum" ? loggedBlocks.has(block.id) : variant.context === "basico" ? block.type === "main" : true,
          );
          if (!stored.length) continue;
          workoutCounter += 1;
          const workoutId = `${prefix}wk-${String(workoutCounter).padStart(5, "0")}`;
          const listed = present.map((athlete) => athlete.id);
          if (!complete) for (const athlete of active) if (!present.includes(athlete) && rng.chance(0.03)) listed.push(athlete.id);
          workouts.push({ id: workoutId, title: `Sintético ${phase}`, date: iso, shift: slot.shift, course, athleteIds: listed, blocks: stored, groups: [group], focus: "" });

          for (const result of results) {
            if (!result.timed) continue;
            logCounter += 1;
            const logId = `${prefix}log-${String(logCounter).padStart(6, "0")}`;
            const entry = logged.get(result)!;
            const total = Math.round(entry.value * 100);
            timeLogs.push({
              id: logId,
              workoutId,
              blockId: result.blockId,
              athleteId: result.athleteId,
              repNumber: result.repNumber,
              mm: Math.floor(total / 6000),
              ss: Math.floor((total % 6000) / 100),
              cc: total % 100,
              splits: [],
              stroke: result.stroke,
              pending: false,
              recordedAt: `${iso}T18:00:00Z`,
            });
            truth.set(logId, {
              athleteId: result.athleteId,
              expectedS: result.expected,
              dayAheadS: result.dayAhead,
              loggedS: entry.value,
              swumS: Math.round(result.swum * 100) / 100,
              error: entry.error,
              capacityS: result.capacity,
              systematicS: result.systematic,
              cliff: result.cliff,
              setKey: `${workoutId}|${result.athleteId}|${result.set.key}`,
              setPlanned: result.set.planned,
              setCliffAt: result.set.cliffAt,
              setAbandoned: result.set.abandoned,
            });
          }
        }
      }
    }

    // Impulse after today's training, with muscle memory below the earlier peak; then wellness.
    for (const athlete of athletes) {
      const s = state.get(athlete.id)!;
      const b = athlete.profile.banister;
      const load = dailyLoad.get(athlete.id) ?? (meetToday && isActive(athlete) ? 1.5 : 0);
      const memoryBoost = 1 + b.memory * Math.max(0, (s.peak - s.fitness) / s.peak);
      s.fitness += load * memoryBoost;
      s.fatigue += load;
      s.feel += Math.min(load, steadyDaily.get(athlete.id)!);
      const form = formToday.get(athlete.id)!;
      if (dailyLoad.has(athlete.id)) s.lastTrainingShock = { day, value: form.shock };
      s.anaerobicDose = s.anaerobicDose * Math.exp(-1 / 28) + (anaerobicToday.get(athlete.id) ?? 0);
      s.shortRestDose = s.shortRestDose * Math.exp(-1 / 28) + (shortRestToday.get(athlete.id) ?? 0);
      // The training the athlete was used to before the data starts is the reference for adaptation.
      if (day === preSeasonEnd) {
        s.anaerobicRef = Math.max(1, s.anaerobicDose);
        s.shortRestRef = Math.max(0.5, s.shortRestDose);
      }
      s.gymYesterday = form.gym && dailyLoad.has(athlete.id);
      s.sleepYesterday = form.sleep;
      if (variant.context === "bem-estar" && inData && sessionsToday.has(athlete.id)) {
        const share = complete ? 1 : Math.min(0.95, athlete.profile.wellnessShare * (form.sleep < 7 ? 1.6 : 1));
        if (rng.chance(share)) {
          athlete.wellness.push({
            date: iso,
            sleepHours: form.sleep,
            gym: form.gym ? "strength" : null,
            recovery: clamp(Math.round(3 + form.perf * 60 + rng.normal(0, 0.7)), 1, 5),
          });
        }
      }
    }
  }

  return {
    kind: "synthetic",
    label: config.label,
    scenario: typeof name === "string" ? name : config.label,
    variant,
    seed,
    athletes,
    workouts,
    timeLogs,
    truth,
    races,
    meets: allMeets.filter((meet) => meet.day >= dataStart && meet.day <= dataEnd).map((meet) => ({ date: isoOf(meet.day), priority: meet.priority })),
    dataStart: isoOf(dataStart),
    dataEnd: isoOf(dataEnd),
    returns,
    athleteTypes: new Map(athletes.map((athlete) => [athlete.id, athlete.profile.atypical ? "atípico" : "típico"])),
  };
}

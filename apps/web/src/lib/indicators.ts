import { BANDS, type Band, type PhaseKind } from "./season";
import { isPlausibleRep, type TrainingRep } from "./training-context";
import type { Intensity } from "./types";

/*
 * Swimming indicators for the coach (docs/natacao/indicadores.md: definition, formula, source, limits).
 * Pure functions over the reps the app already annotates (training-context.ts); no model involved.
 */

/** Critical swim speed pace (s/100 m) from two maximal efforts, d1 < d2 (Wakayoshi; 200/400 is the product's test). */
export function cssPace(d1: number, t1: number, d2: number, t2: number): number | null {
  if (!(d2 > d1) || !(t2 > t1) || t1 <= 0) return null;
  return (100 * (t2 - t1)) / (d2 - d1);
}

/**
 * Speed of each training zone as a fraction of the CSS speed: referencias.md §4.1 (% column, estimates).
 * Percentages scale with any level; the seconds offsets of the same table disagree with them at fast or slow CSS.
 */
const ZONE_SPEED: Partial<Record<Intensity, [number, number]>> = {
  SUAVE: [0.75, 0.84],
  A1: [0.84, 0.9],
  A2: [0.92, 0.95],
  A3: [0.96, 0.99],
  PA: [1.02, 1.06],
};

export type ZoneTarget = { intensity: Intensity; fromS100: number; toS100: number };

/** Target pace range (s/100 m, 50 m pool) per zone for an athlete with this CSS. Race pace and MAX come from best times. */
export function zoneTargets(css: number): ZoneTarget[] {
  return (Object.entries(ZONE_SPEED) as [Intensity, [number, number]][]).map(([intensity, [slow, fast]]) => ({
    intensity,
    fromS100: css / fast,
    toS100: css / slow,
  }));
}

export type Adherence = "dentro" | "rapido" | "lento";

/** Within the zone's range ± 1 s/100 m (below the day-to-day noise of 1–2 %, referencias §4.4). */
export function intensityAdherence(paceS100: number, target: ZoneTarget, toleranceS = 1): Adherence {
  if (paceS100 < target.fromS100 - toleranceS) return "rapido";
  if (paceS100 > target.toS100 + toleranceS) return "lento";
  return "dentro";
}

export const paceS100 = (row: Pick<TrainingRep, "timeS" | "distanceM">) => (row.timeS / row.distanceM) * 100;
/** A 25 m pool is faster through the walls: freestyle 50 m ≈ 25 m × 1.02–1.04 (referencias §2.1, estimate 1.03). */
export const SCM_TO_LCM = 1.03;
/** Pace in 50 m pool terms, so zone targets from a long-course CSS apply in both pools. */
export const lcmPaceS100 = (row: Pick<TrainingRep, "timeS" | "distanceM" | "course">) => paceS100(row) * (row.course === "scm" ? SCM_TO_LCM : 1);

/** Fade within a set (%): mean of the second half over the first half, minus 1. Positive = slowed down. */
export function fadeIndex(times: number[]): number | null {
  if (times.length < 4) return null;
  const half = Math.floor(times.length / 2);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return (mean(times.slice(times.length - half)) / mean(times.slice(0, half)) - 1) * 100;
}

/** 2nd 50 vs 1st 50 in a 100 (%). Elite 100 free ≈ +9 % (referencias §2.4). */
export function splitDifferential(first50: number, total100: number): number | null {
  const second = total100 - first50;
  if (first50 <= 0 || second <= 0) return null;
  return (second / first50 - 1) * 100;
}

/** SWOLF = seconds + strokes per length. Only comparable within the same swimmer and pool (referencias §5). */
export const swolf = (lengthTimeS: number, strokes: number) => lengthTimeS + strokes;
/** Distance per stroke cycle (m/cycle) and stroke rate (cycles/min). */
export const distancePerStroke = (distanceM: number, cycles: number) => (cycles > 0 ? distanceM / cycles : null);
export const strokeRate = (cycles: number, timeS: number) => (timeS > 0 ? (cycles / timeS) * 60 : null);

/** % slower than the athlete's best (0 = equal to the best). */
export const pctOfBest = (timeS: number, bestS: number) => (timeS / bestS - 1) * 100;

/** Six levels by World Aquatics points (referencias §1.6). */
export const LEVEL_POINTS: { level: string; from: number }[] = [
  { level: "Elite mundial", from: 870 },
  { level: "Internacional", from: 750 },
  { level: "Nacional absoluto", from: 600 },
  { level: "Nacional jovem", from: 450 },
  { level: "Regional", from: 300 },
  { level: "Iniciação", from: 0 },
];
export const levelOfPoints = (points: number) => LEVEL_POINTS.find((item) => points >= item.from)!.level;

/** Change of the latest value against the mean of the previous ones (%), and whether it exceeds the noise. */
export function trend(latest: number, previous: number[], noisePct: number): { pct: number; real: boolean } | null {
  if (!previous.length) return null;
  const base = previous.reduce((a, b) => a + b, 0) / previous.length;
  if (base <= 0) return null;
  const pct = (latest / base - 1) * 100;
  return { pct, real: Math.abs(pct) > noisePct };
}

/**
 * Share of volume per band expected for each phase (%, [min, max]). Estimate from coaching practice
 * (referencias §4.2): no verified source gives these ranges, so the screen labels them "referência indicativa".
 */
export const PHASE_BANDS: Record<PhaseKind, Partial<Record<Band, [number, number]>>> = {
  general: { easy: [40, 60], aerobic: [25, 40], threshold: [5, 15], high: [0, 8], race: [0, 5] },
  specific: { easy: [35, 50], aerobic: [20, 35], threshold: [10, 20], high: [5, 12], race: [5, 12] },
  competitive: { easy: [35, 55], aerobic: [15, 30], threshold: [5, 15], high: [5, 15], race: [10, 20] },
  taper: { easy: [40, 60], aerobic: [10, 25], threshold: [0, 10], high: [5, 15], race: [10, 25] },
  transition: { easy: [70, 100], aerobic: [0, 30], threshold: [0, 5], high: [0, 5], race: [0, 5] },
};

export const BAND_LABEL = new Map(BANDS.map((item) => [item.band, item.label]));

/* ---------- Training signals (docs/natacao/produto-treinador.md §C) ---------- */

export type SignalKind = "base-aerobia" | "intensidade-acima" | "carga-acima" | "queda-ritmo" | "taper" | "sem-dados";
export type Signal = {
  kind: SignalKind;
  /** The data that triggers it, already formatted with units. */
  data: string;
  uncertainty: "baixa" | "média" | "alta";
};

export type SignalInput = {
  /** This athlete's reps, oldest first (annotateTrainingReps). */
  reps: TrainingRep[];
  /** Weekly training load, oldest first, last = current week. */
  weeklyLoad: number[];
  css: number | null;
  /** Date of the CSS test, when the CSS comes from one: an old test makes the intensity signal less certain. */
  cssDate?: string;
  phase: PhaseKind | null;
  daysToMeetA: number | null;
  today: string;
};

const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

/** Rule-based signals: each one only fires on what the evidence supports, and never claims certainty. */
export function trainingSignals(input: SignalInput): Signal[] {
  const out: Signal[] = [];
  const recent = input.reps.filter((row) => isPlausibleRep(row) && daysBetween(row.date, input.today) <= 21 && daysBetween(row.date, input.today) >= 0);
  const sessions = new Set(recent.filter((row) => daysBetween(row.date, input.today) <= 14).map((row) => row.workoutId));
  if (sessions.size < 3) return [{ kind: "sem-dados", data: `${sessions.size} sessões com tempos em 14 dias`, uncertainty: "alta" }];

  if (input.daysToMeetA != null && input.daysToMeetA >= 0 && input.daysToMeetA <= 21)
    out.push({ kind: "taper", data: `próxima prova daqui a ${input.daysToMeetA} dias`, uncertainty: "média" });

  const load = input.weeklyLoad;
  // Only against four weeks that all had training: coming back from a break is a ramp, not a load spike.
  const change = load.length >= 5 && load.slice(-5, -1).every((x) => x > 0) ? trend(load[load.length - 1], load.slice(-5, -1), 30) : null;
  if (change && change.real && change.pct > 0) out.push({ kind: "carga-acima", data: `carga +${Math.round(change.pct)} % vs média das 4 semanas`, uncertainty: "média" });

  const meters = recent.reduce((sum, row) => sum + row.distanceM, 0);
  const aerobic = recent.filter((row) => ["SUAVE", "A1", "A2"].includes(row.intensity)).reduce((sum, row) => sum + row.distanceM, 0);
  const range = input.phase ? PHASE_BANDS[input.phase] : null;
  if (range && meters > 0 && (input.phase === "general" || input.phase === "specific")) {
    const min = (range.easy?.[0] ?? 0) + (range.aerobic?.[0] ?? 0);
    const share = (aerobic / meters) * 100;
    if (share < min) out.push({ kind: "base-aerobia", data: `${Math.round(share)} % do volume em Suave/A1/A2 (referência ≥ ${min} %)`, uncertainty: "alta" });
  }

  if (input.css != null) {
    const targets = new Map(zoneTargets(input.css).map((item) => [item.intensity, item]));
    const aerobicReps = recent.filter((row) => (row.intensity === "A1" || row.intensity === "A2") && row.gear.length === 0 && row.stroke === "free");
    if (aerobicReps.length >= 10) {
      const fast = aerobicReps.filter((row) => lcmPaceS100(row) < targets.get(row.intensity)!.fromS100 - 2).length;
      const share = (fast / aerobicReps.length) * 100;
      const weeks = input.cssDate ? Math.floor(daysBetween(input.cssDate, input.today) / 7) : 0;
      if (share >= 30)
        out.push({
          kind: "intensidade-acima",
          data: `${Math.round(share)} % das reps A1/A2 mais de 2 s/100 m abaixo do alvo${weeks > 8 ? ` (CSS de um teste com ${weeks} semanas)` : ""}`,
          uncertainty: weeks > 8 ? "alta" : "média",
        });
    }
  }

  const fades = (rows: TrainingRep[]) => {
    const sets = new Map<string, number[]>();
    for (const row of rows) if (row.blockType === "main") sets.set(`${row.workoutId}|${row.blockId}|${row.round}`, [...(sets.get(`${row.workoutId}|${row.blockId}|${row.round}`) ?? []), row.timeS]);
    return [...sets.values()].map(fadeIndex).filter((x): x is number => x != null);
  };
  const all = input.reps.filter(isPlausibleRep);
  const last2w = fades(all.filter((row) => daysBetween(row.date, input.today) <= 14 && daysBetween(row.date, input.today) >= 0));
  const before = fades(all.filter((row) => daysBetween(row.date, input.today) > 14 && daysBetween(row.date, input.today) <= 70));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  if (last2w.length >= 4 && before.length >= 8 && mean(last2w) - mean(before) > 1.5)
    out.push({ kind: "queda-ritmo", data: `queda média nas séries ${mean(last2w).toFixed(1)} % (habitual ${mean(before).toFixed(1)} %)`, uncertainty: "média" });

  return out;
}

/* ---------- CSS of an athlete, shared by the profile and the workout analysis ---------- */

export type CssEstimate = { value: number; source: "teste" | "provas-200-400" | "provas-100-200"; date?: string };

type RecordLike = { course: string; stroke: string; distanceM: number; mm: number; ss: number; cc: number };

/**
 * The latest 400/200 test swum in training (≤ 26 weeks) first; else 200/400 race bests in the same pool; else
 * 100/200 bests (reads faster than the test, so the screen labels it). Long course first.
 */
export function cssOf(reps: TrainingRep[], records: RecordLike[], today: string): CssEstimate | null {
  const from = new Date(Date.parse(today) - 182 * DAY_MS).toISOString().slice(0, 10);
  const maxFree = reps.filter((row) => row.intensity === "MAX" && row.stroke === "free" && !row.gear.length && row.date >= from && row.date <= today);
  for (const r400 of maxFree.filter((row) => row.distanceM === 400).reverse()) {
    const r200 = maxFree.find((row) => row.workoutId === r400.workoutId && row.distanceM === 200);
    const k = r400.course === "scm" ? SCM_TO_LCM : 1;
    const value = r200 ? cssPace(200, r200.timeS * k, 400, r400.timeS * k) : null;
    if (value) return { value, source: "teste", date: r400.date };
  }
  const timeOf = (r: RecordLike) => r.mm * 60 + r.ss + r.cc / 100;
  for (const [d1, d2] of [
    [200, 400],
    [100, 200],
  ])
    for (const course of ["lcm", "scm"]) {
      const a = records.find((r) => r.course === course && r.stroke === "free" && r.distanceM === d1);
      const b = records.find((r) => r.course === course && r.stroke === "free" && r.distanceM === d2);
      const value = a && b ? cssPace(d1, timeOf(a), d2, timeOf(b)) : null;
      if (value) return { value: value * (course === "scm" ? SCM_TO_LCM : 1), source: d1 === 100 ? "provas-100-200" : "provas-200-400" };
    }
  return null;
}

/* ---------- Race plan ---------- */

/**
 * Share of the race time per 50 m when the athlete has no race with splits (referencias §2.4): the first 50 carries
 * the dive; 100 ≈ +9 % on the 2nd 50; 200 ≈ 24 / 25,4 / 25,4 / 25,2 %; longer races even after the first 50.
 */
export function referenceFractions(distanceM: number): number[] {
  const laps = Math.floor(distanceM / 50);
  if (laps === 2) return [0.4785, 0.5215];
  if (laps === 4) return [0.24, 0.254, 0.254, 0.252];
  const first = 0.94 / laps;
  return [first, ...Array.from({ length: laps - 1 }, () => (1 - first) / (laps - 1))];
}

/** Fractions per 50 m from cumulative splits (time at each 50 m mark); null if the splits are incomplete. */
export function fractionsFromSplits(splits: { atM: number; mm: number; ss: number; cc: number }[], distanceM: number): number[] | null {
  const at50 = splits.filter((s) => s.atM % 50 === 0).sort((a, b) => a.atM - b.atM);
  if (at50.length !== Math.floor(distanceM / 50) || at50[at50.length - 1].atM !== distanceM) return null;
  const cum = at50.map((s) => s.mm * 60 + s.ss + s.cc / 100);
  const total = cum[cum.length - 1];
  return cum.map((c, i) => (c - (i ? cum[i - 1] : 0)) / total);
}

/** Target time per 50 m and cumulative, for a target final time. */
export function splitPlan(targetS: number, fractions: number[]): { atM: number; lapS: number; cumulativeS: number }[] {
  let cumulative = 0;
  return fractions.map((f, i) => {
    const lapS = targetS * f;
    cumulative += lapS;
    return { atM: (i + 1) * 50, lapS, cumulativeS: cumulative };
  });
}

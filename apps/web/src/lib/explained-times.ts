import { tx, type MessageKey } from "@/i18n";
import { addDays, weekStartMonday } from "./dates";
import { fadeIndex } from "./indicators";
import { attribute } from "./ml/attribution";
import { workoutMeters } from "./rankings";
import { planContext } from "./season";
import type { TrainingRep } from "./training-context";
import { groupKey, type FactorShare, type RepExplanation } from "./training-prediction";
import type { SeasonPlan, WellnessEntry, Workout } from "./types";

/*
 * "Tempos explicados": the model's own split of each time (explainTrainingTargets) summed over a
 * session or a week, compared between two days, followed through the season and inside a set.
 * Everything is association, never cause: the context part did not pass the backtest.
 */

/** Below ≈ 1 % a gap is noise (indicadores.md, "% do melhor") and is not explained. */
export const NOISE_PCT = 1;
/** Compared as shown (one decimal), so "+1,0 %" is never called noise. */
export const isNoise = (pct: number) => Math.round(Math.abs(pct) * 10) / 10 < NOISE_PCT;

export type ExplainedRep = RepExplanation & { row: TrainingRep };

export type Breakdown = {
  reps: number;
  levelS: number;
  /** Largest first; level + Σ seconds = expectedS. */
  factors: FactorShare[];
  expectedS: number;
  actualS: number;
  marginS: number;
  /** Real − expected: what no factor explains. */
  unexplainedS: number;
  /** Real vs level, in %. */
  devPct: number;
  noise: boolean;
  /** Reps without sleep logged: the sleep factor could not count there. */
  noSleep: number;
};

export function breakdown(list: ExplainedRep[]): Breakdown | null {
  if (!list.length) return null;
  const merged = new Map<string, FactorShare>();
  let levelS = 0;
  let expectedS = 0;
  let actualS = 0;
  let marginS = 0;
  for (const rep of list) {
    levelS += rep.levelS;
    expectedS += rep.expectedS;
    actualS += rep.actualS;
    // ponytail: margin of a sum = sum of margins (reps of one day move together); tighter needs the within-day correlation.
    marginS += rep.marginS;
    for (const factor of rep.factors) {
      const known = merged.get(factor.key);
      if (known) {
        known.seconds += factor.seconds;
        known.support = Math.min(known.support, factor.support);
      } else merged.set(factor.key, { ...factor });
    }
  }
  const factors = [...merged.values()]
    .map((factor) => ({ ...factor, pct: (factor.seconds / levelS) * 100 }))
    .sort((a, b) => Math.abs(b.seconds) - Math.abs(a.seconds));
  const devPct = (actualS / levelS - 1) * 100;
  return {
    reps: list.length,
    levelS,
    factors,
    expectedS,
    actualS,
    marginS,
    unexplainedS: actualS - expectedS,
    devPct,
    noise: isNoise(devPct),
    noSleep: list.filter((rep) => rep.row.sleepHours == null).length,
  };
}

export const sessionKey = (row: TrainingRep) => `${row.date}|${row.workoutId}`;

const comma = (value: number, digits: number) => value.toFixed(digits).replace(".", ",");
/** Signed %, never a bare "0 %". */
export const pctText = (value: number) => (Math.abs(value) < 0.05 ? "< 0,1 %" : `${value > 0 ? "+" : "−"}${comma(Math.abs(value), 1)} %`);
export const secText = (value: number) => (Math.abs(value) < 0.005 ? "< 0,01 s" : `${value > 0 ? "+" : "−"}${comma(Math.abs(value), 2)} s`);

/** Athlete's km per week (Monday), from the workouts they were in. */
export function weeklyKm(workouts: Workout[], athleteId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const workout of workouts) {
    if (!workout.athleteIds.includes(athleteId)) continue;
    const week = weekStartMonday(workout.date);
    out.set(week, (out.get(week) ?? 0) + workoutMeters(workout) / 1000);
  }
  return out;
}

export type DayPoint = {
  date: string;
  /** Mean real-vs-level gap of the day's reps, in %. */
  devPct: number;
  n: number;
  /** Mean over the reps of the 7 days ending here. */
  rollingPct: number;
  /** The whole day was off in one direction (attribution "dia-anormal"). */
  abnormal: boolean;
};

const gapPct = (rep: ExplainedRep) => (rep.actualS / rep.levelS - 1) * 100;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function formDays(list: ExplainedRep[]): DayPoint[] {
  const causes = attribute(
    list.map((rep) => ({
      outcome: {
        id: rep.row.log.id,
        athleteId: "a",
        model: "atual",
        date: rep.row.date,
        repKey: rep.row.log.id,
        meanS: rep.expectedS,
        loS: null,
        hiS: null,
        sdS: rep.marginS,
        actualS: rep.actualS,
        errorPct: ((rep.expectedS - rep.actualS) / rep.actualS) * 100,
        inside: null,
        crpsPct: null,
        logId: rep.row.log.id,
      },
      row: rep.row,
    })),
  );
  const byDay = new Map<string, ExplainedRep[]>();
  for (const rep of list) byDay.set(rep.row.date, [...(byDay.get(rep.row.date) ?? []), rep]);
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, reps]) => {
      const from = addDays(date, -6);
      const window = list.filter((rep) => rep.row.date >= from && rep.row.date <= date);
      return {
        date,
        devPct: mean(reps.map(gapPct)),
        n: reps.length,
        rollingPct: mean(window.map(gapPct)),
        abnormal: reps.some((rep) => causes.get(rep.row.log.id)?.cause === "dia-anormal"),
      };
    });
}

export type Change = { label: string; a: string; b: string; same: boolean };

const one = (value: number) => comma(value, 1);
const GYM: Record<string, MessageKey> = { strength: "Força", explosive: "Explosão", mobility: "Mobilidade" };

function streakBefore(date: string, days: Set<string>): number {
  let count = 0;
  while (days.has(addDays(date, -(count + 1)))) count += 1;
  return count;
}

/** What differed between two days of the same kind of set: data only, no statistics. */
export function sessionChanges(a: TrainingRep[], b: TrainingRep[], wellness: WellnessEntry[], trainingDays: Set<string>): Change[] {
  const missing = tx("não registado");
  const day = (rows: TrainingRep[]) => wellness.find((entry) => entry.date === rows[0].date);
  const eve = (rows: TrainingRep[]) => wellness.find((entry) => entry.date === addDays(rows[0].date, -1));
  const fields: { label: MessageKey; value: (rows: TrainingRep[]) => string | null }[] = [
    { label: "Sono (h)", value: (rows) => (day(rows)?.sleepHours == null ? null : one(day(rows)!.sleepHours!)) },
    { label: "Esforço (RPE)", value: (rows) => (day(rows)?.rpe == null ? null : String(day(rows)!.rpe)) },
    { label: "Recuperação (1–5)", value: (rows) => (day(rows)?.recovery == null ? null : String(day(rows)!.recovery)) },
    { label: "km na semana antes", value: (rows) => one(rows[0].weeklyLoadM / 1000) },
    { label: "km antes no treino", value: (rows) => one(rows[0].loadBeforeM / 1000) },
    { label: "Dias seguidos de treino", value: (rows) => String(streakBefore(rows[0].date, trainingDays)) },
    { label: "Saída", value: (rows) => rows[0].restLabel || null },
    { label: "Turno", value: (rows) => tx(rows[0].shift === "morning" ? "Manhã" : "Tarde") },
    { label: "Ginásio na véspera", value: (rows) => (eve(rows) ? (eve(rows)!.gym ? tx(GYM[eve(rows)!.gym!]) : tx("Não")) : null) },
  ];
  return fields.map((field) => {
    const va = field.value(a) ?? missing;
    const vb = field.value(b) ?? missing;
    return { label: tx(field.label), a: va, b: vb, same: va === vb };
  });
}

export type SetInfo = { key: string; group: string; date: string; reps: ExplainedRep[] };

/** One set = one segment of a block, all rounds, same group (as hardSets in training-prediction). */
export function setsOf(list: ExplainedRep[]): SetInfo[] {
  const sets = new Map<string, SetInfo>();
  for (const rep of list) {
    const key = `${rep.row.workoutId}|${rep.row.blockId}|${rep.row.segmentIndex}|${groupKey(rep.row)}`;
    const set = sets.get(key) ?? { key, group: groupKey(rep.row), date: rep.row.date, reps: [] };
    set.reps.push(rep);
    sets.set(key, set);
  }
  for (const set of sets.values()) set.reps.sort((a, b) => a.row.round - b.row.round || a.row.repInSegment - b.row.repInSegment);
  return [...sets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type SetCurve = {
  times: number[];
  /** Usual time at each position in earlier equal sets (same group and rep count), on today's level. */
  usual: (number | null)[];
  usualN: number;
  fadePct: number | null;
  usualFadePct: number | null;
  /** Coefficient of variation of the set, in %, and its usual value. */
  cvPct: number | null;
  usualCvPct: number | null;
};

const cv = (times: number[]) => {
  if (times.length < 3) return null;
  const m = mean(times);
  return (Math.sqrt(times.reduce((sum, value) => sum + (value - m) ** 2, 0) / (times.length - 1)) / m) * 100;
};

export function setCurve(set: SetInfo, all: SetInfo[]): SetCurve {
  const times = set.reps.map((rep) => rep.actualS);
  const equal = all.filter((other) => other.date < set.date && other.group === set.group && other.reps.length === set.reps.length);
  const level = set.reps[0].levelS;
  return {
    times,
    usual: times.map((_, i) => {
      const ratio = median(equal.map((other) => other.reps[i].actualS / other.reps[i].levelS));
      return ratio == null ? null : ratio * level;
    }),
    usualN: equal.length,
    fadePct: fadeIndex(times),
    usualFadePct: median(equal.map((other) => fadeIndex(other.reps.map((rep) => rep.actualS))).filter((v): v is number => v != null)),
    cvPct: cv(times),
    usualCvPct: median(equal.map((other) => cv(other.reps.map((rep) => rep.actualS))).filter((v): v is number => v != null)),
  };
}

export type LoadPoint = { week: string; km: number; devPct: number; n: number; phase: string | null };

export function loadPoints(list: ExplainedRep[], km: Map<string, number>, plans: SeasonPlan[]): LoadPoint[] {
  const byWeek = new Map<string, number[]>();
  for (const rep of list) {
    const week = weekStartMonday(rep.row.date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), gapPct(rep)]);
  }
  return [...byWeek.entries()]
    .filter(([week]) => km.has(week))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, gaps]) => ({
      week,
      km: km.get(week)!,
      devPct: mean(gaps),
      n: gaps.length,
      phase: planContext(plans, week)?.macro?.type ?? null,
    }));
}

export const MIN_LOAD_WEEKS = 6;

/** Least-squares slope of the weekly gap on km, per +10 km, with ± 2 standard errors. */
export function loadSlope(points: LoadPoint[]): { per10Pct: number; marginPct: number; n: number } | null {
  const n = points.length;
  if (n < MIN_LOAD_WEEKS) return null;
  const mx = mean(points.map((p) => p.km));
  const my = mean(points.map((p) => p.devPct));
  const sxx = points.reduce((sum, p) => sum + (p.km - mx) ** 2, 0);
  if (sxx <= 0) return null;
  const slope = points.reduce((sum, p) => sum + (p.km - mx) * (p.devPct - my), 0) / sxx;
  const sse = points.reduce((sum, p) => sum + (p.devPct - my - slope * (p.km - mx)) ** 2, 0);
  const se = Math.sqrt(sse / (n - 2) / sxx);
  return { per10Pct: slope * 10, marginPct: 2 * se * 10, n };
}

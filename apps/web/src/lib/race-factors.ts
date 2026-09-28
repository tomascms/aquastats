import type { MessageKey } from "@/i18n";
import { raceSegments, raceSummary } from "./race-analysis";
import { workoutMeters } from "./rankings";
import { workoutBands } from "./season";
import type { TrainingRep } from "./training-context";
import { formBefore } from "./training-prediction";
import type { RaceSession, WellnessEntry, Workout } from "./types";

/*
 * Race metrics × preparation. For every analysed race we measure what happened in the water
 * (reaction, 15 m, underwater, turns, finish, stroke rate/length, fade) and what came before it
 * (training volume, taper, rest, sleep, recovery, gym), then look for consistent relationships
 * across the athlete's races. Correlations need at least 4 races and are reported with their n.
 */

export type MetricKey =
  | "final"
  | "reaction"
  | "flight"
  | "at15"
  | "uwTime"
  | "uwDist"
  | "uwKicks"
  | "turn"
  | "finish"
  | "sr"
  | "dps"
  | "fade";

export type FactorKey = "speed28" | "hold28" | "quality28" | "vol21" | "hard21" | "restDays21" | "lastRest" | "taper" | "sleep7" | "recovery7" | "gym7";

export const METRICS: { key: MetricKey; label: MessageKey; unit: string; lowerIsBetter: boolean; digits: number }[] = [
  { key: "final", label: "Tempo final", unit: "s", lowerIsBetter: true, digits: 2 },
  { key: "reaction", label: "Reação", unit: "s", lowerIsBetter: true, digits: 2 },
  { key: "flight", label: "Voo", unit: "s", lowerIsBetter: true, digits: 2 },
  { key: "at15", label: "15 m", unit: "s", lowerIsBetter: true, digits: 2 },
  { key: "uwTime", label: "Subaquático (tempo)", unit: "s", lowerIsBetter: false, digits: 2 },
  { key: "uwDist", label: "Subaquático (distância)", unit: "m", lowerIsBetter: false, digits: 1 },
  { key: "uwKicks", label: "Pernadas UW", unit: "", lowerIsBetter: false, digits: 1 },
  { key: "turn", label: "Viragem (média)", unit: "s", lowerIsBetter: true, digits: 2 },
  { key: "finish", label: "Chegada", unit: "s", lowerIsBetter: true, digits: 2 },
  { key: "sr", label: "Frequência (SR)", unit: "c/min", lowerIsBetter: false, digits: 1 },
  { key: "dps", label: "Distância por braçada", unit: "m", lowerIsBetter: false, digits: 2 },
  { key: "fade", label: "Quebra de velocidade", unit: "%", lowerIsBetter: true, digits: 1 },
];

export const FACTORS: { key: FactorKey; label: MessageKey; unit: string; digits: number }[] = [
  { key: "speed28", label: "Mais rápido no treino do que o habitual (28 dias)", unit: "%", digits: 1 },
  { key: "hold28", label: "Quebra nas séries fortes face ao habitual (28 dias)", unit: "pp", digits: 1 },
  { key: "quality28", label: "Reps fortes ao nível habitual por semana (28 dias)", unit: "", digits: 1 },
  { key: "vol21", label: "Volume nos 21 dias antes", unit: "km", digits: 1 },
  { key: "hard21", label: "Intensidade alta nos 21 dias (A3, PA/MAX, ritmo de prova)", unit: "%", digits: 0 },
  { key: "restDays21", label: "Dias de descanso nos 21 dias", unit: "d", digits: 0 },
  { key: "lastRest", label: "Dias sem treinar antes da prova", unit: "d", digits: 0 },
  { key: "taper", label: "Redução de carga na última semana", unit: "%", digits: 0 },
  { key: "sleep7", label: "Sono (7 noites antes)", unit: "h", digits: 1 },
  { key: "recovery7", label: "Recuperação sentida (7 dias, 1–5)", unit: "", digits: 1 },
  { key: "gym7", label: "Ginásio nos 7 dias antes", unit: "sessões", digits: 0 },
];

export type RaceFactsRow = {
  session: RaceSession;
  metrics: Partial<Record<MetricKey, number>>;
  factors: Partial<Record<FactorKey, number>>;
};

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);
const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN);

function metricsOf(session: RaceSession): Partial<Record<MetricKey, number>> {
  const summary = raceSummary(session);
  const segments = raceSegments(session);
  const turns = segments.filter((segment) => segment.kind === "turn").map((segment) => segment.timeS);
  const finish = segments.find((segment) => segment.kind === "finish")?.timeS;
  const out: Partial<Record<MetricKey, number>> = {};
  const put = (key: MetricKey, value: number | undefined) => {
    if (value != null && Number.isFinite(value) && value > 0) out[key] = value;
  };
  put("final", summary.finalS);
  put("reaction", summary.reactionS);
  put("flight", session.flightS);
  put("at15", summary.startS);
  put("uwTime", mean(summary.underwater.map((item) => item.timeS).filter((value) => value > 0)));
  put("uwDist", mean(summary.underwater.map((item) => item.distanceM).filter((value) => value > 0)));
  put("uwKicks", mean(summary.underwater.map((item) => item.kicks).filter((value) => value > 0)));
  put("turn", mean(turns));
  put("finish", finish);
  put("sr", summary.avgSr);
  put("dps", summary.avgDps);
  if (summary.fadePct > 0) out.fade = summary.fadePct;
  return out;
}

function factorsOf(session: RaceSession, workouts: Workout[], wellness: WellnessEntry[], reps: TrainingRep[]): Partial<Record<FactorKey, number>> {
  const date = session.date;
  const mine = workouts.filter((workout) => workout.athleteIds.includes(session.athleteId) && workout.date < date);
  const within = (from: number, to: number) =>
    mine.filter((workout) => {
      const days = daysBetween(date, workout.date);
      return days >= from && days <= to;
    });
  const meters = (list: Workout[]) => list.reduce((sum, workout) => sum + workoutMeters(workout), 0);
  const last21 = within(1, 21);
  const out: Partial<Record<FactorKey, number>> = {};
  // Form from every rep of the previous weeks, each against its own group — not only reps of the race distance.
  const form = formBefore(reps, date);
  if (form.speedPct != null && form.speedN >= 6) out.speed28 = -form.speedPct;
  if (form.holdPct != null) out.hold28 = form.holdPct;
  if (form.qualityPerWeek != null) out.quality28 = form.qualityPerWeek;
  if (last21.length) {
    out.vol21 = meters(last21) / 1000;
    const bands = last21.map((workout) => workoutBands(workout).bands);
    const total = bands.reduce((sum, band) => sum + band.easy + band.aerobic + band.threshold + band.high + band.race, 0);
    const hard = bands.reduce((sum, band) => sum + band.threshold + band.high + band.race, 0);
    if (total > 0) out.hard21 = Math.round((hard / total) * 100);
    out.restDays21 = 21 - new Set(last21.map((workout) => workout.date)).size;
    const before = within(8, 21);
    if (before.length) out.taper = Math.round((1 - meters(within(1, 7)) / (meters(before) / 2)) * 100);
  }
  const lastDate = mine.reduce<string>((max, workout) => (workout.date > max ? workout.date : max), "");
  if (lastDate) out.lastRest = Math.max(0, daysBetween(date, lastDate) - 1);

  const week = wellness.filter((entry) => {
    const days = daysBetween(date, entry.date);
    return days >= 0 && days <= 7;
  });
  const nights = week.filter((entry) => daysBetween(date, entry.date) >= 1 && entry.sleepHours != null);
  if (nights.length) out.sleep7 = mean(nights.map((entry) => entry.sleepHours ?? 0));
  const feel = week.filter((entry) => entry.recovery).map((entry) => entry.recovery ?? 0);
  if (feel.length) out.recovery7 = mean(feel);
  if (wellness.length) out.gym7 = week.filter((entry) => daysBetween(date, entry.date) >= 1 && entry.gym).length;
  return out;
}
export function raceFacts(sessions: RaceSession[], workouts: Workout[], wellness: WellnessEntry[] = [], reps: TrainingRep[] = []): RaceFactsRow[] {
  return sessions
    .map((session) => ({ session, metrics: metricsOf(session), factors: factorsOf(session, workouts, wellness, reps) }))
    .sort((a, b) => a.session.date.localeCompare(b.session.date));
}

function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  xs.forEach((x, index) => {
    num += (x - mx) * (ys[index] - my);
    dx += (x - mx) ** 2;
    dy += (ys[index] - my) ** 2;
  });
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}

export type Finding = { metric: MetricKey; factor: FactorKey; r: number; n: number; helps: boolean };

/**
 * Relationships that hold across the athlete's races. `helps` means more of the factor went with a
 * better value of the metric. Only |r| ≥ 0.5 with n ≥ 4 is reported.
 */
export function findings(rows: RaceFactsRow[]): Finding[] {
  const out: Finding[] = [];
  for (const metric of METRICS) {
    for (const factor of FACTORS) {
      const pairs = rows
        .map((row) => [row.factors[factor.key], row.metrics[metric.key]] as const)
        .filter((pair): pair is readonly [number, number] => pair[0] != null && pair[1] != null);
      if (pairs.length < 4) continue;
      const r = pearson(pairs.map((pair) => pair[0]), pairs.map((pair) => pair[1]));
      if (Math.abs(r) < 0.5) continue;
      out.push({ metric: metric.key, factor: factor.key, r, n: pairs.length, helps: metric.lowerIsBetter ? r < 0 : r > 0 });
    }
  }
  return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 6);
}

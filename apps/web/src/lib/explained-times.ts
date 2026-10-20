import { tx, type MessageKey } from "@/i18n";
import type { Msg } from "./coach-analysis";
import { addDays, weekStartMonday } from "./dates";
import { fadeIndex } from "./indicators";
import { attribute } from "./ml/attribution";
import { workoutMeters } from "./rankings";
import type { TrainingRep } from "./training-context";
import { groupKey, type FactorShare, type LearnedEffect, type RepExplanation } from "./training-prediction";
import type { Gender, WellnessEntry, Workout } from "./types";

/*
 * "Tempos explicados" in a coach's words: the model's own split of each time (explainTrainingTargets)
 * turned into three states (faster / normal / slower than usual) and at most three reasons, each said as
 * what "usually coincides" with the time in this swimmer's records. Association, never cause: the context
 * part did not pass the backtest. Numbers stay in the details.
 */

/** Below ≈ 1 % a gap is noise (indicadores.md, "% do melhor") and is not explained. */
export const NOISE_PCT = 1;
/** Compared as shown (one decimal), so "+1,0 %" is never called noise. */
export const isNoise = (pct: number) => Math.round(Math.abs(pct) * 10) / 10 < NOISE_PCT;

export type ExplainedRep = RepExplanation & { row: TrainingRep };
export type RepState = "faster" | "normal" | "slower";
export type Who = Gender | "";

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const r1 = (value: number) => Math.round(value * 10) / 10;
const comma = (value: number, digits: number) => value.toFixed(digits).replace(".", ",");

export const gapPct = (rep: ExplainedRep) => (rep.actualS / rep.levelS - 1) * 100;
/** Seconds per 100 m faster (−) or slower (+) than usual. */
const per100 = (rep: ExplainedRep) => ((rep.actualS - rep.levelS) / rep.row.distanceM) * 100;
export const stateOf = (pct: number): RepState => (isNoise(pct) ? "normal" : pct > 0 ? "slower" : "faster");
export const repState = (rep: ExplainedRep) => stateOf(gapPct(rep));
export const sessionKey = (row: TrainingRep) => `${row.date}|${row.workoutId}`;
export const pctText = (value: number) => (Math.abs(value) < 0.05 ? "< 0,1 %" : `${value > 0 ? "+" : "−"}${comma(Math.abs(value), 1)} %`);
export const secText = (value: number) => (Math.abs(value) < 0.005 ? "< 0,01 s" : `${value > 0 ? "+" : "−"}${comma(Math.abs(value), 2)} s`);

/* ---------- Reasons ---------- */

export type Reason = { key: string; slower: boolean; seconds: number; msg: Msg };

const WEEKDAY_WHEN: MessageKey[] = ["treino à segunda", "treino à terça", "treino à quarta", "treino à quinta", "treino à sexta", "treino ao sábado", "treino ao domingo"];
const GYM_DAY: Record<string, MessageKey> = { gymStrength: "ginásio de força nesse dia", gymExplosive: "ginásio explosivo nesse dia", gymMobility: "mobilidade nesse dia" };

/** Consecutive training days before `date`. */
function streakBefore(date: string, days: Set<string>): number {
  let count = 0;
  while (days.has(addDays(date, -(count + 1)))) count += 1;
  return count;
}

/** Length of the last break of 10+ days before `date` (as the model's "return" factor), or null. */
function lastBreak(date: string, sorted: string[]): number | null {
  const earlier = sorted.filter((day) => day <= date);
  for (let i = earlier.length - 1; i > 0; i -= 1) {
    if (addDays(earlier[i], 42) < date) return null;
    const gap = Math.round((Date.parse(earlier[i]) - Date.parse(earlier[i - 1])) / 86_400_000);
    if (gap >= 10) return gap;
  }
  return null;
}

/** One factor of one rep, said the way a coach would. */
function reasonMsg(key: string, row: TrainingRep, days: Set<string>, sorted: string[]): Msg | null {
  if (key.startsWith("weekday-")) return { key: WEEKDAY_WHEN[Number(key.slice(8))] };
  if (GYM_DAY[key]) return { key: GYM_DAY[key] };
  switch (key) {
    case "morning":
      return { key: "treino de manhã" };
    case "second":
      return { key: "2.º treino do dia" };
    case "position":
      return { key: "fim da série" };
    case "block":
      return { key: "partida do bloco" };
    case "sendoff":
      return row.restLabel ? { key: "saída de {rest}", vars: { rest: row.restLabel } } : null;
    case "loadBefore":
      return { key: "já tinha nadado {km} km no treino", vars: { km: r1(row.loadBeforeM / 1000) } };
    case "weekly":
      return { key: "{km} km nessa semana", vars: { km: Math.round(row.weeklyLoadM / 1000) } };
    case "streak":
      return { key: "{n}.º dia seguido de treino", vars: { n: streakBefore(row.date, days) + 1 } };
    case "return": {
      const gap = lastBreak(row.date, sorted);
      return gap ? { key: "voltou de {d} dias sem treinar", vars: { d: gap } } : null;
    }
    case "sleep":
      return row.sleepHours == null ? null : { key: "dormiu {h} h", vars: { h: r1(row.sleepHours) } };
    default:
      return null; // "trend" and pooled low-data factors are not reasons a coach can act on or check.
  }
}

/** The factors of a group of reps, summed, said in words; largest first. Only factors worth ≥ 0,2 % of the time. */
export function reasonsFor(reps: ExplainedRep[], days: Set<string>): Reason[] {
  const sorted = [...days].sort();
  const total = reps.reduce((sum, rep) => sum + rep.levelS, 0);
  const sums = new Map<string, { seconds: number; best: { rep: ExplainedRep; factor: FactorShare } }>();
  for (const rep of reps) {
    for (const factor of rep.factors) {
      const known = sums.get(factor.key);
      if (!known) sums.set(factor.key, { seconds: factor.seconds, best: { rep, factor } });
      else {
        known.seconds += factor.seconds;
        if (Math.abs(factor.seconds) > Math.abs(known.best.factor.seconds)) known.best = { rep, factor };
      }
    }
  }
  const out: Reason[] = [];
  for (const [key, { seconds, best }] of sums) {
    if (Math.abs(seconds / total) < 0.002) continue;
    const msg = reasonMsg(key, best.rep.row, days, sorted);
    if (msg) out.push({ key, slower: seconds > 0, seconds, msg });
  }
  return out.sort((a, b) => Math.abs(b.seconds) - Math.abs(a.seconds));
}

/** Reasons that go the same way as the time (what coincides with slower, or with faster). */
export const reasonsMatching = (reasons: Reason[], state: RepState, max = 3) =>
  state === "normal" ? [] : reasons.filter((reason) => reason.slower === (state === "slower")).slice(0, max);

export function joinMsgs(items: Msg[]): Msg {
  if (items.length === 1) return items[0];
  if (items.length === 2) return { key: "{a} e {b}", vars: { a: items[0], b: items[1] } };
  return { key: "{a}, {b} e {c}", vars: { a: items[0], b: items[1], c: items[2] } };
}

const RECORDS: Record<Who, { some: MessageKey; none: MessageKey }> = {
  F: { some: "Nos registos dela, isto costuma coincidir com: {list}.", none: "Nos registos dela, nada costuma coincidir com isto." },
  M: { some: "Nos registos dele, isto costuma coincidir com: {list}.", none: "Nos registos dele, nada costuma coincidir com isto." },
  "": { some: "Nos registos do atleta, isto costuma coincidir com: {list}.", none: "Nos registos do atleta, nada costuma coincidir com isto." },
};

/** "Nos registos dela, isto costuma coincidir com: dormiu 6 h e 4.º dia seguido de treino." */
export function whyMsg(reasons: Reason[], who: Who, noSleep: boolean): Msg {
  const words = RECORDS[who] ?? RECORDS[""];
  const why: Msg = reasons.length ? { key: words.some, vars: { list: joinMsgs(reasons.map((reason) => reason.msg)) } } : { key: words.none };
  return noSleep ? { key: "{why} Sono não registado.", vars: { why } } : why;
}

/* ---------- A. One rep ---------- */

export type RepRead = { state: RepState; line: Msg; why: Msg | null };

/** "1,9 s mais rápida do que costuma" and why, or "dentro do habitual, nada a explicar". */
export function readRep(rep: ExplainedRep, days: Set<string>, who: Who): RepRead {
  const state = repState(rep);
  const s = r1(Math.abs(rep.actualS - rep.levelS));
  if (state === "normal") return { state, line: { key: "dentro do habitual, nada a explicar" }, why: null };
  return {
    state,
    line: { key: state === "slower" ? "{s} s mais lenta do que costuma" : "{s} s mais rápida do que costuma", vars: { s } },
    why: whyMsg(reasonsMatching(reasonsFor([rep], days), state), who, rep.row.sleepHours == null),
  };
}

/** Session line: "3 reps mais lentas do que costuma, quase todas no fim das séries; 4.º dia seguido de treino." */
export function sessionLine(reps: ExplainedRep[], days: Set<string>): Msg | null {
  if (!reps.length) return null;
  const slower = reps.filter((rep) => repState(rep) === "slower");
  const faster = reps.filter((rep) => repState(rep) === "faster");
  if (!slower.length && !faster.length) return { key: "Todas as reps dentro do habitual." };
  const state: RepState = slower.length >= faster.length ? "slower" : "faster";
  const off = state === "slower" ? slower : faster;
  const late = off.filter((rep) => rep.row.segmentReps > 1 && rep.row.repInSegment > rep.row.segmentReps / 2).length;
  const count: Msg = {
    key: state === "slower" ? "{count} reps mais lentas do que costuma" : "{count} reps mais rápidas do que costuma",
    vars: { count: off.length },
  };
  const where: Msg = off.length >= 2 && late / off.length >= 0.6 ? { key: "{a}, quase todas no fim das séries", vars: { a: count } } : count;
  const reason = reasonsMatching(reasonsFor(off, days), state, 1)[0];
  return reason ? { key: "{a}; {b}.", vars: { a: where, b: reason.msg } } : { key: "{a}.", vars: { a: where } };
}

/* ---------- B and E. One set ---------- */

export type SetInfo = { key: string; group: string; date: string; reps: ExplainedRep[] };

/** One set = one segment of a block in one round, same group (as session-report's sets). */
export function setsOf(list: ExplainedRep[]): SetInfo[] {
  const sets = new Map<string, SetInfo>();
  for (const rep of list) {
    const key = `${rep.row.workoutId}|${rep.row.blockId}|${rep.row.segmentIndex}|${rep.row.round}|${groupKey(rep.row)}`;
    const set = sets.get(key) ?? { key, group: groupKey(rep.row), date: rep.row.date, reps: [] };
    set.reps.push(rep);
    sets.set(key, set);
  }
  for (const set of sets.values()) set.reps.sort((a, b) => a.row.repInSegment - b.row.repInSegment);
  return [...sets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const equalBefore = (set: SetInfo, all: SetInfo[]) => all.filter((other) => other.date < set.date && other.group === set.group && other.reps.length === set.reps.length);

/** Fade (2nd half vs 1st, %) of this set and the median of the athlete's earlier equal sets. */
export function setFade(set: SetInfo, all: SetInfo[]): { fadePct: number | null; usualPct: number | null; usualN: number } {
  const equal = equalBefore(set, all);
  return {
    fadePct: fadeIndex(set.reps.map((rep) => rep.actualS)),
    usualPct: median(equal.map((other) => fadeIndex(other.reps.map((rep) => rep.actualS))).filter((v): v is number => v != null)),
    usualN: equal.length,
  };
}

/** E. "Começou como costuma e quebrou nas últimas 2 (mais do que costuma)." Sets of 4+ reps only. */
export function curveLine(set: SetInfo, all: SetInfo[]): Msg | null {
  const reps = set.reps;
  if (reps.length < 4) return null;
  const half = Math.floor(reps.length / 2);
  const start = stateOf(mean(reps.slice(0, half).map(gapPct)));
  const startMsg: Msg = { key: start === "normal" ? "Começou como costuma" : start === "slower" ? "Começou mais devagar do que costuma" : "Começou mais rápido do que costuma" };
  const base = mean(reps.slice(0, half).map((rep) => rep.actualS / rep.levelS));
  let broke = 0;
  for (let i = reps.length - 1; i >= half && stateOf((reps[i].actualS / reps[i].levelS / base - 1) * 100) === "slower"; i -= 1) broke += 1;
  const { fadePct, usualPct } = setFade(set, all);
  const vsUsual: Msg | null =
    fadePct == null || usualPct == null ? null : isNoise(fadePct - usualPct) ? { key: "como costuma" } : fadePct > usualPct ? { key: "mais do que costuma" } : { key: "menos do que costuma" };
  if (!broke) return { key: "{start} e manteve até ao fim.", vars: { start: startMsg } };
  const end: Msg = { key: "quebrou nas últimas {count}", vars: { count: broke } };
  return vsUsual ? { key: "{start} e {end} ({usual}).", vars: { start: startMsg, end, usual: vsUsual } } : { key: "{start} e {end}.", vars: { start: startMsg, end } };
}

export type Change = { label: string; a: string; b: string; same: boolean };

const GYM: Record<string, MessageKey> = { strength: "Força", explosive: "Explosão", mobility: "Mobilidade" };

/** What differed between two days of the same kind of set, most telling first: data only, no statistics. */
export function sessionChanges(a: TrainingRep[], b: TrainingRep[], wellness: WellnessEntry[], trainingDays: Set<string>): Change[] {
  const missing = tx("não registado");
  const day = (rows: TrainingRep[]) => wellness.find((entry) => entry.date === rows[0].date);
  const eve = (rows: TrainingRep[]) => wellness.find((entry) => entry.date === addDays(rows[0].date, -1));
  const fields: { label: MessageKey; value: (rows: TrainingRep[]) => string | null }[] = [
    { label: "Sono", value: (rows) => (day(rows)?.sleepHours == null ? null : `${comma(day(rows)!.sleepHours!, 1).replace(",0", "")} h`) },
    { label: "Dia seguido de treino", value: (rows) => `${streakBefore(rows[0].date, trainingDays) + 1}.º` },
    { label: "km na semana antes", value: (rows) => comma(rows[0].weeklyLoadM / 1000, 0) },
    { label: "Esforço (RPE)", value: (rows) => (day(rows)?.rpe == null ? null : String(day(rows)!.rpe)) },
    { label: "Recuperação (1–5)", value: (rows) => (day(rows)?.recovery == null ? null : String(day(rows)!.recovery)) },
    { label: "Ginásio na véspera", value: (rows) => (eve(rows) ? (eve(rows)!.gym ? tx(GYM[eve(rows)!.gym!]) : tx("Não")) : null) },
    { label: "Saída", value: (rows) => rows[0].restLabel || null },
    { label: "Turno", value: (rows) => tx(rows[0].shift === "morning" ? "Manhã" : "Tarde") },
    { label: "km antes no treino", value: (rows) => comma(rows[0].loadBeforeM / 1000, 1) },
  ];
  return fields.map((field) => {
    const va = field.value(a) ?? missing;
    const vb = field.value(b) ?? missing;
    return { label: tx(field.label), a: va, b: vb, same: va === vb };
  });
}

export type LastTime = { date: string; pairs: [number, number][]; state: RepState; title: Msg; changes: Change[] };

/** B. This set against the last time the athlete swam the same set (same kind and number of reps, else same kind). */
export function lastTime(set: SetInfo, all: SetInfo[], wellness: WellnessEntry[], days: Set<string>): LastTime | null {
  const before = all.filter((other) => other.date < set.date && other.group === set.group);
  const previous = before.filter((other) => other.reps.length === set.reps.length).at(-1) ?? before.at(-1);
  if (!previous) return null;
  const n = Math.min(previous.reps.length, set.reps.length);
  const pairs: [number, number][] = Array.from({ length: n }, (_, i) => [previous.reps[i].actualS, set.reps[i].actualS]);
  const diff = mean(pairs.map(([a, b]) => b - a));
  const state = stateOf((mean(pairs.map(([, b]) => b)) / mean(pairs.map(([a]) => a)) - 1) * 100);
  const vars = { s: r1(Math.abs(diff)), date: previous.date.slice(8, 10) + "/" + previous.date.slice(5, 7) };
  return {
    date: previous.date,
    pairs,
    state,
    title:
      state === "normal"
        ? { key: "Igual à última vez ({date})", vars }
        : { key: state === "slower" ? "{s} s mais lenta por rep do que a última vez ({date})" : "{s} s mais rápida por rep do que a última vez ({date})", vars },
    changes: sessionChanges(
      previous.reps.map((rep) => rep.row),
      set.reps.map((rep) => rep.row),
      wellness,
      days,
    )
      .filter((change) => !change.same)
      .slice(0, 3),
  };
}

/* ---------- D. Week and season ---------- */

export type WeekRead = { week: string; state: RepState; per100S: number; pct: number; n: number; reasons: Reason[]; noSleep: boolean };

/** Each week of timed reps: state, mean seconds per 100 m against usual, and up to 3 reasons (both ways). */
export function readWeeks(list: ExplainedRep[], days: Set<string>): WeekRead[] {
  const byWeek = new Map<string, ExplainedRep[]>();
  for (const rep of list) {
    const week = weekStartMonday(rep.row.date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), rep]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, reps]) => {
      const pct = mean(reps.map(gapPct));
      const state = stateOf(pct);
      return {
        week,
        state,
        per100S: mean(reps.map(per100)),
        pct,
        n: reps.length,
        reasons: state === "normal" ? [] : reasonsFor(reps, days).slice(0, 3),
        noSleep: reps.every((rep) => rep.row.sleepHours == null),
      };
    });
}

/** Days when the whole day was off in one direction (attribution "dia-anormal"), for the details. */
export function abnormalDays(list: ExplainedRep[]): string[] {
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
  return [...new Set(list.filter((rep) => causes.get(rep.row.log.id)?.cause === "dia-anormal").map((rep) => rep.row.date))].sort();
}

/* ---------- C and F. What usually goes with this athlete's times ---------- */

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

export type LoadPoint = { week: string; km: number; devPct: number; n: number };

export function loadPoints(list: ExplainedRep[], km: Map<string, number>): LoadPoint[] {
  const byWeek = new Map<string, number[]>();
  for (const rep of list) {
    const week = weekStartMonday(rep.row.date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), gapPct(rep)]);
  }
  return [...byWeek.entries()]
    .filter(([week]) => km.has(week))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, gaps]) => ({ week, km: km.get(week)!, devPct: mean(gaps), n: gaps.length }));
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

const WHEN: Record<string, MessageKey> = {
  morning: "de manhã",
  second: "no 2.º treino do dia",
  position: "no fim das séries",
  block: "a partir do bloco",
  sendoff: "por cada 10 s a mais de saída",
  loadBefore: "por cada km já nadado no treino",
  streak: "por cada dia seguido de treino",
  return: "nos primeiros dias depois de uma paragem",
  sleep: "por cada hora a menos de sono (abaixo de 8 h)",
  gymStrength: "nos dias de ginásio de força",
  gymExplosive: "nos dias de ginásio explosivo",
  gymMobility: "nos dias de mobilidade",
  "weekday-0": "às segundas",
  "weekday-1": "às terças",
  "weekday-2": "às quartas",
  "weekday-3": "às quintas",
  "weekday-4": "às sextas",
  "weekday-5": "aos sábados",
  "weekday-6": "aos domingos",
};
const WHOSE: Record<Who, MessageKey> = { F: "da {name}", M: "do {name}", "": "de {name}" };

export type ProfileEffect = LearnedEffect & { marginPct: number };

/**
 * C and F as sentences: "Os tempos da Ana costumam ser cerca de 1 s mais lentos por 100 m de manhã."
 * Only associations clear of their margin, at most 4, largest first; the weekly-volume one from the
 * weeks' slope ("costumam manter-se / piorar / melhorar").
 */
export function profileLines(effects: ProfileEffect[], points: LoadPoint[], paceS: number, who: Who, name: string): Msg[] {
  const whose: Msg = { key: WHOSE[who] ?? WHOSE[""], vars: { name } };
  const lines: { weight: number; msg: Msg }[] = effects
    .filter((effect) => WHEN[effect.key] && Math.abs(effect.pct) > effect.marginPct)
    .map((effect) => ({ weight: Math.abs(effect.pct), s: r1(Math.abs((effect.pct / 100) * paceS)), effect }))
    .filter((line) => line.s >= 0.1)
    .map(({ weight, s, effect }) => ({
      weight,
      msg: {
        key: (effect.pct > 0 ? "Os tempos {whose} costumam ser cerca de {s} s mais lentos por 100 m {when}." : "Os tempos {whose} costumam ser cerca de {s} s mais rápidos por 100 m {when}.") as MessageKey,
        vars: { whose, s, when: { key: WHEN[effect.key] } },
      },
    }));
  const slope = loadSlope(points);
  if (slope) {
    const verb: MessageKey = Math.abs(slope.per10Pct) <= slope.marginPct ? "costumam manter-se" : slope.per10Pct > 0 ? "costumam piorar" : "costumam melhorar";
    lines.push({ weight: Math.abs(slope.per10Pct), msg: { key: "Com semanas de mais volume, os tempos {whose} {verb}.", vars: { whose, verb: { key: verb } } } });
  }
  return lines
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((line) => line.msg);
}

/* ---------- Details ---------- */

export type Breakdown = { reps: number; levelS: number; factors: FactorShare[]; expectedS: number; actualS: number; marginS: number; unexplainedS: number; devPct: number };

/** The model's split, summed over reps: level + Σ factors + unexplained = real (for "Ver detalhes"). */
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
  const factors = [...merged.values()].map((factor) => ({ ...factor, pct: (factor.seconds / levelS) * 100 })).sort((a, b) => Math.abs(b.seconds) - Math.abs(a.seconds));
  return { reps: list.length, levelS, factors, expectedS, actualS, marginS, unexplainedS: actualS - expectedS, devPct: (actualS / levelS - 1) * 100 };
}

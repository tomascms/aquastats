import type { MessageKey } from "@/i18n";
import type { Msg } from "./coach-analysis";
import { addDays } from "./dates";
import { gapPct, isNoise, stateOf, type ExplainedRep, type RepState } from "./explained-times";
import { referenceFractions } from "./indicators";
import { workoutMeters, type RaceRecord } from "./rankings";
import type { TrainingRep } from "./training-context";
import type { SplitTime, Stroke, WellnessEntry, Workout } from "./types";

/*
 * What a race says against the training before it, in a coach's words (docs/natacao/indicadores.md).
 * Parts 1–5 are facts and side-by-side comparisons only, no statistics; colours are the three states
 * (green better, grey close or as usual, orange worse). Part 6 needs 6+ races of the same distance.
 */

const DAY_MS = 86_400_000;
const r1 = (value: number) => Math.round(value * 10) / 10;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
/** m:ss,d (as the training screen's swimClock). */
export const clock = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = (seconds - m * 60).toFixed(1).padStart(4, "0").replace(".", ",");
  return m ? `${m}:${s}` : s.replace(/^0(?=\d,)/, "");
};
/** Race gaps in hundredths, as official times. */
const diffS = (value: number) => Math.round(Math.abs(value) * 100) / 100;

export type Tone = RepState;
export type Tag = { key: string; tone: Tone; msg: Msg };

/* ---------- 1. The result ---------- */

/** Best time in the same event (stroke, distance, course) strictly before `date`, other than `entryId`. */
export function bestBefore(records: RaceRecord[], stroke: Stroke, distanceM: number, course: string, date: string, entryId: string): RaceRecord | null {
  return (
    records
      .filter((record) => record.stroke === stroke && record.distanceM === distanceM && record.course === course && record.date < date && record.entryId !== entryId && record.timeS > 0)
      .sort((a, b) => a.timeS - b.timeS)[0] ?? null
  );
}

/** "200 livres em 2:05,3: 1,2 s melhor do que o recorde pessoal" — green if a PB, grey if within noise, orange if far. */
export function resultLine(event: string, timeS: number, pb: RaceRecord | null): { tone: Tone; msg: Msg } {
  const vars = { event, time: clock(timeS) };
  if (!pb) return { tone: "normal", msg: { key: "{event} em {time}: primeira vez nesta prova.", vars } };
  if (Math.abs(timeS - pb.timeS) < 0.005) return { tone: "normal", msg: { key: "{event} em {time}: igual ao recorde pessoal.", vars } };
  const diff = timeS - pb.timeS;
  if (diff < 0) return { tone: "faster", msg: { key: "{event} em {time}: {s} s melhor do que o recorde pessoal.", vars: { ...vars, s: diffS(diff) } } };
  if (isNoise((diff / pb.timeS) * 100)) return { tone: "normal", msg: { key: "{event} em {time}: perto do recorde pessoal ({s} s acima).", vars: { ...vars, s: diffS(diff) } } };
  return { tone: "slower", msg: { key: "{event} em {time}: {s} s acima do recorde pessoal.", vars: { ...vars, s: diffS(diff) } } };
}

/* ---------- 2. How the swimmer came into the race ---------- */

export type LeadIn = {
  /** km in the 7 days before. */
  weekKm: number;
  /** Mean km per week in the 2 weeks before, and in the 4 weeks before those. */
  lastTwoKm: number;
  baseKm: number;
  /** Volume change of the last 2 weeks against the 4 before, in % (negative = less). */
  changePct: number | null;
  /** Weeks before the race, counted back from it, each under 85 % of the base volume. */
  taperWeeks: number;
  /** Mean sleep of the 3 days before, null if not logged. */
  sleepH: number | null;
  /** Longest gap between training days in the 21 days before (days), null if none of 10+. */
  breakDays: number | null;
};

export function leadIn(date: string, athleteId: string, workouts: Workout[], wellness: WellnessEntry[]): LeadIn {
  const mine = workouts.filter((workout) => workout.athleteIds.includes(athleteId) && workout.date < date);
  const km = (from: string, to: string) => mine.filter((workout) => workout.date >= from && workout.date <= to).reduce((sum, workout) => sum + workoutMeters(workout), 0) / 1000;
  const weekKm = km(addDays(date, -7), addDays(date, -1));
  const lastTwoKm = km(addDays(date, -14), addDays(date, -1)) / 2;
  const baseKm = km(addDays(date, -42), addDays(date, -15)) / 4;
  let taperWeeks = 0;
  while (taperWeeks < 3 && baseKm > 0 && km(addDays(date, -7 * (taperWeeks + 1)), addDays(date, -7 * taperWeeks - 1)) < 0.85 * baseKm) taperWeeks += 1;
  const sleeps = [1, 2, 3].map((d) => wellness.find((entry) => entry.date === addDays(date, -d))?.sleepHours).filter((h): h is number => h != null);
  const days = [...new Set(mine.filter((workout) => workout.date >= addDays(date, -21)).map((workout) => workout.date))].sort();
  let breakDays: number | null = null;
  const edges = [addDays(date, -21), ...days, date];
  for (let i = 1; i < edges.length; i += 1) {
    const gap = Math.round((Date.parse(edges[i]) - Date.parse(edges[i - 1])) / DAY_MS);
    if (gap >= 10) breakDays = Math.max(breakDays ?? 0, gap);
  }
  return {
    weekKm,
    lastTwoKm,
    baseKm,
    changePct: baseKm > 0 ? (lastTwoKm / baseKm - 1) * 100 : null,
    taperWeeks,
    sleepH: sleeps.length ? mean(sleeps) : null,
    breakDays,
  };
}

/** How training times went in the 3 weeks before, against the athlete's usual (tempos explicados). */
export const trainingForm = (list: ExplainedRep[], date: string): RepState | null => {
  const window = list.filter((rep) => rep.row.date < date && rep.row.date >= addDays(date, -21));
  return window.length >= 10 ? stateOf(mean(window.map(gapPct))) : null;
};

/** Up to 4 tags: volume, sleep, breaks, training form; a missing value is said to be missing. */
export function leadInTags(li: LeadIn, form: RepState | null): Tag[] {
  const tags: Tag[] = [];
  if (li.changePct != null && Math.abs(li.changePct) >= 10) {
    const pct = Math.round(Math.abs(li.changePct));
    tags.push(
      li.changePct < 0
        ? { key: "volume", tone: "faster", msg: { key: "Volume baixou {pct} % nas 2 semanas antes", vars: { pct } } }
        : { key: "volume", tone: "slower", msg: { key: "Volume subiu {pct} % nas 2 semanas antes", vars: { pct } } },
    );
  } else if (li.changePct != null) tags.push({ key: "volume", tone: "normal", msg: { key: "Volume normal nas 2 semanas antes" } });
  tags.push(
    li.sleepH == null
      ? { key: "sleep", tone: "normal", msg: { key: "Sono não registado nos dias antes" } }
      : li.sleepH >= 8
        ? { key: "sleep", tone: "faster", msg: { key: "Dormiu bem nos 3 dias antes ({h} h)", vars: { h: r1(li.sleepH) } } }
        : li.sleepH < 7
          ? { key: "sleep", tone: "slower", msg: { key: "Dormiu pouco nos 3 dias antes ({h} h)", vars: { h: r1(li.sleepH) } } }
          : { key: "sleep", tone: "normal", msg: { key: "Dormiu {h} h nos 3 dias antes", vars: { h: r1(li.sleepH) } } },
  );
  tags.push(li.breakDays ? { key: "break", tone: "slower", msg: { key: "Paragem de {d} dias nas 3 semanas antes", vars: { d: li.breakDays } } } : { key: "break", tone: "faster", msg: { key: "Sem paragens" } });
  if (form)
    tags.push({
      key: "form",
      tone: form,
      msg: { key: form === "faster" ? "Nos treinos andava mais rápido do que costuma" : form === "slower" ? "Nos treinos andava mais lento do que costuma" : "Nos treinos andava como costuma" },
    });
  return tags;
}

/* ---------- 3. Did training match the race? ---------- */

const RACE_PACE = new Set(["P50", "P100", "P200", "P400"]);
const HIGH = new Set(["PA", "MAX"]);

export type PaceCheck = { tone: Tone; msg: Msg; trainingPer50: number | null; racePer50: number; n: number; kind: "race-pace" | "high" | null };

/** Race pace per 50 against race-pace (else high-intensity) training reps of the 4 weeks before, same pool and stroke, no gear. */
export function paceCheck(reps: TrainingRep[], date: string, stroke: Stroke, course: string, distanceM: number, timeS: number): PaceCheck {
  const racePer50 = timeS / (distanceM / 50);
  const window = reps.filter((rep) => rep.date < date && rep.date >= addDays(date, -28) && rep.stroke === stroke && rep.course === course && !rep.gear?.length && rep.distanceM <= distanceM && rep.distanceM >= 25);
  const racePace = window.filter((rep) => RACE_PACE.has(rep.intensity));
  const chosen = racePace.length >= 3 ? racePace : window.filter((rep) => HIGH.has(rep.intensity) && rep.distanceM >= 50);
  const kind = racePace.length >= 3 ? "race-pace" : chosen.length >= 3 ? "high" : null;
  if (!kind) return { tone: "normal", msg: { key: "Sem séries de ritmo de prova comparáveis (mesma piscina e estilo) nas 4 semanas antes." }, trainingPer50: null, racePer50, n: 0, kind };
  const trainingPer50 = median(chosen.map((rep) => rep.timeS / (rep.distanceM / 50)));
  const diffPct = (racePer50 / trainingPer50 - 1) * 100;
  const tone: Tone = isNoise(diffPct) ? "normal" : diffPct < 0 ? "faster" : "slower";
  const vars = { train: clock(trainingPer50), race: clock(racePer50) };
  const head: Msg = { key: kind === "race-pace" ? "Nos treinos de ritmo de prova fazia os 50 em {train}; na prova fez os 50 em {race} em média" : "Nas séries mais rápidas fazia os 50 em {train}; na prova fez os 50 em {race} em média", vars };
  const tail: MessageKey = tone === "normal" ? "igual ao que o treino mostrava" : tone === "faster" ? "acima do que o treino mostrava" : "abaixo do que o treino mostrava";
  return { tone, msg: { key: "{head}: {tail}.", vars: { head, tail: { key: tail } } }, trainingPer50, racePer50, n: chosen.length, kind };
}

/* ---------- 4. Splits ---------- */

/** Per-50 laps from cumulative splits; null unless there is a split at every 50 ending at the time. */
export function laps50(splits: SplitTime[] | undefined, distanceM: number, timeS: number): number[] | null {
  if (!splits?.length || distanceM < 100) return null;
  const at = new Map(splits.map((split) => [split.atM, split.mm * 60 + split.ss + split.cc / 100]));
  at.set(distanceM, timeS);
  const out: number[] = [];
  let previous = 0;
  for (let m = 50; m <= distanceM; m += 50) {
    const cumulative = at.get(m);
    if (cumulative == null || cumulative <= previous) return null;
    out.push(cumulative - previous);
    previous = cumulative;
  }
  return out;
}

export type SplitRead = { laps: number[]; ref: number[]; refKind: "pb" | "plan"; tones: Tone[]; msg: Msg };

/** Each 50 against the PB's 50s (or the reference split plan on the PB time): where it was gained and lost. */
export function readSplits(laps: number[] | null, pb: RaceRecord | null, distanceM: number): SplitRead | null {
  if (!laps || !pb) return null;
  const pbLaps = laps50(pb.splits, distanceM, pb.timeS);
  const ref = pbLaps ?? referenceFractions(distanceM).map((fraction) => fraction * pb.timeS);
  if (ref.length !== laps.length) return null;
  const deltas = laps.map((lap, i) => lap - ref[i]);
  const tones: Tone[] = deltas.map((delta, i) => (isNoise((delta / ref[i]) * 100) ? "normal" : delta < 0 ? "faster" : "slower"));
  const first = deltas[0];
  const worst = deltas.reduce((max, delta, i) => (delta > deltas[max] ? i : max), 0);
  const start: Msg = tones[0] === "normal" ? { key: "Passou aos 50 como no recorde" } : { key: first < 0 ? "Passou aos 50 {s} s mais rápido do que no recorde" : "Passou aos 50 {s} s mais lento do que no recorde", vars: { s: diffS(first) } };
  const where: Msg =
    tones[worst] !== "slower"
      ? { key: "não perdeu em nenhum 50" }
      : worst === laps.length - 1
        ? { key: "perdeu nos últimos 50" }
        : worst === 0
          ? { key: "perdeu logo nos primeiros 50" }
          : { key: "perdeu mais no {n}.º 50", vars: { n: worst + 1 } };
  const ofPlan: Msg | null = pbLaps ? null : { key: "(comparado com o plano de parciais sobre o tempo do recorde)" };
  const msg: Msg = ofPlan ? { key: "{a} e {b} {c}.", vars: { a: start, b: where, c: ofPlan } } : { key: "{a} e {b}.", vars: { a: start, b: where } };
  return { laps, ref, refKind: pbLaps ? "pb" : "plan", tones, msg };
}

/* ---------- 5. This race against the best one ---------- */

export type Diff = { label: MessageKey; now: string; best: string };

/** Up to 3 lead-in facts that differ between this race and the athlete's best in the event; data only. */
export function vsBest(now: LeadIn, best: LeadIn): Diff[] {
  const km = (value: number) => `${Math.round(value)} km`;
  const sleep = (value: number | null) => (value == null ? "—" : `${r1(value).toLocaleString("pt-PT")} h`);
  const rows: (Diff & { differs: boolean })[] = [
    { label: "Volume na semana antes", now: km(now.weekKm), best: km(best.weekKm), differs: Math.abs(now.weekKm - best.weekKm) >= Math.max(3, 0.15 * best.weekKm) },
    { label: "Taper", now: `${now.taperWeeks} sem.`, best: `${best.taperWeeks} sem.`, differs: now.taperWeeks !== best.taperWeeks },
    { label: "Sono nos 3 dias antes", now: sleep(now.sleepH), best: sleep(best.sleepH), differs: now.sleepH != null && best.sleepH != null && Math.abs(now.sleepH - best.sleepH) >= 0.5 },
    { label: "Paragem nas 3 semanas antes", now: now.breakDays ? `${now.breakDays} d` : "—", best: best.breakDays ? `${best.breakDays} d` : "—", differs: (now.breakDays ?? 0) !== (best.breakDays ?? 0) },
  ];
  return rows.filter((row) => row.differs).slice(0, 3).map(({ label, now: a, best: b }) => ({ label, now: a, best: b }));
}

/* ---------- 6. Profile: what the best races usually coincide with ---------- */

export type RaceLeadIn = { record: RaceRecord; leadIn: LeadIn };

/**
 * Per distance with 6+ races: best third against worst third (time over that event's best), on taper,
 * sleep and breaks. Says only differences big enough to see: taper drop ≥ 10 points, sleep ≥ 0,5 h.
 */
export function raceProfileLines(races: RaceLeadIn[]): Msg[] {
  const byDistance = new Map<number, RaceLeadIn[]>();
  for (const race of races) byDistance.set(race.record.distanceM, [...(byDistance.get(race.record.distanceM) ?? []), race]);
  const out: { weight: number; msg: Msg }[] = [];
  for (const [distanceM, list] of byDistance) {
    if (list.length < 6) continue;
    const bestOf = new Map<string, number>();
    for (const race of list) {
      const key = `${race.record.stroke}|${race.record.course}`;
      bestOf.set(key, Math.min(bestOf.get(key) ?? Infinity, race.record.timeS));
    }
    const ranked = [...list].sort((a, b) => a.record.timeS / bestOf.get(`${a.record.stroke}|${a.record.course}`)! - b.record.timeS / bestOf.get(`${b.record.stroke}|${b.record.course}`)!);
    const third = Math.max(2, Math.floor(ranked.length / 3));
    const top = ranked.slice(0, third);
    const bottom = ranked.slice(-third);
    const avg = (group: RaceLeadIn[], value: (li: LeadIn) => number | null) => {
      const values = group.map((race) => value(race.leadIn)).filter((v): v is number => v != null);
      return values.length >= 2 ? mean(values) : null;
    };
    const dTop = avg(top, (li) => li.changePct);
    const dBottom = avg(bottom, (li) => li.changePct);
    if (dTop != null && dBottom != null && Math.abs(dTop - dBottom) >= 10)
      out.push({
        weight: Math.abs(dTop - dBottom) / 10,
        msg: { key: dTop < dBottom ? "As melhores provas de {d} m costumam coincidir com 2 semanas de volume mais baixo antes." : "As melhores provas de {d} m costumam coincidir com volume igual ou mais alto nas 2 semanas antes.", vars: { d: distanceM } },
      });
    const sTop = avg(top, (li) => li.sleepH);
    const sBottom = avg(bottom, (li) => li.sleepH);
    if (sTop != null && sBottom != null && Math.abs(sTop - sBottom) >= 0.5)
      out.push({
        weight: Math.abs(sTop - sBottom) / 0.5,
        msg: { key: sTop > sBottom ? "As melhores provas de {d} m costumam coincidir com mais horas de sono nos dias antes." : "As melhores provas de {d} m costumam coincidir com menos horas de sono nos dias antes.", vars: { d: distanceM } },
      });
    const bTop = top.filter((race) => race.leadIn.breakDays).length / top.length;
    const bBottom = bottom.filter((race) => race.leadIn.breakDays).length / bottom.length;
    if (bBottom - bTop >= 0.5) out.push({ weight: 1, msg: { key: "As piores provas de {d} m costumam coincidir com uma paragem nas 3 semanas antes.", vars: { d: distanceM } } });
  }
  return out
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((line) => line.msg);
}

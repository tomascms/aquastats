import { analyzeRace, type Expected, type Msg, type RaceAnalysis } from "./coach-analysis";
import type { Audience, Point } from "./session-report";
import type { TrainingRep } from "./training-context";
import type { RaceSession, SplitTime, WellnessEntry, Workout } from "./types";

/*
 * A race read like a coach's report (docs/natacao/benchmark-visualizacao.md D9; pesquisa/produtos-prova.md):
 * the result against a *named* reference (the best mark before this race), each split with its difference,
 * one pacing number (1st vs 2nd half), then what went well and what to improve (3 points at most, strengths
 * first). The swimmer's version keeps one strength and one focus and leaves the taper to the coach.
 */

export type RaceMark = { id: string; date: string; timeS: number; meetTitle: string; splits?: SplitTime[] };
export type SplitRow = { fromM: number; toM: number; thisS: number; refS: number | null };
export type Halves = { firstS: number; secondS: number };
export type RaceReport = {
  headline: Msg;
  tone: "good" | "mixed" | "improve";
  pb: boolean;
  ref: RaceMark | null;
  deltaS: number | null;
  /** 1 = the best time ever in this event (this race included). */
  rank: number;
  points: Point[];
  splits: SplitRow[];
  pacing: { now: Halves; ref: Halves | null } | null;
  prep: RaceAnalysis;
};

const r2 = (x: number) => Math.round(x * 100) / 100;
const r1 = (x: number) => Math.round(x * 10) / 10;
const clockOf = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, "0").replace(".", ",")}`;
};
const splitS = (s: SplitTime) => s.mm * 60 + s.ss + s.cc / 100;

/** Cumulative official splits → segment times, ending at the final time. */
export function segmentsOf(mark: RaceMark, distanceM: number): { fromM: number; toM: number; s: number }[] {
  const marks = (mark.splits ?? []).map((s) => ({ atM: s.atM, t: splitS(s) })).filter((s) => s.t > 0 && s.atM < distanceM).sort((a, b) => a.atM - b.atM);
  if (!marks.length) return [];
  const points = [{ atM: 0, t: 0 }, ...marks, { atM: distanceM, t: mark.timeS }];
  return points.slice(1).map((p, i) => ({ fromM: points[i].atM, toM: p.atM, s: r2(p.t - points[i].t) }));
}

export function halvesOf(mark: RaceMark, distanceM: number): Halves | null {
  const half = (mark.splits ?? []).find((s) => s.atM === distanceM / 2);
  return half ? { firstS: splitS(half), secondS: r2(mark.timeS - splitS(half)) } : null;
}

export function raceReport(
  mark: RaceMark,
  sameEvent: RaceMark[],
  session: RaceSession,
  sessions: RaceSession[],
  workouts: Workout[],
  wellness: WellnessEntry[],
  rows: TrainingRep[],
  expected: Map<string, Expected>,
  audience: Audience = "coach",
): RaceReport {
  const athlete = audience === "athlete";
  const distanceM = session.distanceM;
  const prep = analyzeRace(session, sessions, workouts, wellness, rows, expected);
  const before = sameEvent.filter((m) => m.id !== mark.id && m.date < mark.date && m.timeS > 0);
  const ref = [...before].sort((a, b) => a.timeS - b.timeS)[0] ?? null;
  const deltaS = ref ? r2(mark.timeS - ref.timeS) : null;
  const pb = ref ? mark.timeS < ref.timeS : false;
  const rank = 1 + sameEvent.filter((m) => m.id !== mark.id && m.timeS > 0 && m.timeS < mark.timeS).length;

  const now = segmentsOf(mark, distanceM);
  const refSegs = ref ? segmentsOf(ref, distanceM) : [];
  const splits: SplitRow[] = now.map((seg) => ({ fromM: seg.fromM, toM: seg.toM, thisS: seg.s, refS: refSegs.find((r) => r.fromM === seg.fromM && r.toM === seg.toM)?.s ?? null }));
  const nowHalves = halvesOf(mark, distanceM);
  const refHalves = ref ? halvesOf(ref, distanceM) : null;

  const good: Point[] = [];
  const improve: Point[] = [];

  // Result against the best mark before this race; a PB is already the headline, so only "close to it" is a point.
  if (ref && !pb && rank <= 3 && deltaS != null && deltaS <= 0.01 * ref.timeS)
    good.push({ tone: "good", what: { key: athlete ? "O teu {rank}.º melhor tempo de sempre nesta prova, a {s} s do recorde." : "{rank}.º melhor tempo de sempre nesta prova, a {s} s do recorde.", vars: { rank, s: deltaS } } });

  // Pacing against the reference, the single number coaches read first.
  if (nowHalves && refHalves) {
    const d1 = r2(nowHalves.firstS - refHalves.firstS);
    const d2 = r2(nowHalves.secondS - refHalves.secondS);
    if (d1 < -0.2 && d2 > 0.3)
      improve.push({
        tone: "improve",
        what: {
          key: athlete ? "Passaste aos {half} m {a} s mais rápido que no recorde e perdeste {b} s na 2.ª metade." : "Passou aos {half} m {a} s mais rápido que no recorde e perdeu {b} s na 2.ª metade: a prova decidiu-se no ritmo, não na velocidade.",
          vars: { half: distanceM / 2, a: Math.abs(d1), b: d2 },
        },
        next: {
          key: athlete ? "Foco para a próxima: passar aos {half} m perto de {t} e acabar forte." : "Para a próxima, pode ajudar: passar aos {half} m perto de {t}, como no recorde.",
          vars: { half: distanceM / 2, t: clockOf(refHalves.firstS) },
        },
      });
    else if (d2 < -0.2) good.push({ tone: "good", what: { key: athlete ? "Acabaste mais forte que no recorde: 2.ª metade {b} s melhor." : "2.ª metade mais forte que no recorde: {b} s melhor.", vars: { b: Math.abs(d2) } } });
    else if (d1 < -0.2 && d2 <= 0.3)
      good.push({ tone: "good", what: { key: athlete ? "Passaste aos {half} m {a} s mais rápido que no recorde e aguentaste até ao fim." : "Passou aos {half} m {a} s mais rápido que no recorde e aguentou a 2.ª metade.", vars: { half: distanceM / 2, a: Math.abs(d1) } } });
    else if (d2 > 0.3) improve.push({ tone: "improve", what: { key: athlete ? "Perdeste {b} s na 2.ª metade face ao recorde." : "Perdeu {b} s na 2.ª metade face ao recorde.", vars: { b: d2 } }, next: { key: athlete ? "Foco para a próxima: acabar forte." : "Para a próxima: trabalhar a 2.ª metade (séries a ritmo de prova com pouco descanso)." } });
  }

  // Where time was gained or lost, split by split (with only two splits the halves above already say it).
  const withRef = splits.length > 2 ? splits.filter((s) => s.refS != null).map((s) => ({ ...s, d: r2(s.thisS - s.refS!) })) : [];
  if (withRef.length >= 2 && !improve.length) {
    const worst = [...withRef].sort((a, b) => b.d - a.d)[0];
    if (worst.d > 0.3) improve.push({ tone: "improve", what: { key: athlete ? "Onde perdeste mais face ao recorde: {from}–{to} m (+{s} s)." : "Onde mais perdeu face ao recorde: {from}–{to} m (+{s} s).", vars: { from: worst.fromM, to: worst.toM, s: worst.d } } });
  }
  if (withRef.length >= 2 && good.length < 2) {
    const best = [...withRef].sort((a, b) => a.d - b.d)[0];
    if (best.d < -0.3) good.push({ tone: "good", what: { key: athlete ? "Onde ganhaste mais: {from}–{to} m ({s} s melhor)." : "Onde mais ganhou: {from}–{to} m ({s} s melhor que no recorde).", vars: { from: best.fromM, to: best.toM, s: Math.abs(best.d) } } });
  }
  // Detailed race analyses (start, turns, finish) when both races have one.
  if (prep.vsBest?.fastStart && !improve.length)
    improve.push({ tone: "improve", what: { key: "Saiu mais rápido que no recorde e quebrou no fim: abertura rápida demais." } });

  // Preparation: the coach's side (taper, speed work, sleep); the swimmer sees the training trend only.
  if (!athlete && prep.taper) {
    if (prep.taper.verdict === "adequada") good.push({ tone: "good", what: { key: "Polimento adequado: o volume desceu {pct} % nas 2 semanas antes.", vars: { pct: prep.taper.reductionPct } } });
    else
      improve.push({
        tone: "improve",
        what: { key: prep.taper.verdict === "pouca" ? "Polimento curto: o volume só desceu {pct} % nas 2 semanas antes." : "Polimento excessivo: o volume desceu {pct} % nas 2 semanas antes.", vars: { pct: prep.taper.reductionPct } },
        next: { key: "Referência: descer 40–60 % do volume nas 2 semanas antes, mantendo a intensidade (Bosquet 2007)." },
      });
    if (prep.taper.lowSpeed)
      improve.push({
        tone: "improve",
        what: { key: "Pouco trabalho rápido nas 2 semanas antes: {now} % do volume em A3 ou ritmo de prova (antes {before} %).", vars: { now: prep.taper.speedShareNow, before: prep.taper.speedShareBefore } },
        next: { key: "No polimento, manter algum trabalho rápido e curto." },
      });
  }
  if (prep.trend && Math.abs(prep.trend.recentPct - prep.trend.beforePct) >= 0.5) {
    if (prep.trend.recentPct < prep.trend.beforePct) good.push({ tone: "good", what: { key: athlete ? "Chegaste à prova a nadar mais rápido nos treinos." : "Chegou à prova a nadar mais rápido nos treinos da última semana." } });
    else {
      const why: Msg[] = [];
      const c = prep.context;
      if (!athlete && c.sleep != null && c.sleepBefore != null && c.sleep < c.sleepBefore - 0.5) why.push({ key: "dormiu {h} h por noite nas 2 semanas antes (costuma {u} h)", vars: { h: r1(c.sleep), u: r1(c.sleepBefore) } });
      improve.push({ tone: "improve", what: { key: athlete ? "Na última semana os treinos estavam a ficar mais lentos." : "Nos treinos da última semana estava a ficar mais lento." }, why: athlete ? undefined : why.length ? why : [{ key: "sem causa clara nos dados" }] });
    }
  }

  let headline: Msg;
  let tone: RaceReport["tone"];
  if (!ref) {
    headline = { key: athlete ? "Primeira vez nesta prova: {time}." : "Primeira marca nesta prova: {time}.", vars: { time: clockOf(mark.timeS) } };
    tone = "good";
  } else if (pb) {
    headline = { key: athlete ? "Novo recorde pessoal: {time} ({s} s melhor)." : "Recorde pessoal: {time}, {s} s melhor que o anterior.", vars: { time: clockOf(mark.timeS), s: Math.abs(deltaS!) } };
    tone = "good";
  } else if (deltaS! <= 0.01 * ref.timeS) {
    headline = { key: athlete ? "Perto do teu recorde: a {s} s ({time})." : "Perto do recorde pessoal: a {s} s ({time}).", vars: { s: deltaS!, time: clockOf(mark.timeS) } };
    tone = "mixed";
  } else {
    headline = { key: athlete ? "Ficaste a {s} s do teu recorde ({time})." : "Ficou {s} s acima do recorde pessoal ({time}).", vars: { s: deltaS!, time: clockOf(mark.timeS) } };
    tone = "improve";
  }

  const maxImprove = athlete ? 1 : 2;
  const maxGood = athlete ? 1 : Math.max(1, 3 - Math.min(maxImprove, improve.length));
  return {
    headline,
    tone,
    pb,
    ref,
    deltaS,
    rank,
    points: [...good.slice(0, maxGood), ...improve.slice(0, maxImprove)],
    splits,
    pacing: nowHalves ? { now: nowHalves, ref: refHalves } : null,
    prep,
  };
}

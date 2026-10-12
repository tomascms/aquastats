import type { MessageKey } from "@/i18n";
import { compareRaces } from "./race-analysis";
import { workoutMeters } from "./rankings";
import { workoutBands } from "./season";
import type { TrainingRep } from "./training-context";
import type { Intensity, RaceSession, Stroke, WellnessEntry, Workout } from "./types";

/*
 * What a coach reads off a training sheet and a race, as plain rules (docs/natacao/logica-treinador.md §8).
 * - "Tempo que devia fazer": per distance, never from a /100 m pace. The median of the athlete's own reps
 *   with the same pool, stroke, distance, zone, material and rest (last 42 days); else the same without the
 *   rest; else best race time at that distance ÷ % of the zone.
 * - Noise: the athlete's own rep-to-rep SD at that key, floor 0.5 % of the target (Pyne 2004). Nothing below it is said.
 * - Every sentence carries the number behind it; with no cause in the data it says so.
 */

export type Msg = { key: MessageKey; vars?: Record<string, string | number> };
export type Expected = { targetS: number; noiseS: number; basis: "treino" | "prova" };
export type Verdict = "alvo" | "rapido" | "lento";

const DAY = 86_400_000;
const daysBetween = (later: string, earlier: string) => Math.round((Date.parse(later) - Date.parse(earlier)) / DAY);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
};
const r1 = (x: number) => Math.round(x * 10) / 10;

const baseKey = (row: TrainingRep) => `${row.course}|${row.stroke}|${row.distanceM}|${row.intensity}|${[...row.gear].sort().join("+")}`;

/** Share of best race speed a coach expects per zone (estimate, logica-treinador §1.2). */
export const ZONE_PCT: Record<Intensity, number> = {
  SUAVE: 0.75,
  A1: 0.79,
  A2: 0.85,
  A3: 0.9,
  PROG: 0.87,
  PA: 0.975,
  MAX: 0.99,
  P50: 0.975,
  P100: 0.975,
  P200: 0.975,
  P400: 0.975,
};
/** A race best has a dive start; a training rep starts with a push. */
export const DIVE_TO_PUSH_S = 0.8;
const MIN_REPS = 3;
const WINDOW_DAYS = 42;

/** Target from a race best: (best + push correction) ÷ % of the zone. Exported for tests. */
export function targetFromBest(bestS: number, intensity: Intensity): number {
  return (bestS + DIVE_TO_PUSH_S) / ZONE_PCT[intensity];
}

/**
 * The time each rep "should" take, from earlier reps only (never the rep itself or its own session).
 * `bests` maps `${stroke}|${distanceM}` to the athlete's best race time.
 */
// ponytail: O(n·k) scan per key group; fine for one athlete's season, index by date if it grows.
export function expectedTimes(rows: TrainingRep[], bests: Map<string, number> = new Map()): Map<string, Expected> {
  const byKey = new Map<string, TrainingRep[]>();
  for (const row of rows) byKey.set(baseKey(row), [...(byKey.get(baseKey(row)) ?? []), row]);
  const out = new Map<string, Expected>();
  for (const row of rows) {
    const earlier = (byKey.get(baseKey(row)) ?? []).filter((o) => o.workoutId !== row.workoutId && o.date < row.date && daysBetween(row.date, o.date) <= WINDOW_DAYS);
    const sameRest = earlier.filter((o) => o.restBucket === row.restBucket);
    const pool = sameRest.length >= MIN_REPS ? sameRest : earlier;
    if (pool.length >= MIN_REPS) {
      const times = pool.map((o) => o.timeS);
      const targetS = median(times);
      out.set(row.log.id, { targetS, noiseS: Math.max(sd(times), 0.005 * targetS), basis: "treino" });
      continue;
    }
    const best = row.stroke ? bests.get(`${row.stroke}|${row.distanceM}`) : undefined;
    if (best && !row.gear.length) {
      const targetS = targetFromBest(best, row.intensity);
      out.set(row.log.id, { targetS, noiseS: 0.01 * targetS, basis: "prova" });
    }
  }
  return out;
}

export function verdictOf(timeS: number, expected: Expected): Verdict {
  const diff = timeS - expected.targetS;
  return Math.abs(diff) <= expected.noiseS ? "alvo" : diff < 0 ? "rapido" : "lento";
}

/** Metres in the 7 days up to `date` vs the weekly mean of the 21 days before (% change), or null. */
export function loadChangePct(workouts: Workout[], athleteId: string, date: string): number | null {
  let now = 0;
  let before = 0;
  for (const w of workouts) {
    if (!w.athleteIds.includes(athleteId)) continue;
    const d = daysBetween(date, w.date);
    if (d >= 0 && d < 7) now += workoutMeters(w);
    else if (d >= 7 && d < 28) before += workoutMeters(w);
  }
  return before > 0 ? ((now - before / 3) / (before / 3)) * 100 : null;
}

export type SessionContext = { workouts: Workout[]; wellness: WellnessEntry[]; athleteId: string };

/** Reasons in the data for a worse day: short sleep, gym the day before, second session, load jump. */
function causesWorse(rows: TrainingRep[], ctx: SessionContext): Msg[] {
  const date = rows[0].date;
  const out: Msg[] = [];
  const sleep = rows[0].sleepHours ?? ctx.wellness.find((w) => w.date === date)?.sleepHours ?? null;
  if (sleep != null && sleep < 6.5) out.push({ key: "dormiu {h} h", vars: { h: r1(sleep) } });
  const yesterday = new Date(Date.parse(date) - DAY).toISOString().slice(0, 10);
  const gym = ctx.wellness.find((w) => w.date === yesterday)?.gym;
  if (gym === "strength" || gym === "explosive") out.push({ key: "teve ginásio de força ontem" });
  if (rows[0].trainedEarlierToday) out.push({ key: "era a segunda sessão do dia" });
  const load = loadChangePct(ctx.workouts, ctx.athleteId, date);
  if (load != null && load > 20) out.push({ key: "a carga desta semana é {pct} % acima das 3 anteriores", vars: { pct: Math.round(load) } });
  return out;
}

export type SessionNote = { what: Msg; why: Msg[]; fix?: Msg };
type Scored = { row: TrainingRep; exp: Expected; diff: number };

/** Coach-language notes for one athlete's session; each sentence carries its number and reason. */
export function analyzeSession(rows: TrainingRep[], expected: Map<string, Expected>, ctx: SessionContext): SessionNote[] {
  if (!rows.length) return [];
  const groups = new Map<string, Scored[]>();
  for (const row of rows) {
    const exp = expected.get(row.log.id);
    if (!exp) continue;
    const key = `${row.blockId}|${row.segmentIndex}|${row.round}`;
    groups.set(key, [...(groups.get(key) ?? []), { row, exp, diff: row.timeS - exp.targetS }]);
  }
  const notes: SessionNote[] = [];
  const worse = causesWorse(rows, ctx);
  for (const set of groups.values()) {
    set.sort((a, b) => a.row.repInSegment - b.row.repInSegment);
    const head = set[0].row;
    const label = { dist: head.distanceM, zone: head.intensity };
    const noise = mean(set.map((s) => s.exp.noiseS));
    const rest = set.map((s) => s.row.restSeconds).filter((x): x is number => x != null);
    const restMed = rest.length ? median(rest) : null;

    if (set.length >= 5) {
      const first = set.slice(1, 4).map((s) => s.diff);
      const last = set.slice(-3).map((s) => s.diff);
      const drop = mean(last) - mean(first);
      if (drop > 2 * noise && last.filter((d) => d > 2 * noise).length >= 2) {
        const start = set.findIndex((s, i) => i > 0 && set.slice(i).every((t) => t.diff > noise));
        const from = start > 0 ? start : set.length - 3;
        const perRep = drop / Math.max(1, set.length - 3);
        const why = restMed != null && restMed < 5 ? [{ key: "a saída deu só {s} s de descanso" as MessageKey, vars: { s: Math.round(restMed) } }, ...worse] : worse;
        notes.push({
          what: { key: "O rendimento caiu a partir da rep {n} nos {dist} {zone} (+{s} s/rep)", vars: { n: from + 1, ...label, s: r1(perRep) } },
          why,
          fix: { key: "Para prevenir: mais 5 s de saída, ou {k} reps em vez de {n}", vars: { k: from, n: set.length } },
        });
        continue;
      }
      const firstHalf = set.slice(0, set.length >> 1).map((s) => s.diff);
      const lastHalf = set.slice(set.length >> 1).map((s) => s.diff);
      if (mean(firstHalf) - mean(lastHalf) > 2 * noise) {
        const why: Msg[] = [];
        if (head.restVsSet === "more" && restMed != null) why.push({ key: "a saída deu {s} s de descanso, mais que o habitual", vars: { s: Math.round(restMed) } });
        if (mean(firstHalf) > noise) why.push({ key: "começou a guardar-se: a 1.ª metade ficou {s} s acima do devido", vars: { s: r1(mean(firstHalf)) } });
        notes.push({ what: { key: "Acelerou da rep {a} à {b} nos {dist} {zone}", vars: { a: (set.length >> 1) + 1, b: set.length, ...label } }, why });
        continue;
      }
    }
    const avg = mean(set.slice(set.length > 2 ? 1 : 0).map((s) => s.diff));
    if (avg > noise) notes.push({ what: { key: "Esteve {s} s mais lento que o devido nos {dist} {zone}", vars: { s: r1(avg), ...label } }, why: worse });
    else if (avg < -noise) notes.push({ what: { key: "Esteve {s} s mais rápido que o devido nos {dist} {zone}", vars: { s: r1(-avg), ...label } }, why: [] });
  }
  return notes;
}

/* ── Carga: how this athlete reacts to load, week by week ─────────────────────────────── */

export type LoadWeek = { week: string; km: number; vsDuePct: number | null; rpe: number | null; sleep: number | null; recovery: number | null };

const mondayOf = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const avgOrNull = (xs: number[]) => (xs.length ? mean(xs) : null);

/** Weekly km, effort/sleep/recovery and how far reps were from what they should be (%; + = slower). */
export function loadWeeks(workouts: Workout[], wellness: WellnessEntry[], rows: TrainingRep[], expected: Map<string, Expected>, athleteId: string, today: string, weeks = 12): LoadWeek[] {
  const first = mondayOf(new Date(Date.parse(today) - (weeks - 1) * 7 * DAY).toISOString().slice(0, 10));
  const out = new Map<string, LoadWeek & { diffs: number[]; rpes: number[]; sleeps: number[]; recs: number[] }>();
  for (let i = 0; i < weeks; i++) {
    const week = new Date(Date.parse(first) + i * 7 * DAY).toISOString().slice(0, 10);
    out.set(week, { week, km: 0, vsDuePct: null, rpe: null, sleep: null, recovery: null, diffs: [], rpes: [], sleeps: [], recs: [] });
  }
  for (const w of workouts) if (w.athleteIds.includes(athleteId) && w.date <= today) { const b = out.get(mondayOf(w.date)); if (b) b.km += workoutMeters(w) / 1000; }
  for (const row of rows) {
    const exp = expected.get(row.log.id);
    const b = out.get(mondayOf(row.date));
    if (exp && b) b.diffs.push(((row.timeS - exp.targetS) / exp.targetS) * 100);
  }
  for (const e of wellness) {
    const b = out.get(mondayOf(e.date));
    if (!b) continue;
    if (e.rpe != null) b.rpes.push(e.rpe);
    if (e.sleepHours != null) b.sleeps.push(e.sleepHours);
    if (e.recovery != null) b.recs.push(e.recovery);
  }
  return [...out.values()].map(({ diffs, rpes, sleeps, recs, ...b }) => ({
    ...b,
    km: r1(b.km),
    vsDuePct: diffs.length >= 3 ? r1(mean(diffs)) : null,
    rpe: avgOrNull(rpes),
    sleep: avgOrNull(sleeps),
    recovery: avgOrNull(recs),
  }));
}

/** One sentence on how the athlete reacts when weekly km rise > 20 % over the 3 weeks before. */
export function loadConclusion(weeks: LoadWeek[]): Msg {
  const jumps: { d1: number; d2: number | null }[] = [];
  for (let i = 3; i < weeks.length - 1; i++) {
    const prev = weeks.slice(i - 3, i);
    const base = mean(prev.map((w) => w.km));
    const perf = prev.map((w) => w.vsDuePct).filter((x): x is number => x != null);
    const next = weeks[i + 1].vsDuePct;
    if (base <= 0 || weeks[i].km <= base * 1.2 || !perf.length || next == null) continue;
    const ref = mean(perf);
    const after = weeks[i + 2]?.vsDuePct;
    jumps.push({ d1: next - ref, d2: after == null ? null : after - ref });
  }
  if (jumps.length < 2) return { key: "Ainda não houve subidas de carga suficientes para ver como este atleta reage." };
  const d1 = mean(jumps.map((j) => j.d1));
  const d2s = jumps.map((j) => j.d2).filter((x): x is number => x != null);
  if (d1 <= 0.5) return { key: "Quando a carga sobe mais de 20 %, os tempos aguentam-se na semana seguinte: absorve bem a carga ({n} vezes).", vars: { n: jumps.length } };
  const recovers = d2s.length > 0 && mean(d2s) < d1 / 2;
  return {
    key: recovers
      ? "Quando a carga sobe mais de 20 %, os tempos pioram {pct} % na semana seguinte e recuperam na 2.ª ({n} vezes)."
      : "Quando a carga sobe mais de 20 %, os tempos pioram {pct} % na semana seguinte e ainda não recuperam na 2.ª ({n} vezes).",
    vars: { pct: r1(d1), n: jumps.length },
  };
}

/* ── Análise de prova ──────────────────────────────────────────────────────────────────── */

export type TaperVerdict = "pouca" | "adequada" | "demasiada";
export type RaceAnalysis = {
  summary: Msg[];
  vsBest: { bestDate: string; bestS: number; deltaS: number; reactionS: number | null; gains: { from: number; to: number; delta: number }[]; fastStart: boolean } | null;
  taper: { reductionPct: number; verdict: TaperVerdict; speedShareNow: number; speedShareBefore: number; lowSpeed: boolean } | null;
  trend: { recentPct: number; beforePct: number } | null;
  profile: { shortPct: number; longPct: number } | null;
  context: { sleep: number | null; sleepBefore: number | null; recovery: number | null; gym: number };
  vsDuePct: number | null;
};

const SPEED_BANDS = ["high", "race"] as const;
export function taperVerdict(reductionPct: number): TaperVerdict {
  return reductionPct < 30 ? "pouca" : reductionPct > 65 ? "demasiada" : "adequada";
}

/** Race vs personal best, taper, speed trend, 25/50 vs long profile and context in the weeks before. */
export function analyzeRace(
  session: RaceSession,
  sessions: RaceSession[],
  workouts: Workout[],
  wellness: WellnessEntry[],
  rows: TrainingRep[],
  expected: Map<string, Expected>,
): RaceAnalysis {
  const date = session.date;
  const summary: Msg[] = [];

  const earlier = sessions.filter((s) => s.id !== session.id && s.date < date && s.stroke === session.stroke && s.distanceM === session.distanceM && s.course === session.course && s.officialTimeS > 0);
  const best = earlier.sort((a, b) => a.officialTimeS - b.officialTimeS)[0];
  let vsBest: RaceAnalysis["vsBest"] = null;
  if (best) {
    const cmp = compareRaces(best, session);
    const swims = cmp.segments.filter((s) => s.kind === "swim");
    const fastStart = swims.length >= 2 && swims[0].delta < -0.1 && swims[swims.length - 1].delta > 0.2;
    const deltaS = Math.round((session.officialTimeS - best.officialTimeS) * 100) / 100;
    const reactionS = session.reactionS > 0 && best.reactionS > 0 ? Math.round((session.reactionS - best.reactionS) * 100) / 100 : null;
    vsBest = { bestDate: best.date, bestS: best.officialTimeS, deltaS, reactionS, gains: cmp.segments.map(({ from, to, delta }) => ({ from, to, delta })), fastStart };
    summary.push(deltaS <= 0 ? { key: "Melhorou o recorde pessoal em {s} s.", vars: { s: Math.abs(deltaS).toFixed(2) } } : { key: "Ficou {s} s acima do recorde pessoal.", vars: { s: deltaS.toFixed(2) } });
    const worst = [...cmp.segments].sort((a, b) => b.delta - a.delta)[0];
    if (worst && worst.delta > 0.1) summary.push({ key: "Onde mais perdeu: {from}–{to} m (+{s} s).", vars: { from: worst.from, to: worst.to, s: worst.delta.toFixed(2) } });
    if (fastStart) summary.push({ key: "Saiu mais rápido que no recorde e quebrou no fim: abertura rápida demais." });
  }

  const mine = workouts.filter((w) => w.athleteIds.includes(session.athleteId) && w.date < date);
  const within = (from: number, to: number) => mine.filter((w) => { const d = daysBetween(date, w.date); return d >= from && d <= to; });
  const metres = (ws: Workout[]) => ws.reduce((a, w) => a + workoutMeters(w), 0);
  const speed = (ws: Workout[]) => ws.reduce((a, w) => { const b = workoutBands(w).bands; return a + SPEED_BANDS.reduce((x, k) => x + b[k], 0); }, 0);
  const last = within(1, 14);
  const block = within(15, 42);
  let taper: RaceAnalysis["taper"] = null;
  if (metres(block) > 0) {
    const reductionPct = Math.round((1 - metres(last) / 2 / (metres(block) / 4)) * 100);
    const speedShareNow = metres(last) ? Math.round((speed(last) / metres(last)) * 100) : 0;
    const speedShareBefore = Math.round((speed(block) / metres(block)) * 100);
    const lowSpeed = speed(last) / 2 < (speed(block) / 4) * 0.5;
    taper = { reductionPct, verdict: taperVerdict(reductionPct), speedShareNow, speedShareBefore, lowSpeed };
    summary.push({
      key: taper.verdict === "adequada" ? "Polimento adequado: o volume desceu {pct} % face ao bloco anterior." : taper.verdict === "pouca" ? "Polimento curto: o volume só desceu {pct} % face ao bloco anterior." : "Polimento excessivo: o volume desceu {pct} % face ao bloco anterior.",
      vars: { pct: reductionPct },
    });
    if (lowSpeed) summary.push({ key: "Pouco estímulo de velocidade nas 2 semanas antes da prova." });
  }

  const pctOf = (from: number, to: number, filter: (r: TrainingRep) => boolean = () => true) => {
    const xs = rows
      .filter((r) => { const d = daysBetween(date, r.date); return d >= from && d <= to && filter(r); })
      .map((r) => { const e = expected.get(r.log.id); return e ? ((r.timeS - e.targetS) / e.targetS) * 100 : null; })
      .filter((x): x is number => x != null);
    return xs.length >= 3 ? r1(mean(xs)) : null;
  };
  const recentPct = pctOf(1, 7);
  const beforePct = pctOf(8, 21);
  const trend = recentPct != null && beforePct != null ? { recentPct, beforePct } : null;
  if (trend && Math.abs(trend.recentPct - trend.beforePct) >= 0.5)
    summary.push({ key: trend.recentPct < trend.beforePct ? "Nos últimos treinos estava a ficar mais rápido." : "Nos últimos treinos estava a ficar mais lento." });
  const shortPct = pctOf(1, 14, (r) => r.distanceM <= 50);
  const longPct = pctOf(1, 14, (r) => r.distanceM >= 200);
  const profile = shortPct != null && longPct != null ? { shortPct, longPct } : null;
  if (profile && profile.shortPct < -0.5 && profile.longPct > 0.5) summary.push({ key: "Mais forte nos 25/50 e pior nas séries longas: ganhou potência, perdeu resistência." });
  else if (profile && profile.shortPct > 0.5 && profile.longPct < -0.5) summary.push({ key: "Melhor nas séries longas e pior nos 25/50: tem resistência, faltou velocidade." });
  const vsDuePct = pctOf(1, 14);

  const win = (from: number, to: number) => wellness.filter((w) => { const d = daysBetween(date, w.date); return d >= from && d <= to; });
  const avg = (ws: WellnessEntry[], k: "sleepHours" | "recovery") => avgOrNull(ws.map((w) => w[k]).filter((x): x is number => x != null));
  const context = { sleep: avg(win(1, 14), "sleepHours"), sleepBefore: avg(win(15, 42), "sleepHours"), recovery: avg(win(1, 14), "recovery"), gym: win(1, 14).filter((w) => w.gym === "strength" || w.gym === "explosive").length };
  if (context.sleep != null && context.sleepBefore != null && context.sleep < context.sleepBefore - 0.5)
    summary.push({ key: "Dormiu menos nas 2 semanas antes ({h} h por noite).", vars: { h: r1(context.sleep) } });

  return { summary: summary.slice(0, 5), vsBest, taper, trend, profile, context, vsDuePct };
}

export const bestsKey = (stroke: Stroke | "", distanceM: number) => `${stroke}|${distanceM}`;

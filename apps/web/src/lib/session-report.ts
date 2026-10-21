import { loadChangePct, type Expected, type Msg } from "./coach-analysis";
import { compareTimes, median, type Verdict } from "./coach-verdict";
import type { TrainingRep } from "./training-context";
import type { WellnessEntry, Workout } from "./types";

/*
 * One session read like a coach's report (docs/natacao/benchmark-visualizacao.md D1–D5, D8):
 * a one-line verdict, then "correu bem" and "a melhorar" (3 points at most, strengths first), then one card
 * per set. Every point carries its number; causes are what *coincided* and was out of the swimmer's normal,
 * never a diagnosis; the next step is an option the coach owns.
 */

export type Audience = "coach" | "athlete";

export type SetSummary = {
  key: string;
  rows: TrainingRep[];
  reps: number;
  distanceM: number;
  intensity: string;
  gearLabel: string;
  meanS: number;
  /** Usual time for the set (median of the reps' targets), null when the set has no history at all. */
  dueS: number | null;
  /** Typical spread of this swimmer's reps in this kind of set (s). */
  te: number | null;
  /** How many earlier reps the target comes from. */
  history: number;
  verdict: Verdict;
  /** Best–worst rep (s). */
  spreadS: number;
  /** End of the set against its start (s; + = slower at the end): last third vs first third without rep 1
   *  (halves for 4–5 reps). Null under 4 reps. Thirds, so a fade in the last reps of a long set is not diluted. */
  endDeltaS: number | null;
  restS: number | null;
};

export type Point = { tone: "good" | "improve"; what: Msg; why?: Msg[]; next?: Msg };
export type SessionReport = { headline: Msg; tone: "good" | "mixed" | "improve" | "unclear"; points: Point[]; sets: SetSummary[] };
export type SessionContext = { workouts: Workout[]; wellness: WellnessEntry[]; athleteId: string };

const DAY = 86_400_000;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Group the session's reps into sets (block × segment × round) and summarise each against its target. */
export function summariseSets(rows: TrainingRep[], expected: Map<string, Expected>): SetSummary[] {
  const groups = new Map<string, TrainingRep[]>();
  for (const row of rows) {
    const key = `${row.blockId}|${row.segmentIndex}|${row.round}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const set = [...list].sort((a, b) => a.repInSegment - b.repInSegment);
    const head = set[0];
    const times = set.map((r) => r.timeS);
    const exps = set.map((r) => expected.get(r.log.id)).filter((e): e is Expected => Boolean(e));
    // Rep 1 of a longer set is usually slower (push start, settling in): judge the set without it.
    const judged = set.length >= 4 ? times.slice(1) : times;
    const dueS = exps.length ? median(exps.map((e) => e.targetS)) : null;
    const te = exps.length ? mean(exps.map((e) => e.noiseS)) : null;
    const history = exps.length ? Math.min(...exps.map((e) => e.n)) : 0;
    const rest = set.map((r) => r.restSeconds).filter((x): x is number => x != null);
    return {
      key,
      rows: set,
      reps: set.length,
      distanceM: head.distanceM,
      intensity: head.intensity,
      gearLabel: head.gearLabel,
      meanS: mean(judged),
      dueS,
      te,
      history,
      verdict: dueS != null && te != null ? compareTimes(mean(judged), judged.length, dueS, history, te) : { dir: "unclear", reason: "poucos-dados" },
      spreadS: Math.max(...times) - Math.min(...times),
      endDeltaS: endDelta(times),
      restS: rest.length ? median(rest) : null,
    } satisfies SetSummary;
  });
}

/** What coincided with a worse day and was out of this swimmer's normal. */
export function coincidedWith(rows: TrainingRep[], ctx: SessionContext, audience: Audience): Msg[] {
  const date = rows[0].date;
  const out: Msg[] = [];
  const recent = ctx.wellness.filter((w) => w.date < date && Date.parse(date) - Date.parse(w.date) <= 28 * DAY);
  const usualSleep = recent.map((w) => w.sleepHours).filter((x): x is number => x != null);
  const sleep = rows[0].sleepHours ?? ctx.wellness.find((w) => w.date === date)?.sleepHours ?? null;
  const sleepUsual = usualSleep.length >= 3 ? mean(usualSleep) : null;
  if (sleep != null && (sleep < 6.5 || (sleepUsual != null && sleep <= sleepUsual - 1)))
    out.push(
      sleepUsual != null
        ? { key: audience === "athlete" ? "dormiste {h} h (costumas {u} h)" : "dormiu {h} h (costuma {u} h)", vars: { h: r1(sleep), u: r1(sleepUsual) } }
        : { key: audience === "athlete" ? "dormiste {h} h" : "dormiu {h} h", vars: { h: r1(sleep) } },
    );
  if (audience === "athlete") return out;
  const today = ctx.wellness.find((w) => w.date === date);
  const usualRec = recent.map((w) => w.recovery).filter((x): x is number => x != null);
  if (today?.recovery != null && usualRec.length >= 3 && today.recovery <= mean(usualRec) - 1)
    out.push({ key: "recuperação {r}/5 (costuma {u}/5)", vars: { r: today.recovery, u: r1(mean(usualRec)) } });
  const yesterday = new Date(Date.parse(date) - DAY).toISOString().slice(0, 10);
  const gym = ctx.wellness.find((w) => w.date === yesterday)?.gym;
  if (gym === "strength" || gym === "explosive") out.push({ key: "ginásio de força na véspera" });
  if (rows[0].trainedEarlierToday) out.push({ key: "segunda sessão do dia" });
  const load = loadChangePct(ctx.workouts, ctx.athleteId, date);
  if (load != null && load > 20) out.push({ key: "semana com {pct} % mais metros que as 3 anteriores", vars: { pct: Math.round(load) } });
  return out;
}

function endDelta(times: number[]): number | null {
  if (times.length < 4) return null;
  if (times.length < 6) return mean(times.slice(times.length - (times.length >> 1))) - mean(times.slice(0, times.length >> 1));
  const k = Math.max(2, Math.floor(times.length / 3));
  return mean(times.slice(-k)) - mean(times.slice(1, 1 + k));
}

const label = (s: SetSummary) => ({ reps: s.reps, dist: s.distanceM, zone: s.intensity });

/** The session as a report: verdict, strengths, what to improve (3 points max), and the sets. */
export function sessionReport(rows: TrainingRep[], expected: Map<string, Expected>, ctx: SessionContext, audience: Audience = "coach"): SessionReport {
  const sets = summariseSets(rows, expected);
  // Easy swimming (warm-up, swim-down) is shown but never judged: a coach does not read a 200 easy.
  const main = sets.filter((s) => s.intensity !== "SUAVE" && s.dueS != null);
  const athlete = audience === "athlete";
  if (!main.length) return { headline: { key: "Ainda não dá para ler este treino: faltam tempos das séries principais." }, tone: "unclear", points: [], sets };

  const good: Point[] = [];
  const fasterSets: SetSummary[] = [];
  const regularSets: SetSummary[] = [];
  const heldSets: SetSummary[] = [];
  const improve: Point[] = [];
  const causes = rows.length ? coincidedWith(rows, ctx, audience) : [];
  let drop: SetSummary | null = null;

  for (const s of main) {
    const te = s.te ?? 0;
    const diffs = s.rows.map((r) => r.timeS - (s.dueS ?? r.timeS));
    if (s.reps >= 5) {
      const first = diffs.slice(1, 4);
      const last = diffs.slice(-3);
      const fall = mean(last) - mean(first);
      if (fall > 2 * te && last.filter((d) => d > 2 * te).length >= 2) {
        const start = diffs.findIndex((_, i) => i > 0 && diffs.slice(i).every((d) => d > te));
        const from = start > 0 ? start : s.reps - 3;
        const why: Msg[] = s.restS != null && s.restS < 5 ? [{ key: "saída com só {s} s de descanso", vars: { s: Math.round(s.restS) } }, ...causes] : causes;
        drop ??= s;
        improve.push({
          tone: "improve",
          what: {
            key: athlete ? "Nos {reps}×{dist} {zone} perdeste ritmo a partir da rep {n} (+{s} s por rep)." : "Quebrou a partir da rep {n} nos {reps}×{dist} {zone}: +{s} s por rep até ao fim.",
            vars: { ...label(s), n: from + 1, s: r1(fall / Math.max(1, s.reps - 3)) },
          },
          why,
          next: athlete
            ? { key: "Foco para a próxima: manter o ritmo das primeiras reps até ao fim." }
            : { key: "Para a próxima, pode ajudar: mais 5 s de saída, ou {k} reps em vez de {n}.", vars: { k: from, n: s.reps } },
        });
        continue;
      }
      const firstHalf = mean(diffs.slice(0, s.reps >> 1));
      const lastHalf = mean(diffs.slice(s.reps >> 1));
      if (firstHalf - lastHalf > 2 * te && firstHalf > te) {
        improve.push({
          tone: "improve",
          what: {
            key: athlete ? "Nos {reps}×{dist} {zone} começaste devagar e só acelerou na 2.ª metade." : "Começou a guardar-se nos {reps}×{dist} {zone}: 1.ª metade {s} s acima do habitual, depois acelerou.",
            vars: { ...label(s), s: r1(firstHalf) },
          },
          why: s.rows[0].restVsSet === "more" && s.restS != null ? [{ key: "saída com {s} s de descanso, mais que o habitual", vars: { s: Math.round(s.restS) } }] : [],
          next: { key: athlete ? "Foco para a próxima: sair no tempo pedido desde a 1.ª rep." : "Para a próxima: pedir o tempo habitual desde a 1.ª rep." },
        });
        continue;
      }
    }
    const perRep = r1(Math.abs(s.meanS - (s.dueS ?? s.meanS)));
    if (s.verdict.dir === "slower" && s.verdict.certainty) {
      improve.push({
        tone: "improve",
        what: { key: athlete ? "Nos {reps}×{dist} {zone} estiveste {s} s por rep acima do teu habitual." : "Mais lento que o habitual nos {reps}×{dist} {zone}: +{s} s por rep.", vars: { ...label(s), s: perRep } },
        why: causes,
        next: { key: athlete ? "Um treino não é tendência: o próximo diz mais." : "Uma sessão não é tendência: ver a próxima antes de mudar o plano." },
      });
    } else if (s.verdict.dir === "faster" && s.verdict.certainty) {
      fasterSets.push(s);
    } else if (s.reps >= 6 && s.verdict.dir !== "slower" && s.te != null && s.spreadS <= Math.min(2 * s.te, 0.02 * s.meanS)) {
      regularSets.push(s);
    } else if (s.reps >= 6 && s.verdict.dir !== "slower" && s.endDeltaS != null && s.te != null && s.endDeltaS <= 0.5 * s.te) {
      heldSets.push(s);
    }
  }
  // Same kind of strength in several sets is said once, with the sets listed.
  const names = (list: SetSummary[]) => list.map((x) => `${x.reps}×${x.distanceM} ${x.intensity}`).join(", ");
  if (fasterSets.length === 1) {
    const f = fasterSets[0];
    good.push({
      tone: "good",
      what: {
        key: athlete ? "Nos {reps}×{dist} {zone} foste {s} s por rep mais rápido que o teu habitual." : "Mais rápido que o habitual nos {reps}×{dist} {zone}: −{s} s por rep.",
        vars: { ...label(f), s: r1(Math.abs(f.meanS - (f.dueS ?? f.meanS))) },
      },
      next: athlete ? undefined : { key: "Se se repetir, pode ser altura de pedir um tempo mais exigente nesta série." },
    });
  } else if (fasterSets.length > 1)
    good.push({
      tone: "good",
      what: { key: athlete ? "Mais rápido que o teu habitual em {n} séries: {list}." : "Mais rápido que o habitual em {n} séries: {list}.", vars: { n: fasterSets.length, list: names(fasterSets) } },
      next: athlete ? undefined : { key: "Se se repetir, pode ser altura de pedir tempos mais exigentes nestas séries." },
    });
  if (regularSets.length === 1)
    good.push({ tone: "good", what: { key: athlete ? "Regular nos {reps}×{dist} {zone}: todas dentro de {s} s." : "Regular nos {reps}×{dist} {zone}: todas as reps dentro de {s} s.", vars: { ...label(regularSets[0]), s: r1(regularSets[0].spreadS) } } });
  else if (regularSets.length > 1) good.push({ tone: "good", what: { key: "Regular em {n} séries: {list}.", vars: { n: regularSets.length, list: names(regularSets) } } });
  if (heldSets.length === 1)
    good.push({ tone: "good", what: { key: athlete ? "Aguentaste o ritmo até ao fim nos {reps}×{dist} {zone}." : "Aguentou o ritmo até ao fim nos {reps}×{dist} {zone}.", vars: label(heldSets[0]) } });
  else if (heldSets.length > 1)
    good.push({ tone: "good", what: { key: athlete ? "Aguentaste o ritmo até ao fim em {n} séries: {list}." : "Aguentou o ritmo até ao fim em {n} séries: {list}.", vars: { n: heldSets.length, list: names(heldSets) } } });
  for (const p of improve) if (p.why && !p.why.length) p.why = [{ key: "sem causa clara nos dados" }];

  const faster = main.filter((s) => s.verdict.dir === "faster" && s.verdict.certainty).length;
  const slower = main.filter((s) => s.verdict.dir === "slower" && s.verdict.certainty).length;
  const unclear = main.filter((s) => s.verdict.dir === "unclear" && s.verdict.reason === "poucos-dados").length;
  let headline: Msg;
  let tone: SessionReport["tone"];
  if (drop) {
    headline = { key: good.length ? "Bom treino, mas quebrou no fim dos {reps}×{dist} {zone}." : "Treino com quebra no fim dos {reps}×{dist} {zone}.", vars: label(drop) };
    tone = good.length ? "mixed" : "improve";
  } else if (unclear === main.length) {
    headline = { key: "Ainda não dá para dizer: estas séries foram feitas poucas vezes." };
    tone = "unclear";
  } else if (slower * 2 >= main.length && slower > 0) {
    headline = { key: "Treino mais lento que o habitual: {k} de {m} séries mais lentas.", vars: { k: slower, m: main.length } };
    tone = "improve";
  } else if (faster > 0 && slower === 0) {
    headline = { key: "Treino mais rápido que o habitual: {k} de {m} séries mais rápidas.", vars: { k: faster, m: main.length } };
    tone = "good";
  } else if (faster > 0 && slower > 0) {
    headline = { key: "Treino misto: {f} de {m} séries mais rápidas que o habitual e {s} mais lentas.", vars: { f: faster, s: slower, m: main.length } };
    tone = "mixed";
  } else if (slower > 0) {
    headline = { key: "Quase tudo ao nível habitual: {k} de {m} séries mais lentas.", vars: { k: slower, m: main.length } };
    tone = "mixed";
  } else {
    headline = { key: "Treino ao nível habitual: {m} séries dentro do habitual.", vars: { m: main.length } };
    tone = "good";
  }

  // Strength first, then what to improve; 3 points at most (1 + 1 for the swimmer).
  const maxGood = athlete ? 1 : Math.max(1, 3 - Math.min(2, improve.length));
  const points = [...good.slice(0, maxGood), ...improve.slice(0, athlete ? 1 : 2)];
  return { headline, tone, points, sets };
}

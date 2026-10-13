import type { Msg } from "./coach-analysis";
import { compareTimes, median, typicalError, type Verdict } from "./coach-verdict";
import type { TrainingRep } from "./training-context";

/*
 * "Está a melhorar?" per kind of set, never averages that mix a 50 MAX with a 400 A1
 * (docs/natacao/benchmark-visualizacao.md D11). One observation = one session's mean on that kind of set.
 * Recent = the last 14 days; baseline = the 6 weeks before (15–56 days). Verdict from coach-verdict.ts.
 */

export type SessionPoint = { date: string; workoutId: string; meanS: number; reps: number };
export type SetKind = {
  key: string;
  distanceM: number;
  intensity: string;
  stroke: string;
  gearLabel: string;
  course: string;
  points: SessionPoint[];
  baselineS: number | null;
  /** Mean of the sessions in the last 14 days. */
  recentS: number | null;
  te: number | null;
  verdict: Verdict;
  /** Recent mean minus baseline (s per rep; − = faster). */
  deltaS: number | null;
  /** The latest session is the best mean of the window. */
  newBest: boolean;
};
export type Evolution = { headline: Msg; kinds: SetKind[] };

const DAY = 86_400_000;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const kindKey = (r: TrainingRep) => `${r.course}|${r.stroke}|${r.distanceM}|${r.intensity}|${[...r.gear].sort().join("+")}`;

export function evolution(rows: TrainingRep[], today: string): Evolution {
  const groups = new Map<string, TrainingRep[]>();
  for (const r of rows) if (r.intensity !== "SUAVE") groups.set(kindKey(r), [...(groups.get(kindKey(r)) ?? []), r]);
  const age = (date: string) => Math.round((Date.parse(today) - Date.parse(date)) / DAY);
  const kinds: SetKind[] = [];
  for (const [key, list] of groups) {
    const byWorkout = new Map<string, TrainingRep[]>();
    for (const r of list) byWorkout.set(r.workoutId, [...(byWorkout.get(r.workoutId) ?? []), r]);
    const points = [...byWorkout.values()]
      .map((reps) => ({ date: reps[0].date, workoutId: reps[0].workoutId, meanS: mean(reps.map((r) => r.timeS)), reps: reps.length }))
      // Only the 8 weeks compared (2 recent + 6 baseline): what is shown is what the verdict uses.
      .filter((p) => age(p.date) <= 56)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length < 3) continue;
    const recent = points.filter((p) => age(p.date) <= 14);
    const base = points.filter((p) => age(p.date) > 14 && age(p.date) <= 56);
    const baselineS = base.length ? median(base.map((p) => p.meanS)) : null;
    const te = baselineS != null ? typicalError(base.map((p) => p.meanS), baselineS) : null;
    const recentS = recent.length ? mean(recent.map((p) => p.meanS)) : null;
    const verdict: Verdict =
      recentS != null && baselineS != null && te != null ? compareTimes(recentS, recent.length, baselineS, base.length, te) : { dir: "unclear", reason: "poucos-dados" };
    const last = points[points.length - 1];
    const head = list[0];
    kinds.push({
      key,
      distanceM: head.distanceM,
      intensity: head.intensity,
      stroke: head.stroke,
      gearLabel: head.gearLabel,
      course: head.course,
      points,
      baselineS,
      recentS,
      te,
      verdict,
      deltaS: recentS != null && baselineS != null ? recentS - baselineS : null,
      newBest: age(last.date) <= 14 && points.length >= 4 && points.every((p) => p === last || p.meanS > last.meanS),
    });
  }
  // Changes first (so what is shown backs up the headline), then the most practised sets.
  const rank = (k: SetKind) => (k.verdict.dir === "faster" || k.verdict.dir === "slower" ? 0 : k.verdict.dir === "same" ? 1 : 2);
  kinds.sort((a, b) => rank(a) - rank(b) || b.points.length - a.points.length);
  const judged = kinds.filter((k) => k.verdict.dir !== "unclear");
  const better = judged.filter((k) => k.verdict.dir === "faster").length;
  const worse = judged.filter((k) => k.verdict.dir === "slower").length;
  const headline: Msg = !judged.length
    ? { key: "Ainda não dá para dizer: poucas séries repetidas nas últimas semanas." }
    : better && !worse
      ? { key: "A melhorar: mais rápido em {k} de {m} tipos de série nas últimas 2 semanas.", vars: { k: better, m: judged.length } }
      : worse && !better
        ? { key: "Mais lento em {k} de {m} tipos de série nas últimas 2 semanas.", vars: { k: worse, m: judged.length } }
        : better || worse
          ? { key: "Misto: mais rápido em {b} e mais lento em {w} de {m} tipos de série.", vars: { b: better, w: worse, m: judged.length } }
          : { key: "Estável: ao nível habitual em {m} tipos de série.", vars: { m: judged.length } };
  return { headline, kinds };
}

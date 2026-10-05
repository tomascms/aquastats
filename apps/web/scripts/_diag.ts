import { generateDataset, SCENARIOS, DEFAULT_VARIANT } from "../src/lib/ml/synthetic";
import { teamData, dayNumber } from "../src/lib/ml/backtest";
import { groupKey } from "../src/lib/training-prediction";
for (const name of Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]) {
  const t0 = Date.now();
  const ds = generateDataset(name, 1001);
  const team = teamData(ds);
  const reps = [...team.rows.values()].reduce((s, r) => s + r.length, 0);
  console.log(name.padEnd(16), "workouts", ds.workouts.length, "logs", ds.timeLogs.length, "reps", reps, "wellness", ds.athletes.reduce((s, a) => s + a.wellness.length, 0), `${Date.now() - t0}ms`, ds.dataStart, ds.dataEnd);
}
// Return effect: per athlete & group, median of first 14 days back vs days 120..21 before the season end.
for (const name of ["regresso-curta", "regresso-longa", "regresso-tardia"] as const) {
  const ratios: number[] = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const ds = generateDataset(name, seed, { ...DEFAULT_VARIANT, data: "completos" });
    const team = teamData(ds);
    for (const [id, rows] of team.rows) {
      const back = dayNumber(ds.returns[1].athletes[id]);
      const clean = rows.filter(r => ds.truth.get(r.log.id)?.error == null);
      const byKey = new Map<string, { b: number[]; a: number[] }>();
      for (const r of clean) {
        const d = dayNumber(r.date);
        const k = groupKey(r); const e = byKey.get(k) ?? { b: [], a: [] };
        if (d < back && back - d > 21 + 60 && back - d < 200) e.b.push(ds.truth.get(r.log.id)!.expectedS);
        if (d >= back && d - back < 14) e.a.push(ds.truth.get(r.log.id)!.expectedS);
        byKey.set(k, e);
      }
      for (const e of byKey.values()) if (e.b.length >= 3 && e.a.length >= 2) {
        const m = (l: number[]) => [...l].sort((x, y) => x - y)[Math.floor(l.length / 2)];
        ratios.push(m(e.a) / m(e.b));
      }
    }
  }
  ratios.sort((a, b) => a - b);
  console.log(name, "n", ratios.length, "median after/before", ratios[Math.floor(ratios.length / 2)]?.toFixed(4), "p25", ratios[Math.floor(ratios.length / 4)]?.toFixed(4), "p75", ratios[Math.floor(ratios.length * 3 / 4)]?.toFixed(4));
}

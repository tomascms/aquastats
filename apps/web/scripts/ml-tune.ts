/*
 * Design-time tuning of the state model's options, on seeds that never decide anything (tuning 1–5
 * plus the old test seeds 1001–1015 when asked). Pooled MAPE over the four decision scenarios, raw
 * state model (the conformal layer does not move the point forecast).
 *
 *   npx tsx scripts/ml-tune.ts --horizon rep --grid withinSetAR=0,0.1,0.2,0.3,0.4
 *   npx tsx scripts/ml-tune.ts --horizon day --search levelSdPerDay,dayPhi,daySd,sessionSd,repSdRel
 */
import { evaluationRows, HORIZONS, teamData, type Dataset, type EvalRow, type TeamData } from "../src/lib/ml/backtest";
import { runStateModel } from "../src/lib/ml/forecaster";
import { suspectsFor } from "../src/lib/ml/predictors";
import { ACCEPTED } from "../src/lib/ml/registry";
import { DEFAULT_OPTIONS, type StateModelOptions } from "../src/lib/ml/state-model";
import { BASE_SCENARIOS, generateDataset, REGIME_SCENARIOS } from "../src/lib/ml/synthetic";

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : null);
const horizonKey = (flag("horizon") ?? "day") as keyof typeof HORIZONS;
const seeds = flag("seeds") === "wide" ? [1, 2, 3, 4, 5, ...Array.from({ length: 15 }, (_, i) => 1001 + i)] : [1, 2, 3, 4, 5];
const base: StateModelOptions = { ...DEFAULT_OPTIONS, ...ACCEPTED, ...(flag("set") ? Object.fromEntries(flag("set")!.split(",").map((kv) => [kv.split("=")[0], Number(kv.split("=")[1])])) : {}) };

type Case = { scenario: string; team: TeamData; rows: EvalRow[]; excluded: Set<string> };
const cases: Case[] = [];
for (const scenario of flag("cells") === "regime" ? REGIME_SCENARIOS : BASE_SCENARIOS) {
  for (const seed of flag("cells") === "regime" ? seeds.filter((seed) => seed <= 3) : seeds) {
    const dataset = generateDataset(scenario, seed) as unknown as Dataset;
    const team = teamData(dataset);
    cases.push({ scenario, team, rows: evaluationRows(team, dataset).filter((row) => row.clean), excluded: new Set(suspectsFor(team, HORIZONS[horizonKey]).keys()) });
  }
}

/**
 * Pooled score: mean over scenarios of the mean over seeds. `--objective mape` (default): MAPE (%) on
 * `--horizon`; `--objective loglik`: Gaussian negative log predictive density of log(time), averaged
 * over the day and next-rep horizons (the pre-registered objective of E5).
 */
const objective = flag("objective") ?? "mape";
const horizons: (keyof typeof HORIZONS)[] = objective === "loglik" ? ["day", "rep"] : [horizonKey];
const excludedBy = new Map(cases.map((item) => [item, new Map(horizons.map((h) => [h, new Set(suspectsFor(item.team, HORIZONS[h]).keys())]))]));
function score(options: StateModelOptions): number {
  const byScenario = new Map<string, number[]>();
  for (const item of cases) {
    let total = 0;
    for (const h of horizons) {
      const forecasts = runStateModel(item.team, HORIZONS[h], options, excludedBy.get(item)!.get(h)!);
      let sum = 0;
      let n = 0;
      for (const row of item.rows) {
        const forecast = forecasts.get(row.row.log.id);
        if (!forecast) continue;
        if (objective === "loglik") {
          const z = (Math.log(row.row.timeS) - forecast.logMean) / forecast.logSd;
          sum += Math.log(forecast.logSd) + 0.5 * z * z;
        } else sum += Math.abs(forecast.meanS / row.row.timeS - 1) * 100;
        n += 1;
      }
      total += sum / n / horizons.length;
    }
    byScenario.set(item.scenario, [...(byScenario.get(item.scenario) ?? []), total]);
  }
  const means = [...byScenario.values()].map((list) => list.reduce((a, b) => a + b, 0) / list.length);
  return means.reduce((a, b) => a + b, 0) / means.length;
}

const grid = flag("grid");
if (grid) {
  const [key, values] = grid.split("=");
  for (const value of values.split(",").map(Number)) console.log(`${key}=${value}: ${score({ ...base, [key]: value }).toFixed(4)}%`);
} else {
  // Coordinate search in log steps (×0.5, ×0.7, ×1.4, ×2), two passes.
  const keys = (flag("search") ?? "").split(",").filter(Boolean) as (keyof StateModelOptions)[];
  let current = { ...base };
  let best = score(current);
  console.log(`start: ${best.toFixed(4)}`);
  for (let pass = 0; pass < 2; pass += 1) {
    for (const key of keys) {
      for (const factor of [0.5, 0.7, 1.4, 2]) {
        const value = (current[key] as number) * factor;
        if (key === "dayPhi" && value >= 0.95) continue;
        const candidate = { ...current, [key]: value };
        const s = score(candidate);
        if (s < best - 1e-4) {
          best = s;
          current = candidate;
          console.log(`  ${key} → ${value.toPrecision(3)}: ${s.toFixed(4)}`);
        }
      }
    }
  }
  console.log(`final: ${best.toFixed(4)}`, Object.fromEntries(keys.map((key) => [key, current[key]])));
}

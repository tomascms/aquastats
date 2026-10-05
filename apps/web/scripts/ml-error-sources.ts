/*
 * Where is the error? Decomposes the champion's error into the part no model could remove (the
 * oracle's, synthetic truth) and the reducible rest, by source: cold start of a kind of rep, the
 * athlete's weeks of history, intensity, position in the set, athlete type, in-set cliffs.
 * Exploration only (design): run on seeds that no longer decide anything (tuning 1–5, old test
 * 1001–1015). Run: npx tsx scripts/ml-error-sources.ts [--seeds 1,2,3] [--scenarios tipico,denso]
 */
import { evaluationRows, HORIZONS, teamData, type Dataset, type EvalRow } from "../src/lib/ml/backtest";
import { runStateModel } from "../src/lib/ml/forecaster";
import { suspectsFor } from "../src/lib/ml/predictors";
import { DEFAULT_OPTIONS } from "../src/lib/ml/state-model";
import { BASE_SCENARIOS, generateDataset, type ScenarioName, type SyntheticDataset } from "../src/lib/ml/synthetic";

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : null);
const seeds = (flag("seeds") ?? "1,2,3,4,5,1001,1002,1003,1004,1005").split(",").map(Number);
const scenarios = (flag("scenarios")?.split(",") ?? BASE_SCENARIOS) as ScenarioName[];

type Item = { model: number; oracle: number; cold: boolean; keys: Record<string, string> };

const bucketWeeks = (weeks: number) => (weeks < 2 ? "0–1" : weeks < 4 ? "2–3" : weeks < 8 ? "4–7" : weeks < 16 ? "8–15" : "16+");
const bucketHistory = (n: number) => (n === 0 ? "0" : n === 1 ? "1" : n <= 3 ? "2–3" : n <= 7 ? "4–7" : n <= 15 ? "8–15" : "16+");
const bucketPosition = (n: number) => (n === 1 ? "1.ª" : n === 2 ? "2.ª" : n === 3 ? "3.ª" : n <= 6 ? "4.ª–6.ª" : "7.ª+");

function collect(horizon: "day" | "rep"): Map<string, Item[]> {
  const byScenario = new Map<string, Item[]>();
  for (const scenario of scenarios) {
    const items: Item[] = [];
    for (const seed of seeds) {
      const dataset = generateDataset(scenario, seed) as SyntheticDataset;
      const team = teamData(dataset as unknown as Dataset);
      const evalRows = evaluationRows(team, dataset as unknown as Dataset);
      const excluded = new Set(suspectsFor(team, HORIZONS[horizon]).keys());
      const forecasts = runStateModel(team, HORIZONS[horizon], DEFAULT_OPTIONS, excluded);
      for (const item of evalRows as EvalRow[]) {
        if (!item.clean) continue;
        const forecast = forecasts.get(item.row.log.id);
        const truth = dataset.truth.get(item.row.log.id);
        if (!forecast || !truth) continue;
        const actual = item.row.timeS;
        const oracle = horizon === "day" ? truth.dayAheadS : truth.expectedS;
        items.push({
          model: (Math.abs(forecast.meanS - actual) / actual) * 100,
          oracle: (Math.abs(oracle - actual) / actual) * 100,
          cold: forecast.newFactors > 0,
          keys: {
            "Tipo de rep nova (fator por estimar)": forecast.newFactors > 0 ? "nova" : "conhecida",
            "Reps anteriores do mesmo grupo": bucketHistory(item.groupHistory),
            "Semanas de histórico do atleta": bucketWeeks(item.weeksOfHistory),
            Intensidade: item.row.intensity,
            "Posição na série": bucketPosition(item.row.repInSegment),
            "Tipo de atleta": dataset.athleteTypes.get(item.athleteId) ?? "típico",
            "Precipício (verdade)": truth.cliff ? "sim" : "não",
          },
        });
      }
    }
    byScenario.set(scenario, items);
  }
  return byScenario;
}

const fmt = (value: number, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : "—");
const lines: string[] = [`# De onde vem o erro (campeão vs oráculo) — sementes ${seeds.join(", ")}`, ""];
for (const horizon of ["day", "rep"] as const) {
  const byScenario = collect(horizon);
  lines.push(`## Horizonte ${horizon === "day" ? "dia (oráculo da véspera)" : "próxima rep (oráculo no dia)"}`, "");
  lines.push("| Cenário | Reps | MAPE campeão | MAPE oráculo | Redutível (pp) |", "|---|---|---|---|---|");
  for (const [scenario, items] of byScenario) {
    const model = items.reduce((sum, item) => sum + item.model, 0) / items.length;
    const oracle = items.reduce((sum, item) => sum + item.oracle, 0) / items.length;
    lines.push(`| ${scenario} | ${items.length} | ${fmt(model)}% | ${fmt(oracle)}% | ${fmt(model - oracle)} |`);
  }
  lines.push("");
  const all = [...byScenario.values()].flat();
  const totalReducible = all.reduce((sum, item) => sum + item.model - item.oracle, 0);
  for (const dimension of Object.keys(all[0].keys)) {
    lines.push(`### ${dimension} (todos os cenários)`, "", "| Valor | % das reps | MAPE campeão | MAPE oráculo | Redutível (pp) | % do erro redutível |", "|---|---|---|---|---|---|");
    const groups = new Map<string, Item[]>();
    for (const item of all) groups.set(item.keys[dimension], [...(groups.get(item.keys[dimension]) ?? []), item]);
    for (const [value, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
      const model = list.reduce((sum, item) => sum + item.model, 0) / list.length;
      const oracle = list.reduce((sum, item) => sum + item.oracle, 0) / list.length;
      const reducible = list.reduce((sum, item) => sum + item.model - item.oracle, 0);
      lines.push(`| ${value} | ${fmt((list.length / all.length) * 100, 1)} | ${fmt(model)}% | ${fmt(oracle)}% | ${fmt(model - oracle)} | ${fmt((reducible / totalReducible) * 100, 0)} % |`);
    }
    lines.push("");
  }
}
console.log(lines.join("\n"));

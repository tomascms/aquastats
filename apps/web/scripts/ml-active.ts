/*
 * Active learning: does "time the set the model is least sure about" teach it more than timing a
 * random set? Simulated on synthetic data where every set was timed (so the truth of every rep is
 * known): each session, the model may learn from one set only — chosen at random, or by the
 * uncertainty policy — and is scored on ALL reps of the following days.
 *
 *   npx tsx scripts/ml-active.ts --seeds tune
 *   npx tsx scripts/ml-active.ts --seeds test --save fase-i-aprendizagem-ativa
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bootstrapMean, evaluationRows, HORIZONS, metricsOf, teamData, type Dataset } from "../src/lib/ml/backtest";
import { runStateModel, type RunHooks } from "../src/lib/ml/forecaster";
import { setOf, uncertaintyPolicy } from "../src/lib/ml/production";
import { teamSuspects } from "../src/lib/ml/quality";
import { createRng } from "../src/lib/ml/rng";
import { DEFAULT_OPTIONS } from "../src/lib/ml/state-model";
import { DEFAULT_VARIANT, generateDataset, type ScenarioName } from "../src/lib/ml/synthetic";
import type { TrainingRep } from "../src/lib/training-context";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? "") : null;
};
const test = flag("seeds") === "test";
const seeds = test ? Array.from({ length: 10 }, (_, i) => 1001 + i) : [1, 2, 3];
const scenarios: ScenarioName[] = ["esparso", "tipico"];

function randomPolicy(seed: number) {
  const rng = createRng(seed);
  return (today: TrainingRep[]) => {
    const bySession = new Map<string, Map<string, TrainingRep[]>>();
    for (const row of today) {
      const session = bySession.get(row.workoutId) ?? new Map<string, TrainingRep[]>();
      session.set(setOf(row), [...(session.get(setOf(row)) ?? []), row]);
      bySession.set(row.workoutId, session);
    }
    const chosen = new Set<string>();
    for (const sets of bySession.values()) for (const row of rng.pick([...sets.values()])) chosen.add(row.log.id);
    return chosen;
  };
}

const lines = ["| Cenário | Semente | Todas as séries | Ao acaso (1 por sessão) | Pela incerteza (1 por sessão) |", "|---|---|---|---|---|"];
const summary: string[] = [];
for (const scenario of scenarios) {
  const deltas: number[] = [];
  for (const seed of seeds) {
    const dataset = generateDataset(scenario, seed, { ...DEFAULT_VARIANT, data: "completos" }) as unknown as Dataset;
    const team = teamData(dataset);
    const suspects = new Set(teamSuspects(team.rows).keys());
    const evalRows = evaluationRows(team, dataset).filter((item) => item.clean && item.weeksOfHistory >= 2);
    const score = (select?: RunHooks["select"]) => {
      const forecasts = runStateModel(team, HORIZONS.day, DEFAULT_OPTIONS, suspects, { select });
      return metricsOf(evalRows.map((item) => ({ row: item.row, actual: item.row.timeS, prediction: forecasts.has(item.row.log.id) ? { mean: forecasts.get(item.row.log.id)!.meanS } : undefined }))).mapePct;
    };
    const random = randomPolicy(seed);
    const all = score();
    const randomMape = score((_id, _day, today) => random(today));
    const activeMape = score((_id, _day, today, filter, prior) => uncertaintyPolicy(filter, today, prior));
    deltas.push(activeMape - randomMape);
    lines.push(`| ${scenario} | ${seed} | ${all.toFixed(3)}% | ${randomMape.toFixed(3)}% | ${activeMape.toFixed(3)}% |`);
    console.error(`${scenario} ${seed}: all ${all.toFixed(3)} random ${randomMape.toFixed(3)} active ${activeMape.toFixed(3)}`);
  }
  const ci = bootstrapMean(deltas);
  summary.push(`- **${scenario}**: Δ MAPE (incerteza − acaso) = ${ci.mean.toFixed(3)} pp [IC 95 % ${ci.lo.toFixed(3)}; ${ci.hi.toFixed(3)}] em ${deltas.length} sementes.`);
}
const md = [
  `# Aprendizagem ativa — que série cronometrar (${test ? "sementes de teste" : "sementes de ajuste"})`,
  "",
  "Dados sintéticos com todas as séries cronometradas (a verdade de cada rep é conhecida). Em cada sessão o modelo só aprende com **uma** série; avalia-se o MAPE em **todas** as reps dos dias seguintes (a partir da 3.ª semana).",
  "",
  ...summary,
  "",
  ...lines,
  "",

].join("\n");
console.log(md);
const save = flag("save");
if (save) {
  let dir = process.cwd();
  while (!existsSync(join(dir, "apps")) || !existsSync(join(dir, "docs"))) dir = dirname(dir);
  mkdirSync(join(dir, "docs", "ml", "results"), { recursive: true });
  writeFileSync(join(dir, "docs", "ml", "results", `${save}.md`), md);
}

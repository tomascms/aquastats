/*
 * Precision/recall of the suspect-time detector against the synthetic truth.
 *
 *   npx tsx scripts/ml-quality.ts --seeds tune
 *   npx tsx scripts/ml-quality.ts --seeds test --save quality-test
 *
 * A typing error is "material" when it moves the time by more than 2 %; errors that leave the time
 * (almost) unchanged — 33 s with its digits swapped — cannot and need not be found.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isPlausibleRep } from "../src/lib/training-context";
import { teamData, type Dataset } from "../src/lib/ml/backtest";
import { teamSuspects, type QualityOptions } from "../src/lib/ml/quality";
import { BASE_SCENARIOS, DEFAULT_VARIANT, generateDataset, type ScenarioName } from "../src/lib/ml/synthetic";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? "") : null;
};
const seeds = flag("seeds") === "test" ? Array.from({ length: 15 }, (_, i) => 1001 + i) : [1, 2, 3, 4, 5];
const options: QualityOptions = {
  setThreshold: flag("set") ? Number(flag("set")) : undefined,
  historyThreshold: flag("history") ? Number(flag("history")) : undefined,
  withinDayCausal: args.includes("--causal"),
};
const scenarios = (flag("scenarios") ?? [...BASE_SCENARIOS, "multiano"].join(",")).split(",") as ScenarioName[];

type Count = { tp: number; fp: number; fn: number; corrected: number; immaterial: number; total: number };
const empty = (): Count => ({ tp: 0, fp: 0, fn: 0, corrected: 0, immaterial: 0, total: 0 });
const lines: string[] = ["| Cenário | Reps | Erros materiais | Assinalados | Precisão | Recall | Falsos alarmes / 1000 reps limpas | Sugestão certa |", "|---|---|---|---|---|---|---|---|"];
const byType = new Map<string, Count>();
const totals = empty();
for (const scenario of scenarios) {
  const count = empty();
  let reps = 0;
  for (const seed of scenario === "multiano" ? seeds.slice(0, 3) : seeds) {
    const dataset = generateDataset(scenario, seed, DEFAULT_VARIANT);
    const team = teamData(dataset as unknown as Dataset);
    const suspects = teamSuspects(team.rows, options);
    for (const rows of team.rows.values()) {
      for (const row of rows) {
        if (!isPlausibleRep(row)) continue;
        reps += 1;
        const truth = dataset.truth.get(row.log.id)!;
        const material = truth.error != null && Math.abs(truth.loggedS / truth.swumS - 1) > 0.02;
        const flagged = suspects.get(row.log.id);
        const type = byType.get(truth.error ?? "") ?? empty();
        if (truth.error && !material) count.immaterial += 1;
        if (material) {
          type.total += 1;
          if (flagged) {
            count.tp += 1;
            type.tp += 1;
            if (flagged.suggestedS != null && Math.abs(flagged.suggestedS / truth.swumS - 1) < 0.01) {
              count.corrected += 1;
              type.corrected += 1;
            }
          } else {
            count.fn += 1;
            type.fn += 1;
          }
        } else if (flagged && !truth.error) count.fp += 1;
        byType.set(truth.error ?? "", type);
      }
    }
  }
  const precision = count.tp / Math.max(1, count.tp + count.fp);
  const recall = count.tp / Math.max(1, count.tp + count.fn);
  lines.push(
    `| ${scenario} | ${reps} | ${count.tp + count.fn} | ${count.tp + count.fp} | ${(precision * 100).toFixed(0)}% | ${(recall * 100).toFixed(0)}% | ${((count.fp / Math.max(1, reps)) * 1000).toFixed(2)} | ${((count.corrected / Math.max(1, count.tp)) * 100).toFixed(0)}% |`,
  );
  for (const key of Object.keys(totals) as (keyof Count)[]) totals[key] += count[key];
}
lines.push("", "Por tipo de erro (todas as células):", "", "| Erro | Materiais | Recall | Sugestão certa |", "|---|---|---|---|");
for (const [type, count] of byType) {
  if (!type) continue;
  lines.push(`| ${type} | ${count.total} | ${((count.tp / Math.max(1, count.total)) * 100).toFixed(0)}% | ${((count.corrected / Math.max(1, count.tp)) * 100).toFixed(0)}% |`);
}
const md = lines.join("\n");
console.log(md);
const save = flag("save");
if (save) {
  let dir = process.cwd();
  while (!existsSync(join(dir, "apps")) || !existsSync(join(dir, "docs"))) dir = dirname(dir);
  mkdirSync(join(dir, "docs", "ml", "results"), { recursive: true });
  writeFileSync(join(dir, "docs", "ml", "results", `${save}.md`), `# Deteção de tempos suspeitos (${flag("seeds") === "test" ? "sementes de teste" : "sementes de ajuste"})\n\n${md}\n`);
}

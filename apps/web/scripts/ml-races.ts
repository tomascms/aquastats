/*
 * E13 — race times on the synthetic races (the generator's truth is known). For each lead (days
 * before the race), the model's forecast vs the pre-registered reference (best earlier time in the
 * same event + the development expected for the age; "last time" reported too), the oracle (the
 * race's expected time without that day's noise), and the coverage of the 80 % interval.
 * Paired by seed, pooled over the decision scenarios, 95 % bootstrap CI.
 *
 *   npx tsx scripts/ml-races.ts --seeds dev [--save final-E13]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bootstrapMean, teamData, type Dataset } from "../src/lib/ml/backtest";
import { predictRaces, referenceRaceTime } from "../src/lib/ml/races";
import { ACCEPTED } from "../src/lib/ml/registry";
import { DEFAULT_OPTIONS } from "../src/lib/ml/state-model";
import { BASE_SCENARIOS, generateDataset, GENERATOR_VERSION, type SyntheticDataset } from "../src/lib/ml/synthetic";

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : null);
const seeds = flag("seeds") === "dev" ? Array.from({ length: 15 }, (_, i) => 3001 + i) : flag("seeds") === "confirm" ? Array.from({ length: 15 }, (_, i) => 4001 + i) : [1, 2, 3, 4, 5];
const options = { ...DEFAULT_OPTIONS, ...ACCEPTED };
const LEADS = [1, 28];

type Row = { model: number; best: number | null; last: number | null; oracle: number; covered: boolean };
const fmt = (value: number, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : "—");
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN);

const lines = [`# Tempos de prova (E13) — gerador ${GENERATOR_VERSION}, sementes ${seeds[0]}–${seeds[seeds.length - 1]}`, ""];
const verdicts: Record<number, { delta: ReturnType<typeof bootstrapMean>; coverage: number; n: number }> = {};
for (const lead of LEADS) {
  const perSeed: number[] = [];
  const all: Row[] = [];
  const byScenario = new Map<string, Row[]>();
  for (const seed of seeds) {
    const deltas: number[] = [];
    for (const scenario of BASE_SCENARIOS) {
      const dataset = generateDataset(scenario, seed) as SyntheticDataset;
      const team = teamData(dataset as unknown as Dataset);
      const rows: Row[] = predictRaces(team, options, lead).map((p) => ({
        model: Math.abs(p.meanS / p.race.timeS - 1) * 100,
        best: ((ref) => (ref == null ? null : Math.abs(ref / p.race.timeS - 1) * 100))(referenceRaceTime(team, p.race, lead, "best")),
        last: ((ref) => (ref == null ? null : Math.abs(ref / p.race.timeS - 1) * 100))(referenceRaceTime(team, p.race, lead, "last")),
        oracle: Math.abs((p.race.expectedS ?? p.race.timeS) / p.race.timeS - 1) * 100,
        covered: p.race.timeS >= p.lo && p.race.timeS <= p.hi,
      }));
      all.push(...rows);
      byScenario.set(scenario, [...(byScenario.get(scenario) ?? []), ...rows]);
      const paired = rows.filter((row) => row.best != null);
      if (paired.length) deltas.push(mean(paired.map((row) => row.model)) - mean(paired.map((row) => row.best!)));
    }
    if (deltas.length) perSeed.push(mean(deltas));
  }
  const delta = bootstrapMean(perSeed);
  const coverage = all.filter((row) => row.covered).length / Math.max(1, all.length);
  verdicts[lead] = { delta, coverage, n: all.length };
  lines.push(`## ${lead === 1 ? "Na véspera" : `${lead} dias antes`}`, "", "| Cenário | Provas | MAPE modelo | MAPE oráculo | Provas com referência | MAPE modelo (essas) | MAPE melhor anterior + desenv. | MAPE última + desenv. | Cobertura 80 % |", "|---|---|---|---|---|---|---|---|---|");
  for (const [scenario, rows] of byScenario) {
    const paired = rows.filter((row) => row.best != null);
    lines.push(
      `| ${scenario} | ${rows.length} | ${fmt(mean(rows.map((row) => row.model)))}% | ${fmt(mean(rows.map((row) => row.oracle)))}% | ${paired.length} | ${fmt(mean(paired.map((row) => row.model)))}% | ${fmt(mean(paired.map((row) => row.best!)))}% | ${fmt(mean(paired.map((row) => row.last!)))}% | ${fmt((rows.filter((row) => row.covered).length / Math.max(1, rows.length)) * 100, 0)} % |`,
    );
  }
  lines.push(
    "",
    `ΔMAPE modelo − melhor anterior (média dos cenários por semente, IC 95 % bootstrap das sementes): ${fmt(delta.mean, 3)} [${fmt(delta.lo, 3)}; ${fmt(delta.hi, 3)}] pp. Cobertura do intervalo a 80 %: ${fmt(coverage * 100, 1)} % (${all.length} provas).`,
    "",
  );
}
const primary = verdicts[1];
const keep = primary.delta.hi < 0 && Math.abs(primary.coverage - 0.8) <= 0.05;
lines.push(`**Critério pré-registado (na véspera): ΔMAPE com IC < 0 e cobertura 80 % ± 5 pp → ${keep ? "CUMPRE" : "NÃO CUMPRE"}.**`, "");
console.log(lines.join("\n"));
const save = flag("save");
if (save) {
  const dir = join(resolve(__dirname, "..", "..", ".."), "docs", "ml", "results");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${save}.md`), lines.join("\n"));
  writeFileSync(join(dir, `${save}.json`), JSON.stringify({ generator: GENERATOR_VERSION, seeds, verdicts, keep }));
}

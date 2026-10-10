/*
 * Performance budget of the frozen model (v1.0): time and memory of one full pass over a team's
 * history (what the app does when it opens), from a small team to a large club, and per rep.
 * Run: npx tsx scripts/ml-perf.ts
 */
import { dayNumber, HORIZONS, teamData, teamUpTo, type Dataset } from "../src/lib/ml/backtest";
import { clearPipelineCache, runV1Pipeline, teamFingerprint } from "../src/lib/ml/pipeline";
import { calibrated } from "../src/lib/ml/calibration";
import { predictionsFor } from "../src/lib/ml/production";
import { ACCEPTED, ACCEPTED_CALIBRATION } from "../src/lib/ml/registry";
import { stateModelPredictor } from "../src/lib/ml/predictors";
import { DEFAULT_OPTIONS } from "../src/lib/ml/state-model";
import { generateDataset, SCENARIOS, type ScenarioConfig } from "../src/lib/ml/synthetic";

const v1 = calibrated(stateModelPredictor({ ...DEFAULT_OPTIONS, ...ACCEPTED }, "v1.0"), "v1.0", ACCEPTED_CALIBRATION);
const cases: { label: string; config: ScenarioConfig | keyof typeof SCENARIOS }[] = [
  { label: "8 atletas, 40 semanas (denso)", config: "denso" },
  { label: "8 atletas, 4 épocas (multiano)", config: "multiano" },
  { label: "20 atletas, 4 épocas", config: { ...SCENARIOS.multiano, athletes: 20 } },
  { label: "30 atletas, 4 épocas", config: { ...SCENARIOS.multiano, athletes: 30 } },
];

const lines = ["| Equipa | Reps | Passe completo v1.0 (s) | Estado 2.0 em produção (s) | µs por rep (v1.0) | Memória extra (MB) | App: 1.º pedido (s) | App: mesmo dado (ms) | App: +1 dia novo (s) | Impressão digital (ms) |", "|---|---|---|---|---|---|---|---|---|---|"];
for (const { label, config } of cases) {
  const dataset = generateDataset(config as keyof typeof SCENARIOS, 1) as unknown as Dataset;
  const team = teamData(dataset);
  const reps = [...team.rows.values()].reduce((sum, rows) => sum + rows.length, 0);
  global.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  let started = performance.now();
  const out = v1.predict(team, HORIZONS.day);
  const v1Seconds = (performance.now() - started) / 1000;
  const heapAfter = process.memoryUsage().heapUsed;
  started = performance.now();
  predictionsFor("estado", team);
  const v2Seconds = (performance.now() - started) / 1000;
  // The app's incremental pipeline: first request, the same data again, then one more day entered.
  const lastDay = Math.max(...[...team.rows.values()].flat().map((row) => dayNumber(row.date)));
  clearPipelineCache();
  const first = runV1Pipeline(teamUpTo(team, lastDay - 1));
  const again = runV1Pipeline(teamUpTo(team, lastDay - 1));
  const next = runV1Pipeline(team);
  started = performance.now();
  teamFingerprint(team);
  const fingerprintMs = performance.now() - started;
  if (first.mode !== "full" || again.mode !== "cache" || next.mode !== "resume") throw new Error(`unexpected modes ${first.mode} ${again.mode} ${next.mode}`);
  lines.push(`| ${label} | ${reps} | ${v1Seconds.toFixed(2)} | ${v2Seconds.toFixed(2)} | ${((v1Seconds * 1e6) / reps).toFixed(0)} | ${((heapAfter - heapBefore) / 1e6).toFixed(0)} | ${(first.ms / 1000).toFixed(2)} | ${again.ms.toFixed(0)} | ${(next.ms / 1000).toFixed(2)} | ${fingerprintMs.toFixed(0)} |`);
  if (out.size === 0) throw new Error("no predictions");
}
console.log(lines.join("\n"));

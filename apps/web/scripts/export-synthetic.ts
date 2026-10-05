/*
 * Exports a SYNTHETIC team (never real data) for local/staging demos, screenshots and load tests.
 * The API side loads it with apps/api/scripts/seed_synthetic.py.
 *
 *   npx tsx scripts/export-synthetic.ts --athletes 30 --seasons 4 --seed 9001 --out ../../.local/synthetic.json
 *
 * Seeds 9001+ are for demos only: they never decide anything about the model (docs/ml/protocolo.md).
 * Ids become deterministic UUIDs, so the same seed always gives the same rows.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateDataset, SCENARIOS } from "../src/lib/ml/synthetic";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
};
const athletes = Number(flag("athletes", "30"));
const seasons = Number(flag("seasons", "4"));
const seed = Number(flag("seed", "9001"));
const out = resolve(flag("out", "../../.local/synthetic.json"));
if (seed < 9001) throw new Error("Demo seeds start at 9001 (lower seeds belong to the model's protocol).");

/** UUID v5-style id from a synthetic id: stable across runs, never collides with real (v4) ids. */
function uuidOf(value: string): string {
  const hex = createHash("sha1").update(`aquastats-synthetic:${value}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const lastSeason = new Date().getUTCMonth() >= 8 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
const data = generateDataset({ ...SCENARIOS.multiano, athletes, seasons, firstSeason: lastSeason - seasons + 1 }, seed);
const id = (value: string) => uuidOf(`${seed}:${value}`);

const payload = {
  generator: "apps/web/scripts/export-synthetic.ts",
  synthetic: true,
  seed,
  scenario: data.label,
  athletes: data.athletes.map((a) => ({
    id: id(a.id),
    name: a.name,
    groupName: a.group,
    gender: a.gender,
    dateOfBirth: a.dateOfBirth,
    primaryStroke: a.primaryStroke,
    wellness: a.wellness,
  })),
  workouts: data.workouts.map((w) => ({ ...w, id: id(w.id), athleteIds: w.athleteIds.map(id) })),
  timeLogs: data.timeLogs.map((t) => ({ ...t, id: id(t.id), workoutId: id(t.workoutId), athleteId: id(t.athleteId) })),
  races: data.races.map((r) => ({ ...r, athleteId: id(r.athleteId) })),
  meets: data.meets,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload));
console.log(
  `synthetic team (seed ${seed}): ${payload.athletes.length} athletes, ${payload.workouts.length} workouts, ` +
    `${payload.timeLogs.length} times, ${payload.races.length} races, ${payload.meets.length} meets -> ${out}`,
);

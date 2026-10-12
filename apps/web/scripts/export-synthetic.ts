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
import { generateDataset, SCENARIOS, seasonPlansOf } from "../src/lib/ml/synthetic";
import type { WellnessEntry } from "../src/lib/types";

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
const config = { ...SCENARIOS.multiano, athletes, seasons, firstSeason: lastSeason - seasons + 1 };
// The demo logs wellness (sleep, gym, recovery) too; the model's protocol cells keep their own variant.
const data = generateDataset(config, seed, { data: "completos", meters: "base", context: "bem-estar" });
const id = (value: string) => uuidOf(`${seed}:${value}`);
// The generator simulates whole seasons; a real team has no times or results after today.
const today = new Date().toISOString().slice(0, 10);
const workouts = data.workouts.filter((w) => w.date <= today);
const kept = new Set(workouts.map((w) => w.id));

/*
 * Session RPE (CR-10) for the demo, derived from each day's training — not part of the frozen generator: the
 * metre-weighted effort of the intensities plus volume, with deterministic noise, logged on ~75 % of training days.
 */
const EFFORT: Record<string, number> = { SUAVE: 1, A1: 2, A2: 4, PROG: 5, A3: 6, PA: 8, P50: 8, P100: 8, P200: 8, P400: 8, MAX: 9 };
const unit = (key: string) => parseInt(createHash("sha1").update(`${seed}:${key}`).digest("hex").slice(0, 8), 16) / 0xffffffff;
const dayEffort = new Map<string, { meters: number; effort: number }>();
for (const w of workouts)
  for (const athleteId of w.athleteIds) {
    const entry = dayEffort.get(`${athleteId}|${w.date}`) ?? { meters: 0, effort: 0 };
    for (const b of w.blocks)
      for (const seg of b.segments) {
        const m = seg.reps * seg.distanceM * Math.max(1, b.rounds);
        entry.meters += m;
        entry.effort += m * (EFFORT[seg.intensity] ?? 3);
      }
    dayEffort.set(`${athleteId}|${w.date}`, entry);
  }
function withRpe(athleteId: string, wellness: WellnessEntry[]): WellnessEntry[] {
  const byDay = new Map(wellness.filter((w) => w.date <= today).map((w) => [w.date, { ...w }]));
  for (const [key, { meters, effort }] of dayEffort) {
    const [id, date] = key.split("|");
    if (id !== athleteId || date > today || unit(`log:${key}`) > 0.75) continue;
    const rpe = Math.round(Math.min(10, Math.max(1, effort / meters + meters / 4000 - 0.5 + (unit(`rpe:${key}`) - 0.5) * 2)));
    byDay.set(date, { ...(byDay.get(date) ?? { date, sleepHours: null, gym: null }), rpe });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const groupOf = new Map(data.athletes.map((a) => [a.id, a.group]));

const payload = {
  generator: "apps/web/scripts/export-synthetic.ts",
  synthetic: true,
  seed,
  scenario: data.label,
  athletes: data.athletes.map((a) => ({
    id: id(a.id),
    name: a.name,
    // The product groups by specialty (velocidade/intermedio/fundo); the generator's level groups are lanes in a session.
    groupName: a.group,
    gender: a.gender,
    dateOfBirth: a.dateOfBirth,
    primaryStroke: a.primaryStroke,
    wellness: withRpe(a.id, a.wellness),
  })),
  workouts: workouts.map((w) => ({ ...w, id: id(w.id), athleteIds: w.athleteIds.map(id), groups: [...new Set(w.athleteIds.map((x) => groupOf.get(x)!))].sort() })),
  timeLogs: data.timeLogs.filter((t) => kept.has(t.workoutId)).map((t) => ({ ...t, id: id(t.id), workoutId: id(t.workoutId), athleteId: id(t.athleteId) })),
  races: data.races.filter((r) => r.date <= today).map((r) => ({ ...r, athleteId: id(r.athleteId) })),
  attendance: data.attendance
    .filter((a) => kept.has(a.workoutId))
    .map((a) => ({
      id: id(`att:${a.workoutId}`),
      workoutId: id(a.workoutId),
      date: a.date,
      groupName: a.groupName,
      marks: [...a.present.map((x) => ({ athleteId: id(x), status: "present" })), ...a.absent.map((x) => ({ athleteId: id(x), status: "absent" }))],
    })),
  meets: data.meets,
  seasonPlans: seasonPlansOf(config).map((plan, index) => ({
    id: id(`plan:${index}`),
    name: `Época ${plan.start.slice(0, 4)}/${plan.end.slice(2, 4)} (sintética)`,
    start: plan.start,
    end: plan.end,
    macros: plan.macros.map((m, i) => ({ id: id(`plan:${index}:macro:${i}`), ...m })),
    competitions: plan.meetsA.map((date, i) => ({ id: id(`plan:${index}:meet:${i}`), name: `Prova A ${i + 1}`, type: "A", date })),
  })),
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload));
console.log(
  `synthetic team (seed ${seed}): ${payload.athletes.length} athletes, ${payload.workouts.length} workouts, ` +
    `${payload.timeLogs.length} times, ${payload.races.length} races, ${payload.attendance.length} roll calls, ${payload.meets.length} meets -> ${out}`,
);

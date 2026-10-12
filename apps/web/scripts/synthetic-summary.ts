/**
 * Realism table of the demo team (docs/natacao/gerador.md): level, best times, CSS and weekly volume per athlete.
 * Usage: npx tsx scripts/synthetic-summary.ts [--seed 9001] [--athletes 30] [--seasons 4]
 */
import { dayOf, generateDataset, maxTime, SCENARIOS, structuralTime } from "../src/lib/ml/synthetic";

const flag = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const seed = Number(flag("seed", "9001"));
const athletes = Number(flag("athletes", "30"));
const seasons = Number(flag("seasons", "4"));
const lastSeason = new Date().getUTCMonth() >= 8 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
const data = generateDataset({ ...SCENARIOS.multiano, athletes, seasons, firstSeason: lastSeason - seasons + 1 }, seed);
const today = new Date().toISOString().slice(0, 10);
const day = Math.min(dayOf(today), dayOf(data.dataEnd));
const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}` : s.toFixed(2));
const STROKE = { free: "L", back: "C", breast: "B", fly: "M", im: "E" } as const;

// Weekly volume mid-season (8 weeks to 15 March of the last full season), away from the August break and the ramp.
const midSeason = dayOf(`${lastSeason}-03-15`);
const meters = new Map<string, number>();
for (const w of data.workouts) {
  if (dayOf(w.date) > midSeason || dayOf(w.date) <= midSeason - 56) continue;
  const m = w.blocks.reduce((sum, b) => sum + b.rounds * b.segments.reduce((s, x) => s + x.reps * x.distanceM, 0), 0);
  for (const id of w.athleteIds) meters.set(id, (meters.get(id) ?? 0) + m);
}
console.log("| Atleta | Nível | Sexo | Idade | Estilo | 50 L | 100 L | 200 L | 400 L | 100 estilo | CSS (s/100 m) | km/sem (meio da época) |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const a of data.athletes) {
  const p = a.profile;
  const dive = (m: number, stroke: keyof typeof STROKE = "free") =>
    structuralTime(p, { distanceM: m, intensity: "MAX", fromBlock: true, gear: [], stroke }, "lcm", day).timeS;
  const css = (maxTime(p, 400, day) - maxTime(p, 200, day)) / 2;
  const age = ((day - dayOf(p.dateOfBirth)) / 365.25).toFixed(0);
  console.log(
    `| ${a.name} | ${p.level} | ${p.sex} | ${age} | ${STROKE[p.primaryStroke]} | ${fmt(dive(50))} | ${fmt(dive(100))} | ${fmt(dive(200))} | ${fmt(dive(400))} | ${fmt(dive(100, p.primaryStroke === "im" ? "free" : p.primaryStroke))} | ${css.toFixed(1)} | ${((meters.get(a.id) ?? 0) / 8000).toFixed(1)} |`,
  );
}

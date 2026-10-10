/*
 * Parameter recovery of the individual fatigue model (protocol v3, metric "recuperação de parâmetros").
 *
 * Synthetic only: for every athlete and every weekly snapshot of the generator's truth (W′ and τ move
 * with training, σ is fixed), compares the profile's posterior mean with the true value, and with what
 * the physiology prior alone would say. Also the rank correlation across athletes at the end of the
 * data (scale-free: the model's critical speed is not the generator's, so absolute W′ can be biased
 * while the ordering of athletes is right). Run: npx tsx scripts/ml-fatigue-recovery.ts [--seeds test]
 */
import { HORIZONS, dayNumber, teamData, type Dataset } from "../src/lib/ml/backtest";
import { FatigueProfile } from "../src/lib/ml/fatigue";
import { runStateModel } from "../src/lib/ml/forecaster";
import { DEFAULT_OPTIONS } from "../src/lib/ml/state-model";
import { BASE_SCENARIOS, generateDataset, type SyntheticDataset } from "../src/lib/ml/synthetic";

const args = process.argv.slice(2);
const seeds = args.includes("--seeds") && args[args.indexOf("--seeds") + 1] === "test" ? Array.from({ length: 15 }, (_, i) => 1001 + i) : [1, 2, 3, 4, 5];
const prior = new FatigueProfile().summary();

type Point = { sets: number; w: number; tau: number; vol: number; trueW: number; trueTau: number; trueVol: number; type: string };
const bucket = (sets: number) => (sets < 10 ? "0–9" : sets < 30 ? "10–29" : sets < 100 ? "30–99" : "100+");

function spearman(a: number[], b: number[]): number {
  const rank = (values: number[]) => {
    const order = values.map((value, index) => [value, index] as const).sort((x, y) => x[0] - y[0]);
    const out = new Array(values.length).fill(0);
    order.forEach(([, index], position) => (out[index] = position));
    return out;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const mean = (n - 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (ra[i] - mean) * (rb[i] - mean);
    da += (ra[i] - mean) ** 2;
    db += (rb[i] - mean) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : Number.NaN;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : Number.NaN;
};
const fmt = (value: number, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : "—");

const lines: string[] = [];
for (const scenario of BASE_SCENARIOS) {
  const points: Point[] = [];
  const endRanks: { w: number; tau: number; vol: number }[] = [];
  for (const seed of seeds) {
    const dataset = generateDataset(scenario, seed) as SyntheticDataset;
    const team = teamData(dataset as unknown as Dataset);
    const truthByDay = new Map<string, Map<number, { dPrimeM: number; tauS: number }>>();
    for (const athlete of dataset.athletes) truthByDay.set(athlete.id, new Map(athlete.trajectory.map((point) => [dayNumber(point.date), point])));
    // Snapshots: on each weekly truth date, the latest posterior of the athlete (learned up to that day).
    const history = new Map<string, { day: number; summary: ReturnType<FatigueProfile["summary"]>; sets: number }[]>();
    runStateModel(team, HORIZONS.day, { ...DEFAULT_OPTIONS, fatigueGrid: true }, new Set(), {
      onFatigue: (athleteId, day, profile) => history.set(athleteId, [...(history.get(athleteId) ?? []), { day, summary: profile.summary(), sets: profile.sets }]),
    });
    for (const athlete of dataset.athletes) {
      const list = history.get(athlete.id) ?? [];
      if (!list.length) continue;
      const truth = truthByDay.get(athlete.id)!;
      let cursor = 0;
      for (const [day, point] of [...truth.entries()].sort((a, b) => a[0] - b[0])) {
        while (cursor + 1 < list.length && list[cursor + 1].day <= day) cursor += 1;
        if (list[cursor].day > day) continue;
        const estimate = list[cursor];
        points.push({
          sets: estimate.sets,
          w: estimate.summary.wPrime,
          tau: estimate.summary.tau,
          vol: estimate.summary.volSens,
          trueW: point.dPrimeM,
          trueTau: point.tauS,
          trueVol: athlete.profile.volumeSens,
          type: dataset.athleteTypes.get(athlete.id) ?? "típico",
        });
      }
    }
    const latest = new Map([...history].map(([athleteId, list]) => [athleteId, { profile: list[list.length - 1].summary, sets: list[list.length - 1].sets }]));
    const end = dataset.athletes.filter((athlete) => latest.has(athlete.id) && latest.get(athlete.id)!.sets >= 10);
    if (end.length >= 4) {
      const lastTruth = (athlete: (typeof end)[number]) => athlete.trajectory[athlete.trajectory.length - 1];
      endRanks.push({
        w: spearman(end.map((athlete) => latest.get(athlete.id)!.profile.wPrime), end.map((athlete) => lastTruth(athlete)?.dPrimeM ?? athlete.profile.dPrimeM)),
        tau: spearman(end.map((athlete) => latest.get(athlete.id)!.profile.tau), end.map((athlete) => lastTruth(athlete)?.tauS ?? athlete.profile.dPrimeTauS)),
        vol: spearman(end.map((athlete) => latest.get(athlete.id)!.profile.volSens), end.map((athlete) => athlete.profile.volumeSens)),
      });
    }
  }
  lines.push(`### ${scenario}`, "", "| Sets vistos | Pontos | W′: erro log mediano (modelo / só prior) | τ: erro log mediano (modelo / só prior) | σ: erro abs. mediano (modelo / só prior) |", "|---|---|---|---|---|");
  for (const key of ["0–9", "10–29", "30–99", "100+"]) {
    const list = points.filter((point) => bucket(point.sets) === key);
    if (!list.length) continue;
    const w = median(list.map((point) => Math.abs(Math.log(point.w / point.trueW))));
    const wPrior = median(list.map((point) => Math.abs(Math.log(prior.wPrime / point.trueW))));
    const tau = median(list.map((point) => Math.abs(Math.log(point.tau / point.trueTau))));
    const tauPrior = median(list.map((point) => Math.abs(Math.log(prior.tau / point.trueTau))));
    const vol = median(list.map((point) => Math.abs(point.vol - point.trueVol)));
    const volPrior = median(list.map((point) => Math.abs(prior.volSens - point.trueVol)));
    lines.push(`| ${key} | ${list.length} | ${fmt(w)} / ${fmt(wPrior)} | ${fmt(tau)} / ${fmt(tauPrior)} | ${fmt(vol, 3)} / ${fmt(volPrior, 3)} |`);
  }
  const rho = (field: "w" | "tau" | "vol") => {
    const values = endRanks.map((rank) => rank[field]).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN;
  };
  lines.push("", `Correlação de ordem (Spearman) entre atletas no fim dos dados, média de ${endRanks.length} réplicas: W′ ${fmt(rho("w"))} · τ ${fmt(rho("tau"))} · σ ${fmt(rho("vol"))}`, "");
}
console.log(`Recuperação de parâmetros da fadiga individual — sementes ${seeds[0]}–${seeds[seeds.length - 1]}\n`);
console.log(lines.join("\n"));

/*
 * Chronological backtest following docs/ml/protocolo.md.
 *
 *   npx tsx scripts/ml-backtest.ts --cells decision --save baseline-v2
 *   npx tsx scripts/ml-backtest.ts --cells all --predictors "último valor,mediana,modelo atual" --save baseline-v2
 *   npx tsx scripts/ml-backtest.ts --compare "modelo atual" "candidato" --seeds tune
 *   npx tsx scripts/ml-backtest.ts --real export.json       # real data, reported on its own, read-only
 *
 * Synthetic and real results are never pooled.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  bootstrapMean,
  checkCausality,
  dayNumber,
  evaluationRows,
  HORIZONS,
  metricsOf,
  oracleFloor,
  pairedSample,
  runBacktest,
  teamData,
  type BacktestReport,
  type BreakMetrics,
  type CapacityMetrics,
  type Dataset,
  type Horizon,
  type Metrics,
  type Pair,
  type PairedSample,
  type Predictor,
  type Scored,
} from "../src/lib/ml/backtest";
import { PREDICTORS } from "../src/lib/ml/registry";
import { createRng } from "../src/lib/ml/rng";
import { BASE_SCENARIOS, CONTEXT_LEVELS, DATA_LEVELS, DEFAULT_VARIANT, GENERATOR_VERSION, generateDataset, METERS_LEVELS, SCENARIOS, type ScenarioName, type SyntheticDataset, type Variant } from "../src/lib/ml/synthetic";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? "") : null;
};
const has = (name: string) => args.includes(`--${name}`);

type HorizonKey = keyof typeof HORIZONS;
type Cell = { key: string; scenario: ScenarioName; variant: Variant; seeds: number[]; horizons: HorizonKey[]; kind: "decision" | "regime" | "matrix" };

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const variantKey = (variant: Variant) => `${variant.data}/${variant.meters}/${variant.context}`;

type SeedSet = "tune" | "test" | "dev" | "confirm" | "fatigue" | "g4tune" | "g4dev" | "g4confirm";
/** Seeds per set and kind of cell (protocol §5 and the final-phase addendum: dev decides, confirm is used once). */
const SEED_BASE: Record<Exclude<SeedSet, "tune">, number> = { test: 1001, dev: 3001, confirm: 4001, fatigue: 2001, g4tune: 6001, g4dev: 6101, g4confirm: 6201 };
function seedsFor(seedSet: SeedSet, kind: Cell["kind"]): number[] {
  if (seedSet === "tune") return kind === "decision" ? range(1, 5) : kind === "regime" ? range(1, 3) : range(1, 2);
  const base = SEED_BASE[seedSet];
  if (seedSet === "g4tune") return range(base, base + 4);
  return range(base, base + (kind === "decision" ? 14 : kind === "regime" ? 9 : 4));
}

function protocolCells(seedSet: SeedSet, which: string): Cell[] {
  const cells: Cell[] = [];
  const kinds = which === "all" ? ["decision", "regime", "matrix"] : which.split(",");
  if (kinds.includes("decision")) {
    for (const scenario of BASE_SCENARIOS) {
      cells.push({ key: `${scenario} · ${variantKey(DEFAULT_VARIANT)}`, scenario, variant: DEFAULT_VARIANT, seeds: seedsFor(seedSet, "decision"), horizons: ["rep", "day", "semana", "mes"], kind: "decision" });
    }
  }
  if (kinds.includes("regime")) {
    for (const scenario of ["multiano", "regresso-curta", "regresso-longa", "regresso-tardia"] as ScenarioName[]) {
      cells.push({
        key: `${scenario} · ${variantKey(DEFAULT_VARIANT)}`,
        scenario,
        variant: DEFAULT_VARIANT,
        seeds: seedsFor(seedSet, "regime"),
        horizons: scenario === "multiano" ? ["day", "semana", "mes", "ano"] : ["day", "semana", "mes"],
        kind: "regime",
      });
    }
  }
  if (kinds.includes("matrix")) {
    for (const scenario of BASE_SCENARIOS) {
      for (const data of DATA_LEVELS) {
        for (const meters of METERS_LEVELS) {
          for (const context of CONTEXT_LEVELS) {
            const variant = { data, meters, context };
            if (variantKey(variant) === variantKey(DEFAULT_VARIANT)) continue;
            cells.push({ key: `${scenario} · ${variantKey(variant)}`, scenario, variant, seeds: seedsFor(seedSet, "matrix"), horizons: ["day"], kind: "matrix" });
          }
        }
      }
    }
  }
  return cells;
}

/* ---------- Aggregation ---------- */

const KEYS: (keyof Metrics)[] = ["n", "predictedShare", "maeS", "mapePct", "medianApePct", "biasPct", "nominal", "coverage", "coverage80", "widthPct", "intervalScorePct", "crpsPct"];
type Agg = Record<string, { mean: number | null; sd: number | null }>;

function aggregate(list: (Metrics | undefined)[]): Agg {
  const out: Agg = {};
  for (const key of KEYS) {
    const values = list.map((item) => item?.[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!values.length) {
      out[key] = { mean: null, sd: null };
      continue;
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sd = values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : 0;
    out[key] = { mean, sd };
  }
  return out;
}

const RETURN_BUCKETS = ["regresso sem 0–1", "regresso sem 2–3", "regresso sem 4–5", "regresso sem 6–11"] as const;
function returnBucket(dataset: SyntheticDataset, athleteId: string, date: string): string | null {
  const day = dayNumber(date);
  let best: number | null = null;
  for (const season of dataset.returns.slice(1)) {
    const back = dayNumber(season.athletes[athleteId] ?? season.team);
    if (day >= back && (best == null || back > best)) best = back;
  }
  if (best == null) return null;
  const weeks = (day - best) / 7;
  if (weeks < 2) return RETURN_BUCKETS[0];
  if (weeks < 4) return RETURN_BUCKETS[1];
  if (weeks < 6) return RETURN_BUCKETS[2];
  if (weeks < 12) return RETURN_BUCKETS[3];
  return null;
}

/** Mean ± SD across seeds of every numeric field of a metrics object. */
function aggregateFields<T extends object>(list: (T | null | undefined)[]): Record<string, { mean: number | null; sd: number | null }> | null {
  const present = list.filter((item): item is T => item != null);
  if (!present.length) return null;
  const out: Record<string, { mean: number | null; sd: number | null }> = {};
  for (const key of Object.keys(present[0])) {
    const values = present.map((item) => (item as Record<string, unknown>)[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!values.length) {
      out[key] = { mean: null, sd: null };
      continue;
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sd = values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : 0;
    out[key] = { mean, sd };
  }
  return out;
}

type HorizonResult = {
  overall: Agg;
  overallAll: Agg;
  byType: Record<string, Agg>;
  capacity: ReturnType<typeof aggregateFields<CapacityMetrics>>;
  breaks: ReturnType<typeof aggregateFields<BreakMetrics>>;
  byHistory: Record<string, Agg>;
  byWeeks: Record<string, Agg>;
  byConfidence: Record<string, Agg>;
  byReturn: Record<string, Agg>;
  runtimeMs: number;
  perSeed: Metrics[];
  breaksPerSeed: (BreakMetrics | null)[];
};

type CellResult = {
  key: string;
  kind: Cell["kind"];
  label: string;
  seeds: number[];
  reps: number;
  athletes: number;
  oracle: { dayAhead: Agg; withinDay: Agg };
  predictors: Record<string, Record<string, HorizonResult>>;
  causality: Record<string, Record<string, number>>;
};

function collect(reports: BacktestReport[], field: "byHistory" | "byWeeks" | "byConfidence" | "byType"): Record<string, Agg> {
  const keys = [...new Set(reports.flatMap((report) => Object.keys(report[field])))];
  return Object.fromEntries(keys.map((key) => [key, aggregate(reports.map((report) => report[field][key]))]));
}

type Prepared = { dataset: SyntheticDataset; team: ReturnType<typeof teamData>; evalRows: ReturnType<typeof evaluationRows> };

function prepare(cell: Cell): Prepared[] {
  return cell.seeds.map((seed) => {
    const dataset = generateDataset(cell.scenario, seed, cell.variant);
    const team = teamData(dataset as unknown as Dataset);
    // The athlete types travel with the dataset so the report can split typical vs atypical.
    return { dataset, team, evalRows: evaluationRows(team, dataset as unknown as Dataset) };
  });
}

type AthleteFacts = { gender?: string; dateOfBirth?: string; primaryStroke?: string };

function runCell(cell: Cell, predictors: Predictor[], checkLeaks: boolean): { result: CellResult; scored: Map<string, Map<string, Scored[][]>>; types: Map<string, string>[]; facts: Map<string, AthleteFacts>[] } {
  const prepared = prepare(cell);
  const types = prepared.map((item) => item.dataset.athleteTypes as Map<string, string>);
  const facts = prepared.map((item) => new Map(item.dataset.athletes.map((athlete) => [athlete.id, { gender: athlete.gender, dateOfBirth: athlete.dateOfBirth, primaryStroke: athlete.primaryStroke } as AthleteFacts])));
  const scored = new Map<string, Map<string, Scored[][]>>();
  const result: CellResult = {
    key: cell.key,
    kind: cell.kind,
    label: SCENARIOS[cell.scenario].label,
    seeds: cell.seeds,
    reps: Math.round(prepared.reduce((sum, item) => sum + item.evalRows.length, 0) / prepared.length),
    athletes: prepared[0].dataset.athletes.length,
    oracle: (() => {
      const floors = prepared.map((item) => oracleFloor(item.dataset as unknown as Dataset, item.team, item.evalRows)!);
      return { dayAhead: aggregate(floors.map((floor) => floor.dayAhead)), withinDay: aggregate(floors.map((floor) => floor.withinDay)) };
    })(),
    predictors: {},
    causality: {},
  };
  for (const predictor of predictors) {
    result.predictors[predictor.name] = {};
    result.causality[predictor.name] = {};
    const byHorizon = new Map<string, Scored[][]>();
    for (const key of cell.horizons) {
      const horizon: Horizon = HORIZONS[key];
      const runs = prepared.map((item) => runBacktest(predictor, item.dataset as unknown as Dataset, horizon, item.team, item.evalRows));
      const reports = runs.map((run) => run.report);
      byHorizon.set(key, runs.map((run) => run.scored));
      const byReturn: Record<string, Agg> = {};
      if (cell.scenario.startsWith("regresso") || cell.scenario === "multiano") {
        const perSeed = runs.map((run, index) => {
          const groups = new Map<string, Scored[]>();
          for (const item of run.scored) {
            if (!item.item.clean) continue;
            const bucket = returnBucket(prepared[index].dataset, item.item.athleteId, item.item.row.date);
            if (bucket) groups.set(bucket, [...(groups.get(bucket) ?? []), item]);
          }
          return groups;
        });
        for (const bucket of RETURN_BUCKETS) byReturn[bucket] = aggregate(perSeed.map((groups) => (groups.has(bucket) ? metricsOf(groups.get(bucket)!.map((item) => item.pair)) : undefined)));
      }
      result.predictors[predictor.name][key] = {
        overall: aggregate(reports.map((report) => report.overall)),
        overallAll: aggregate(reports.map((report) => report.overallAll)),
        byType: collect(reports, "byType"),
        capacity: aggregateFields(reports.map((report) => report.capacity)),
        breaks: aggregateFields(reports.map((report) => report.breaks)),
        byHistory: collect(reports, "byHistory"),
        byWeeks: collect(reports, "byWeeks"),
        byConfidence: collect(reports, "byConfidence"),
        byReturn,
        runtimeMs: reports.reduce((sum, report) => sum + report.runtimeMs, 0) / reports.length,
        perSeed: reports.map((report) => report.overall),
        breaksPerSeed: reports.map((report) => report.breaks),
      };
      if (checkLeaks && cell.kind !== "matrix") result.causality[predictor.name][key] = checkCausality(predictor, prepared[0].team, horizon).length;
    }
    scored.set(predictor.name, byHorizon);
  }
  return { result, scored, types, facts };
}

/* ---------- R7: heterogeneity across athletes ---------- */

type AthleteEffect = { cell: string; seed: number; athleteId: string; type: string; reps: number; days: number; delta: number; se: number; lo90: number; hi90: number; lo95: number; hi95: number };

/** Per athlete (of each replicate): mean ΔAPE (challenger − champion, pp) over the common clean reps, CI by bootstrap of the days. */
function athleteEffects(cell: string, seeds: number[], a: Scored[][], b: Scored[][], types: Map<string, string>[]): AthleteEffect[] {
  const out: AthleteEffect[] = [];
  a.forEach((run, index) => {
    const other = new Map(b[index].map((item) => [item.item.row.log.id, item]));
    const byAthlete = new Map<string, Map<string, number[]>>();
    for (const item of run) {
      if (!item.item.clean || !item.pair.prediction) continue;
      const twin = other.get(item.item.row.log.id);
      if (!twin?.pair.prediction) continue;
      const ape = (mean: number) => (Math.abs(mean - item.pair.actual) / item.pair.actual) * 100;
      const days = byAthlete.get(item.item.athleteId) ?? new Map<string, number[]>();
      days.set(item.item.row.date, [...(days.get(item.item.row.date) ?? []), ape(twin.pair.prediction.mean) - ape(item.pair.prediction.mean)]);
      byAthlete.set(item.item.athleteId, days);
    }
    for (const [athleteId, days] of byAthlete) {
      const perDay = [...days.values()];
      const reps = perDay.reduce((sum, list) => sum + list.length, 0);
      if (perDay.length < 5) continue;
      const meanOf = (lists: number[][]) => {
        let sum = 0;
        let n = 0;
        for (const list of lists) {
          for (const value of list) {
            sum += value;
            n += 1;
          }
        }
        return sum / n;
      };
      const delta = meanOf(perDay);
      const rng = createRng(7 + index);
      const boots: number[] = [];
      for (let k = 0; k < 2000; k += 1) boots.push(meanOf(perDay.map(() => perDay[Math.floor(rng.uniform(0, perDay.length))])));
      boots.sort((x, y) => x - y);
      const q = (p: number) => boots[Math.min(boots.length - 1, Math.floor(p * boots.length))];
      const bootMean = boots.reduce((sum, value) => sum + value, 0) / boots.length;
      const se = Math.sqrt(boots.reduce((sum, value) => sum + (value - bootMean) ** 2, 0) / (boots.length - 1));
      out.push({ cell, seed: seeds[index], athleteId, type: types[index].get(athleteId) ?? "típico", reps, days: perDay.length, delta, se, lo90: q(0.05), hi90: q(0.95), lo95: q(0.025), hi95: q(0.975) });
    }
  });
  return out;
}

/** Cochran Q over the athletes' effects; p from the chi-square (Wilson–Hilferty approximation). */
function cochranQ(effects: AthleteEffect[]): { q: number; df: number; p: number } {
  const usable = effects.filter((effect) => effect.se > 0);
  const weights = usable.map((effect) => 1 / effect.se ** 2);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const pooled = usable.reduce((sum, effect, i) => sum + weights[i] * effect.delta, 0) / total;
  const q = usable.reduce((sum, effect, i) => sum + weights[i] * (effect.delta - pooled) ** 2, 0);
  const df = usable.length - 1;
  if (df < 1) return { q, df, p: Number.NaN };
  const z = (Math.cbrt(q / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return { q, df, p: 1 - normalCdf(z) };
}

function normalCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26 (erf).
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/* ---------- R9 (multiplicity) and R10 (parity) ---------- */

/** Experiments in the final phase's budget: R9 tests each one at 0.05 / BUDGET, one-sided. */
const BUDGET = 15;

/** One-sided upper bound of the mean at `level` by bootstrap of the replicates (seeds). */
function bootstrapUpper(values: number[], level: number, iterations = 20_000, seed = 4242): { mean: number; upper: number } {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { mean: NaN, upper: NaN };
  const rng = createRng(seed);
  const means: number[] = [];
  for (let k = 0; k < iterations; k += 1) {
    let sum = 0;
    for (let i = 0; i < finite.length; i += 1) sum += finite[Math.floor(rng.uniform(0, finite.length))];
    means.push(sum / finite.length);
  }
  means.sort((a, b) => a - b);
  return { mean: finite.reduce((sum, value) => sum + value, 0) / finite.length, upper: means[Math.min(means.length - 1, Math.floor(level * means.length))] };
}

/** Per seed: the mean over the deciding cells of challenger − champion (MAPE or CRPS, pp). */
function pooledDeltas(samples: PairedSample[][], metric: "mape" | "crps"): number[] {
  const seeds = Math.min(...samples.map((cell) => cell.length));
  const out: number[] = [];
  for (let i = 0; i < seeds; i += 1) {
    const deltas = samples
      .map((cell) => cell[i])
      .filter((sample) => sample && sample.n > 0)
      .map((sample) => (metric === "mape" ? sample.mapeB - sample.mapeA : sample.crpsA != null && sample.crpsB != null ? sample.crpsB - sample.crpsA : NaN))
      .filter(Number.isFinite);
    if (deltas.length) out.push(deltas.reduce((sum, value) => sum + value, 0) / deltas.length);
  }
  return out;
}

const ageBand = (dateOfBirth: string | undefined, date: string) => {
  if (!dateOfBirth) return "sem data";
  const age = (dayNumber(date) - dayNumber(dateOfBirth)) / 365.25;
  return age < 13 ? "≤ 12 anos" : age < 15 ? "13–14 anos" : age < 17 ? "15–16 anos" : "≥ 17 anos";
};

type ParityRow = { dimension: string; value: string; n: number; mapeA: number; mapeB: number; calA: number | null; calB: number | null };

/** Subgroups (sex, age band, primary stroke) pooled over the deciding cells and seeds, on the common clean reps. */
function parityRows(runs: { a: Scored[]; b: Scored[]; facts: Map<string, AthleteFacts> }[]): ParityRow[] {
  const groups = new Map<string, { dimension: string; value: string; a: Pair[]; b: Pair[] }>();
  for (const { a, b, facts } of runs) {
    const other = new Map(b.map((item) => [item.item.row.log.id, item]));
    for (const item of a) {
      if (!item.item.clean || !item.pair.prediction) continue;
      const twin = other.get(item.item.row.log.id);
      if (!twin?.pair.prediction) continue;
      const info = facts.get(item.item.athleteId) ?? {};
      const keys: [string, string][] = [
        ["Sexo", info.gender || "—"],
        ["Escalão (idade)", ageBand(info.dateOfBirth, item.item.row.date)],
        ["Estilo principal", info.primaryStroke || "—"],
      ];
      for (const [dimension, value] of keys) {
        const key = `${dimension}|${value}`;
        const group = groups.get(key) ?? { dimension, value, a: [], b: [] };
        group.a.push(item.pair);
        group.b.push(twin.pair);
        groups.set(key, group);
      }
    }
  }
  return [...groups.values()]
    .map((group) => {
      const ma = metricsOf(group.a);
      const mb = metricsOf(group.b);
      return {
        dimension: group.dimension,
        value: group.value,
        n: group.a.length,
        mapeA: ma.mapePct,
        mapeB: mb.mapePct,
        calA: ma.coverage80 == null ? null : Math.abs(ma.coverage80 - 0.8) * 100,
        calB: mb.coverage80 == null ? null : Math.abs(mb.coverage80 - 0.8) * 100,
      };
    })
    .sort((x, y) => x.dimension.localeCompare(y.dimension) || x.value.localeCompare(y.value));
}

const parityOk = (rows: ParityRow[]) => rows.filter((row) => row.n >= 200).every((row) => row.mapeB - row.mapeA <= 0.1 && (row.calA == null || row.calB == null || row.calB - row.calA <= 2));

/* ---------- Decision rule ---------- */

type Verdict = {
  cell: string;
  n: number;
  /** Mean ΔMAPE on atypical athletes' reps (R6), null when the cell has none. */
  dAtypical: { mean: number; lo: number; hi: number } | null;
  dMape: { mean: number; lo: number; hi: number };
  dCrps: { mean: number; lo: number; hi: number };
  dCal: { mean: number; lo: number; hi: number };
  mapeA: number;
  mapeB: number;
};

function verdictOf(cell: string, samples: PairedSample[], atypical: PairedSample[] = []): Verdict {
  const valid = samples.filter((sample) => sample.n > 0);
  const atypicalValid = atypical.filter((sample) => sample.n > 0);
  return {
    cell,
    n: Math.round(valid.reduce((sum, sample) => sum + sample.n, 0) / Math.max(1, valid.length)),
    dAtypical: atypicalValid.length ? bootstrapMean(atypicalValid.map((sample) => sample.mapeB - sample.mapeA)) : null,
    dMape: bootstrapMean(valid.map((sample) => sample.mapeB - sample.mapeA)),
    dCrps: bootstrapMean(valid.map((sample) => (sample.crpsA != null && sample.crpsB != null ? sample.crpsB - sample.crpsA : NaN))),
    dCal: bootstrapMean(valid.map((sample) => (sample.calA != null && sample.calB != null ? sample.calB - sample.calA : NaN))),
    mapeA: valid.reduce((sum, sample) => sum + sample.mapeA, 0) / Math.max(1, valid.length),
    mapeB: valid.reduce((sum, sample) => sum + sample.mapeB, 0) / Math.max(1, valid.length),
  };
}

function decide(verdicts: Verdict[], leaks: number, primary: "mape" | "crps" = "mape"): { keep: boolean; rules: Record<string, boolean> } {
  const r1 = verdicts.filter((v) => (primary === "mape" ? v.dMape.mean < 0 && v.dMape.hi < 0 : v.dCrps.mean < 0 && v.dCrps.hi < 0)).length >= 3;
  const r2 = verdicts.every((v) => v.dMape.mean <= 0.05);
  const r3 = verdicts.every((v) => Number.isFinite(v.dCrps.mean) && v.dCrps.mean <= 0);
  const r4 = verdicts.every((v) => Number.isFinite(v.dCal.mean) && v.dCal.mean <= 1);
  const r5 = leaks === 0;
  const atypical = verdicts.filter((v) => v.dAtypical != null);
  const r6 = !atypical.length || atypical.reduce((sum, v) => sum + v.dAtypical!.mean, 0) / atypical.length <= 0.1;
  return { keep: r1 && r2 && r3 && r4 && r5 && r6, rules: { R1: r1, R2: r2, R3: r3, R4: r4, R5: r5, R6: r6 } };
}

/* ---------- Markdown ---------- */

const fmt = (value: number | null | undefined, digits = 2) => (value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits));
const pct = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(0)}%`);
const HORIZON_LABEL: Record<string, string> = { rep: "próxima rep", day: "dia", semana: "semana", mes: "mês", ano: "ano" };

function cellMarkdown(result: CellResult, detail: boolean): string[] {
  const lines: string[] = [`### ${result.key}`, "", `${result.label}. ${result.athletes} atletas, ~${result.reps} reps avaliáveis por réplica, sementes ${result.seeds[0]}–${result.seeds[result.seeds.length - 1]}.`, ""];
  const names = Object.keys(result.predictors);
  const horizons = Object.keys(result.predictors[names[0]]);
  lines.push("| Horizonte | Preditor | Reps previstas | MAE (s) | MAPE | Viés | Cob. (nominal) | Cob. a 80 % | Largura | CRPS | MAPE c/ erros |", "|---|---|---|---|---|---|---|---|---|---|---|");
  for (const h of horizons) {
    if (h === "day") lines.push(`| dia | _oráculo (véspera)_ | — | ${fmt(result.oracle.dayAhead.maeS.mean)} | ${fmt(result.oracle.dayAhead.mapePct.mean)}% | — | — | — | — | — | — |`);
    if (h === "rep") lines.push(`| próxima rep | _oráculo (no dia)_ | — | ${fmt(result.oracle.withinDay.maeS.mean)} | ${fmt(result.oracle.withinDay.mapePct.mean)}% | — | — | — | — | — | — |`);
    for (const name of names) {
      const m = result.predictors[name][h].overall;
      lines.push(
        `| ${HORIZON_LABEL[h]} | ${name} | ${pct(m.predictedShare.mean)} | ${fmt(m.maeS.mean)} | ${fmt(m.mapePct.mean)}% ± ${fmt(m.mapePct.sd)} | ${fmt(m.biasPct.mean)}% | ${m.coverage.mean == null ? "—" : `${pct(m.coverage.mean)} (${pct(m.nominal.mean)})`} | ${pct(m.coverage80.mean)} | ${m.widthPct.mean == null ? "—" : `${fmt(m.widthPct.mean, 1)}%`} | ${m.crpsPct.mean == null ? "—" : `${fmt(m.crpsPct.mean)}%`} | ${fmt(result.predictors[name][h].overallAll.mapePct.mean)}% |`,
      );
    }
  }
  lines.push("");
  if (!detail) return lines;
  const bucketTable = (title: string, field: "byHistory" | "byWeeks" | "byReturn" | "byType", order: string[]) => {
    const present = order.filter((key) => names.some((name) => result.predictors[name].day?.[field]?.[key]));
    if (!present.length) return;
    lines.push(`${title} (horizonte dia; MAPE · reps previstas · cobertura a 80 %):`, "", `| Preditor | ${present.join(" | ")} |`, `|---|${present.map(() => "---").join("|")}|`);
    for (const name of names) {
      const cells = present.map((key) => {
        const m = result.predictors[name].day?.[field]?.[key];
        if (!m || m.mapePct.mean == null) return "—";
        return `${fmt(m.mapePct.mean)}% · ${pct(m.predictedShare.mean)}${m.coverage80.mean != null ? ` · ${pct(m.coverage80.mean)}` : ""}`;
      });
      lines.push(`| ${name} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  };
  const capRows = names.filter((name) => result.predictors[name].day?.capacity);
  if (capRows.length) {
    lines.push('"Devia fazer" (capacidade) e custo das condições, horizonte dia:', "", "| Preditor | MAPE vs verdade | Viés | Cob. 80 % vs verdade | Interval score | MAPE em reps de referência | Cob. 80 % em referência | Erro do custo (pp) |", "|---|---|---|---|---|---|---|---|");
    for (const name of capRows) {
      const c = result.predictors[name].day.capacity!;
      lines.push(`| ${name} | ${fmt(c.mapePct.mean)}% | ${fmt(c.biasPct.mean)}% | ${pct(c.coverage80.mean)} | ${c.intervalScorePct.mean == null ? "—" : `${fmt(c.intervalScorePct.mean)}%`} | ${fmt(c.mapeRefPct.mean)}% (n≈${fmt(c.nRef.mean, 0)}) | ${pct(c.coverage80Ref.mean)} | ${fmt(c.costMaePp.mean)} |`);
    }
    lines.push("");
  }
  const breakRows = names.filter((name) => result.predictors[name].day?.breaks);
  if (breakRows.length) {
    lines.push("Quebra de série (séries com ≥ 3 reps registadas, definição operacional), horizonte dia:", "", "| Preditor | Séries | Taxa de quebra | Brier | Brier referência | Log loss | Log loss referência | Erro na rep da quebra |", "|---|---|---|---|---|---|---|---|");
    for (const name of breakRows) {
      const b = result.predictors[name].day.breaks!;
      lines.push(`| ${name} | ${fmt(b.sets.mean, 0)} | ${pct(b.breakRate.mean)} | ${fmt(b.brier.mean, 4)} | ${fmt(b.brierBase.mean, 4)} | ${fmt(b.logLoss.mean, 3)} | ${fmt(b.logLossBase.mean, 3)} | ${fmt(b.repMae.mean)} |`);
    }
    lines.push("");
  }
  bucketTable("Por tipo de atleta", "byType", ["típico", "atípico"]);
  bucketTable("Por reps anteriores do mesmo grupo", "byHistory", ["0", "1", "2–3", "4–7", "8–15", "16–31", "32+"]);
  bucketTable("Erro ao longo do tempo (semanas de histórico do atleta)", "byWeeks", ["sem 0–1", "sem 2–3", "sem 4–7", "sem 8–15", "sem 16–51", "ano 2", "ano 3+"]);
  bucketTable("Depois do regresso de agosto", "byReturn", [...RETURN_BUCKETS]);
  const withConfidence = names.find((name) => Object.keys(result.predictors[name].day?.byConfidence ?? {}).length);
  if (withConfidence) {
    lines.push(`Confiança declarada (${withConfidence}) vs erro real:`, "", "| Confiança | Reps | MAPE | Cob. a 80 % |", "|---|---|---|---|");
    for (const [key, m] of Object.entries(result.predictors[withConfidence].day.byConfidence)) lines.push(`| ${key} | ${fmt(m.n.mean, 0)} | ${fmt(m.mapePct.mean)}% | ${pct(m.coverage80.mean)} |`);
    lines.push("");
  }
  const leaks = Object.entries(result.causality).map(([name, byH]) => `${name}: ${Object.values(byH).reduce((s, v) => s + v, 0)}`);
  if (leaks.length) lines.push(`Fuga temporal (previsões alteradas ao perturbar o futuro, todos os horizontes): ${leaks.join(", ")}.`, "");
  return lines;
}

function matrixMarkdown(results: CellResult[]): string[] {
  const names = Object.keys(results[0].predictors);
  const lines = ["## Matriz (horizonte dia, 5 sementes): MAPE em reps limpas · reps previstas", "", `| Célula | ${names.join(" | ")} | oráculo |`, `|---|${names.map(() => "---").join("|")}|---|`];
  for (const result of results) {
    const cells = names.map((name) => {
      const m = result.predictors[name].day.overall;
      return `${fmt(m.mapePct.mean)}% · ${pct(m.predictedShare.mean)}`;
    });
    lines.push(`| ${result.key} | ${cells.join(" | ")} | ${fmt(result.oracle.dayAhead.mapePct.mean)}% |`);
  }
  lines.push("");
  return lines;
}

/* ---------- Main ---------- */

function repoRoot(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, "apps")) || !existsSync(join(dir, "docs"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Repository root not found");
    dir = parent;
  }
  return dir;
}

/** What goes into docs/ml/results/*.json: aggregates only (per-seed numbers and matrix slices stay in the Markdown). */
function slim(results: CellResult[]): CellResult[] {
  return results.map((cell) => ({
    ...cell,
    predictors: Object.fromEntries(
      Object.entries(cell.predictors).map(([name, horizons]) => [
        name,
        Object.fromEntries(
          Object.entries(horizons).map(([key, value]) => [
            key,
            { ...value, perSeed: [], byConfidence: {}, ...(cell.kind === "matrix" ? { byHistory: {}, byWeeks: {}, byReturn: {} } : {}) },
          ]),
        ),
      ]),
    ),
  }));
}

function pickPredictors(names: string[]): Predictor[] {
  return names.map((name) => {
    const predictor = PREDICTORS.find((item) => item.name === name);
    if (!predictor) throw new Error(`Unknown predictor "${name}". Known: ${PREDICTORS.map((item) => item.name).join(", ")}`);
    return predictor;
  });
}

function main() {
  const realPath = flag("real");
  if (realPath) {
    const raw = JSON.parse(readFileSync(resolve(realPath), "utf8"));
    const dataset: Dataset = { kind: "real", label: `Dados reais (${realPath})`, athletes: raw.athletes, workouts: raw.workouts, timeLogs: raw.timeLogs };
    const team = teamData(dataset);
    const evalRows = evaluationRows(team, dataset);
    console.log(`Dados reais: ${dataset.athletes.length} atletas, ${dataset.workouts.length} treinos, ${dataset.timeLogs.length} tempos, ${evalRows.length} reps avaliáveis.`);
    for (const predictor of PREDICTORS) {
      const { report } = runBacktest(predictor, dataset, HORIZONS.day, team, evalRows);
      console.log(`${predictor.name}: n=${report.overall.n}, MAPE=${fmt(report.overall.mapePct)}%, cobertura80=${pct(report.overall.coverage80)}, fuga=${checkCausality(predictor, team).length}`);
    }
    return;
  }

  const seedSet: SeedSet = (["tune", "test", "dev", "confirm", "fatigue", "g4tune", "g4dev", "g4confirm"] as const).find((name) => name === flag("seeds")) ?? "test";
  const compare = args.indexOf("--compare");
  if (compare >= 0) {
    const [championName, challengerName] = [args[compare + 1], args[compare + 2]];
    const [champion, challenger] = pickPredictors([championName, challengerName]);
    const cells = protocolCells(seedSet, flag("cells") ?? "decision");
    // What decides (pre-registered per experiment): the horizon, the kind of cells and the primary metric.
    const decideOn = (flag("decide-on") ?? "day") as HorizonKey;
    const decideCells = (flag("decide-cells") ?? "decision") as Cell["kind"];
    const primary = flag("primary") === "crps" ? "crps" : "mape";
    const verdicts: Verdict[] = [];
    const decisionSamples: PairedSample[][] = [];
    const parityRuns: { a: Scored[]; b: Scored[]; facts: Map<string, AthleteFacts> }[] = [];
    const secondary: { cell: string; horizon: string; verdict: Verdict }[] = [];
    const results: CellResult[] = [];
    let leaks = 0;
    const prepared = new Map<string, Map<string, string>[]>();
    const effects: AthleteEffect[] = [];
    const breakRows: { cell: string; rate: number; dBrier: { mean: number; lo: number; hi: number }; dLogLoss: { mean: number; lo: number; hi: number } }[] = [];
    for (const cell of cells) {
      const started = Date.now();
      const { result, scored, types, facts } = runCell(cell, [champion, challenger], cell.kind !== "matrix");
      prepared.set(cell.key, types);
      results.push(result);
      leaks += Object.values(result.causality[challenger.name] ?? {}).reduce((sum, value) => sum + value, 0);
      for (const horizon of cell.horizons) {
        const a = scored.get(champion.name)!.get(horizon)!;
        const b = scored.get(challenger.name)!.get(horizon)!;
        const types = prepared.get(cell.key)!;
        const onlyAtypical = (runs: Scored[][]) => runs.map((run, index) => run.filter((item) => types[index].get(item.item.athleteId) === "atípico"));
        const atypicalA = onlyAtypical(a);
        const atypicalB = onlyAtypical(b);
        const samples = a.map((run, index) => pairedSample(run, b[index]));
        const verdict = verdictOf(
          cell.key,
          samples,
          atypicalA.map((run, index) => pairedSample(run, atypicalB[index])),
        );
        if (cell.kind === decideCells && horizon === decideOn) {
          verdicts.push(verdict);
          decisionSamples.push(samples);
          a.forEach((run, index) => parityRuns.push({ a: run, b: b[index], facts: facts[index] }));
          effects.push(...athleteEffects(cell.key, cell.seeds, a, b, types));
          const perSeed = result.predictors[challenger.name][decideOn]?.breaksPerSeed ?? [];
          const present = perSeed.filter((item): item is BreakMetrics => item != null);
          if (present.length) {
            breakRows.push({
              cell: cell.key,
              rate: present.reduce((sum, item) => sum + item.breakRate, 0) / present.length,
              dBrier: bootstrapMean(present.map((item) => item.brier - item.brierBase)),
              dLogLoss: bootstrapMean(present.map((item) => item.logLoss - item.logLossBase)),
            });
          }
        } else secondary.push({ cell: cell.key, horizon, verdict });
      }
      console.error(`${cell.key}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
    }
    const base = decide(verdicts, leaks, primary);
    const r9 = bootstrapUpper(pooledDeltas(decisionSamples, primary), 1 - 0.05 / BUDGET);
    const parity = parityRows(parityRuns);
    const rules = { ...base.rules, R9: Number.isFinite(r9.upper) && r9.upper < 0, R10: parityOk(parity) };
    const decision = { keep: Object.values(rules).every(Boolean), rules };
    const seedLabel: Record<SeedSet, string> = { tune: "sementes de ajuste", test: "sementes de teste antigas", dev: "sementes de desenvolvimento", confirm: "sementes de CONFIRMAÇÃO", fatigue: "sementes da tentativa de fadiga", g4tune: "sementes de sintonia (gerador 4.0)", g4dev: "sementes de desenvolvimento (gerador 4.0)", g4confirm: "sementes de CONFIRMAÇÃO (gerador 4.0, uso único)" };
    const lines = [`# ${challenger.name} vs ${champion.name} (${seedLabel[seedSet]} ${cells[0].seeds[0]}–${cells[0].seeds[cells[0].seeds.length - 1]}, gerador ${GENERATOR_VERSION})`, ""];
    lines.push(`Decide: células "${decideCells}", horizonte ${HORIZON_LABEL[decideOn]}, métrica primária ${primary === "mape" ? "MAPE" : "CRPS"}. Mesmas reps (Δ = desafiante − campeão; IC 95 % bootstrap das sementes):`, "");
    lines.push("| Célula | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) | Δ erro calibração 80 % (pp) | ΔMAPE atípicos (pp) |", "|---|---|---|---|---|---|---|---|");
    const ci = (v: { mean: number; lo: number; hi: number }) => `${fmt(v.mean, 3)} [${fmt(v.lo, 3)}; ${fmt(v.hi, 3)}]`;
    for (const v of verdicts) lines.push(`| ${v.cell} | ${v.n} | ${fmt(v.mapeA)}% | ${fmt(v.mapeB)}% | ${ci(v.dMape)} | ${ci(v.dCrps)} | ${ci(v.dCal)} | ${v.dAtypical ? ci(v.dAtypical) : "—"} |`);
    lines.push(
      "",
      `Δ${primary === "mape" ? "MAPE" : "CRPS"} agregado (média das células por semente): ${fmt(r9.mean, 3)} pp; limite unilateral a ${((1 - 0.05 / BUDGET) * 100).toFixed(2)} % (R9, Bonferroni sobre ${BUDGET}): ${fmt(r9.upper, 3)}.`,
      "",
      `Regras: ${Object.entries(decision.rules).map(([rule, ok]) => `${rule} ${ok ? "✓" : "✗"}`).join(" · ")} (fuga: ${leaks}).`,
      "",
      `**Veredicto: ${decision.keep ? "MANTER" : "NÃO MANTER"}**`,
      "",
      "Paridade (R10; subgrupos com ≥ 200 reps decidem):",
      "",
      "| Dimensão | Valor | Reps | MAPE campeão | MAPE desafiante | Δ (pp) | Δ erro calibração 80 % (pp) |",
      "|---|---|---|---|---|---|---|",
      ...parity.map((row) => `| ${row.dimension} | ${row.value} | ${row.n} | ${fmt(row.mapeA)}% | ${fmt(row.mapeB)}% | ${fmt(row.mapeB - row.mapeA, 3)} | ${row.calA == null || row.calB == null ? "—" : fmt(row.calB - row.calA, 1)} |`),
      "",
    );
    if (seedSet === "confirm") {
      // Pre-registered confirmation (docs/ml/experiments.md §2.4), used once on the frozen model.
      const pooled = bootstrapMean(pooledDeltas(decisionSamples, "mape"));
      const coverageOf = (name: string, cell: string) => results.find((item) => item.key === cell)?.predictors[name]?.[decideOn]?.overall.coverage80.mean ?? null;
      const c3 = verdicts.every((v) => {
        const b = coverageOf(challenger.name, v.cell);
        const a = coverageOf(champion.name, v.cell);
        return b != null && ((b >= 0.77 && b <= 0.83) || (a != null && Math.abs(b - 0.8) <= Math.abs(a - 0.8)));
      });
      const confirm = {
        C1: pooled.hi < 0,
        C2: verdicts.every((v) => Number.isFinite(v.dCrps.mean) && v.dCrps.mean <= 0),
        C3: c3,
        C4: verdicts.every((v) => v.dMape.mean <= 0.05),
        C5: leaks === 0,
      };
      lines.push(
        "## Confirmação (pré-registada, uma única vez)",
        "",
        `C1 — ΔMAPE agregado ${fmt(pooled.mean, 3)} [${fmt(pooled.lo, 3)}; ${fmt(pooled.hi, 3)}] pp (IC 95 %) → ${confirm.C1 ? "✓" : "✗"}`,
        `C2 — ΔCRPS ≤ 0 em todas as células → ${confirm.C2 ? "✓" : "✗"}`,
        `C3 — cobertura a 80 % entre 77 % e 83 % (ou não pior que a do campeão): ${verdicts.map((v) => `${v.cell.split(" ·")[0]} ${pct(coverageOf(challenger.name, v.cell))} (campeão ${pct(coverageOf(champion.name, v.cell))})`).join(", ")} → ${confirm.C3 ? "✓" : "✗"}`,
        `C4 — nenhuma célula pior que +0,05 pp → ${confirm.C4 ? "✓" : "✗"}`,
        `C5 — fugas: ${leaks} → ${confirm.C5 ? "✓" : "✗"}`,
        "C6 — dados reais (só leitura): avaliado à parte.",
        "",
        `**Confirmação: ${Object.values(confirm).every(Boolean) ? "PASSA" : "NÃO PASSA"} (C1–C5).**`,
        "",
      );
    }
    if (breakRows.length) {
      const ci4 = (v: { mean: number; lo: number; hi: number }) => `${fmt(v.mean, 4)} [${fmt(v.lo, 4)}; ${fmt(v.hi, 4)}]`;
      lines.push("Probabilidade de quebra do desafiante vs taxa de quebra da equipa até à véspera (R8; Δ = modelo − referência, IC 95 % bootstrap das sementes):", "", "| Célula | Taxa de quebra | ΔBrier | ΔLog loss |", "|---|---|---|---|");
      for (const row of breakRows) lines.push(`| ${row.cell} | ${pct(row.rate)} | ${ci4(row.dBrier)} | ${ci4(row.dLogLoss)} |`);
      const wins = breakRows.filter((row) => row.dBrier.hi < 0).length;
      lines.push("", `R8 (quebra): Brier com IC < 0 em ${wins} de ${breakRows.length} células → ${wins >= 3 ? "✓" : "✗"}.`, "");
    }
    if (effects.length) {
      const { q, df, p } = cochranQ(effects);
      const better = effects.filter((effect) => effect.hi95 < 0).length;
      const worse = effects.filter((effect) => effect.lo95 > 0).length;
      const share = (n: number) => `${((n / effects.length) * 100).toFixed(0)} %`;
      lines.push(
        "Heterogeneidade entre atletas (R7; cada atleta de cada réplica, ΔMAPE com IC por bootstrap dos dias):",
        "",
        `Q de Cochran = ${fmt(q, 1)} (gl ${df}), p ${p < 0.001 ? "< 0,001" : `= ${fmt(p, 3)}`}. Melhoram com IC 95 % < 0: ${better} de ${effects.length} (${share(better)}); pioram com IC > 0: ${worse} (${share(worse)}).`,
        "",
        "| Tipo | Atletas | Δ mediano (pp) | Melhoram (IC < 0) | Pioram (IC > 0) |",
        "|---|---|---|---|---|",
      );
      for (const type of ["típico", "atípico"]) {
        const list = effects.filter((effect) => effect.type === type);
        if (!list.length) continue;
        const sorted = list.map((effect) => effect.delta).sort((x, y) => x - y);
        lines.push(`| ${type} | ${list.length} | ${fmt(sorted[Math.floor(sorted.length / 2)], 3)} | ${list.filter((effect) => effect.hi95 < 0).length} | ${list.filter((effect) => effect.lo95 > 0).length} |`);
      }
      lines.push("", `Critério da R7 para avaliar uma versão por atleta: p < 0,05 e ≥ 20 % a melhorar → ${p < 0.05 && better / effects.length >= 0.2 ? "cumpre" : "não cumpre"}.`, "");
    }
    if (secondary.length) {
      lines.push("Outras células e horizontes (relatados, não decidem):", "", "| Célula | Horizonte | Reps comuns | MAPE campeão | MAPE desafiante | ΔMAPE (pp) | ΔCRPS (pp) |", "|---|---|---|---|---|---|---|");
      for (const { cell, horizon, verdict } of secondary) {
        const flagged = verdict.dMape.mean > 0.3 ? " ⚠" : "";
        lines.push(`| ${cell} | ${HORIZON_LABEL[horizon]} | ${verdict.n} | ${fmt(verdict.mapeA)}% | ${fmt(verdict.mapeB)}% | ${ci(verdict.dMape)}${flagged} | ${ci(verdict.dCrps)} |`);
      }
      lines.push("");
    }
    const md = lines.join("\n");
    console.log(md);
    const save = flag("save");
    if (save) {
      const dir = join(repoRoot(), "docs", "ml", "results");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${save}.md`), md);
      writeFileSync(join(dir, `${save}.json`), JSON.stringify({ kind: "synthetic", generator: GENERATOR_VERSION, seedSet, champion: champion.name, challenger: challenger.name, decision, verdicts, r9, parity, decideOn, decideCells, primary, secondary, breaks: breakRows, athleteEffects: effects, results: slim(results) }));
      console.error(`Saved docs/ml/results/${save}.{json,md}`);
    }
    return;
  }

  const predictors = pickPredictors((flag("predictors") ?? "último valor,mediana,modelo atual").split(","));
  const cells = protocolCells(seedSet, flag("cells") ?? "decision");
  const results: CellResult[] = [];
  for (const cell of cells) {
    const started = Date.now();
    results.push(runCell(cell, predictors, !has("no-leaks")).result);
    console.error(`${cell.key}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  const title = flag("title") ?? "Backtest cronológico";
  const lines = [`# ${title}`, "", `Dados **sintéticos** (gerador ${GENERATOR_VERSION}), ${seedSet === "test" ? "sementes de teste" : "sementes de ajuste"}. Protocolo: \`docs/ml/protocolo.md\`. Métricas em reps limpas (sem erro de digitação), média ± desvio entre sementes.`, ""];
  const decision = results.filter((result) => result.kind === "decision");
  const regime = results.filter((result) => result.kind === "regime");
  const matrix = results.filter((result) => result.kind === "matrix");
  if (decision.length) lines.push("## Células de decisão", "", ...decision.flatMap((result) => cellMarkdown(result, true)));
  if (regime.length) lines.push("## Regimes (multi-ano e regresso de agosto)", "", ...regime.flatMap((result) => cellMarkdown(result, true)));
  if (matrix.length) lines.push(...matrixMarkdown(matrix));
  const md = lines.join("\n");
  console.log(md);
  const save = flag("save");
  if (save) {
    const dir = join(repoRoot(), "docs", "ml", "results");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${save}.json`), JSON.stringify({ generatedBy: "apps/web/scripts/ml-backtest.ts", generator: GENERATOR_VERSION, kind: "synthetic", seedSet, results: slim(results) }));
    writeFileSync(join(dir, `${save}.md`), md);
    console.error(`Saved docs/ml/results/${save}.{json,md}`);
  }
}

main();


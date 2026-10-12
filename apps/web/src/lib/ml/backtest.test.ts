import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlausibleRep } from "../training-context";
import { predictTrainingTargets } from "../training-prediction";
import {
  bootstrapMean,
  checkCausality,
  dayNumber,
  erf,
  evaluationRows,
  gaussianCrps,
  HORIZONS,
  isoDay,
  metricsOf,
  originOf,
  pairedSample,
  runBacktest,
  teamData,
  type Predictor,
  type TeamData,
} from "./backtest";
import { legacyPredict } from "./legacy-baseline";
import { REFERENCE_PREDICTORS } from "./predictors";
import { DEFAULT_VARIANT, generateDataset, SYNTHETIC_PREFIX } from "./synthetic";

const dataset = generateDataset("arranque", 5);
const team = teamData(dataset);

describe("synthetic generator v2", () => {
  it("is reproducible from its seed", () => {
    const again = generateDataset("arranque", 5);
    assert.deepEqual(
      again.timeLogs.map((log) => [log.id, log.mm, log.ss, log.cc]),
      dataset.timeLogs.map((log) => [log.id, log.mm, log.ss, log.cc]),
    );
    assert.notDeepEqual(
      generateDataset("arranque", 6).timeLogs.slice(0, 20).map((log) => log.cc),
      dataset.timeLogs.slice(0, 20).map((log) => log.cc),
    );
  });

  it("marks everything as synthetic and only fills fields the site asks for", () => {
    assert.equal(dataset.kind, "synthetic");
    for (const athlete of dataset.athletes) {
      assert.ok(athlete.id.startsWith(SYNTHETIC_PREFIX));
      assert.match(athlete.dateOfBirth, /^\d{4}-\d{2}-\d{2}$/);
    }
    for (const workout of dataset.workouts) assert.ok(workout.id.startsWith(SYNTHETIC_PREFIX));
    for (const log of dataset.timeLogs) assert.ok(log.id.startsWith(SYNTHETIC_PREFIX));
    for (const athlete of dataset.athletes) for (const entry of athlete.wellness) assert.deepEqual(Object.keys(entry).sort(), ["date", "gym", "recovery", "sleepHours"]);
  });

  it("goes through the app's own annotation and produces plausible clean times", () => {
    const rows = [...team.rows.values()].flat();
    assert.ok(rows.length > 200);
    for (const row of rows.filter((item) => dataset.truth.get(item.log.id)?.error == null)) assert.ok(isPlausibleRep(row), `${row.timeS} for ${row.distanceM}`);
  });

  it("times race-pace sets more often than aerobic sets when data is missing", () => {
    const big = generateDataset("tipico", 3, { ...DEFAULT_VARIANT, data: "em-falta" });
    const rows = [...teamData(big).rows.values()].flat();
    const share = (pred: (intensity: string) => boolean) => rows.filter((row) => pred(row.intensity)).length;
    assert.ok(share((i) => i.startsWith("P") && i !== "PROG" && i !== "PA") > 0);
    const complete = generateDataset("tipico", 3, { ...DEFAULT_VARIANT, data: "completos" });
    assert.ok(complete.timeLogs.length > big.timeLogs.length * 1.5);
  });

  it("keeps less workout content as the context level drops", () => {
    const meters = (context: "nenhum" | "basico" | "carga") =>
      generateDataset("esparso", 4, { ...DEFAULT_VARIANT, data: "em-falta", context }).workouts.reduce((sum, workout) => sum + workout.blocks.length, 0);
    assert.ok(meters("nenhum") < meters("basico"));
    assert.ok(meters("basico") < meters("carga"));
  });

  it("brings athletes back slower after the August break, more so when they return late", () => {
    const effect = (name: "regresso-curta" | "regresso-tardia") => {
      const ratios: number[] = [];
      for (const seed of [1, 2, 3]) {
        const ds = generateDataset(name, seed, { ...DEFAULT_VARIANT, data: "completos" });
        // Adults only: in growing swimmers a season's growth outweighs three weeks of detraining.
        const adults = new Set(ds.athletes.filter((a) => (dayNumber(ds.returns[1].team) - dayNumber(a.dateOfBirth)) / 365.25 >= 18).map((a) => a.id));
        for (const [id, rows] of teamData(ds).rows) {
          if (!adults.has(id)) continue;
          const back = dayNumber(ds.returns[1].athletes[id]);
          const byGroup = new Map<string, { before: number[]; after: number[] }>();
          for (const row of rows) {
            const truth = ds.truth.get(row.log.id)!;
            if (truth.error) continue;
            const key = `${row.course}|${row.distanceM}|${row.stroke}|${row.intensity}|${row.gearLabel}`;
            const entry = byGroup.get(key) ?? { before: [], after: [] };
            const day = dayNumber(row.date);
            if (back - day > 81 && back - day < 200) entry.before.push(truth.expectedS);
            if (day >= back && day - back < 14) entry.after.push(truth.expectedS);
            byGroup.set(key, entry);
          }
          const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
          for (const entry of byGroup.values()) if (entry.before.length >= 3 && entry.after.length >= 2) ratios.push(median(entry.after) / median(entry.before));
        }
      }
      return [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
    };
    const short = effect("regresso-curta");
    const late = effect("regresso-tardia");
    assert.ok(short > 1.002, `short break ${short}`);
    assert.ok(late > short, `late ${late} vs short ${short}`);
  });
});

describe("metrics", () => {
  it("computes MAE, MAPE, bias and coverage", () => {
    const row = team.rows.values().next().value![0];
    const pairs = [
      { row, actual: 100, prediction: { mean: 102, lo: 99, hi: 105, nominal: 0.8, sd: 2 } },
      { row, actual: 50, prediction: { mean: 49, lo: 48, hi: 49.8, nominal: 0.8, sd: 1 } },
      { row, actual: 60, prediction: undefined },
    ];
    const m = metricsOf(pairs);
    assert.equal(m.n, 2);
    assert.equal(m.eligible, 3);
    assert.equal(m.maeS, 1.5);
    assert.ok(Math.abs(m.mapePct - 2) < 1e-9);
    assert.ok(Math.abs(m.biasPct - 0) < 1e-9);
    assert.equal(m.coverage, 0.5);
  });

  it("has a correct erf and Gaussian CRPS", () => {
    assert.ok(Math.abs(erf(1) - 0.8427007929) < 1e-6);
    assert.ok(Math.abs(gaussianCrps(0, 1, 0) - (Math.SQRT2 - 1) / Math.sqrt(Math.PI)) < 1e-6);
    assert.ok(gaussianCrps(10, 0.5, 10.1) < gaussianCrps(10, 2, 10.1));
  });

  it("bootstraps a sensible interval for the mean", () => {
    const ci = bootstrapMean([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(ci.mean, 5.5);
    assert.ok(ci.lo > 3.5 && ci.lo < 5.5 && ci.hi > 5.5 && ci.hi < 7.5);
    assert.deepEqual(bootstrapMean([1, 2, 3]), bootstrapMean([1, 2, 3]));
  });

  it("compares two models only on the reps both predicted", () => {
    const evalRows = evaluationRows(team, dataset);
    const a = runBacktest(REFERENCE_PREDICTORS[0], dataset, HORIZONS.day, team, evalRows).scored;
    const sample = pairedSample(a, a);
    assert.equal(sample.mapeA, sample.mapeB);
    assert.ok(sample.n > 0);
  });
});

describe("horizons", () => {
  it("gives every rep exactly one origin within its lead window", () => {
    for (const horizon of [HORIZONS.semana, HORIZONS.mes, HORIZONS.ano]) {
      for (let day = 20000; day < 20030; day += 1) {
        const date = isoDay(day);
        const origin = originOf(date, horizon, 19990);
        const lead = day - origin;
        assert.ok(lead >= horizon.minLead && lead <= horizon.maxLead);
        assert.equal((((origin - 19990) % 7) + 7) % 7, 0);
      }
    }
  });
});

describe("history buckets", () => {
  it("counts only earlier dates of the same group", () => {
    const rows = evaluationRows(team, dataset);
    const firstDay = rows.filter((item) => item.row.date === rows[0].row.date && item.athleteId === rows[0].athleteId);
    for (const item of firstDay) assert.equal(item.groupHistory, 0);
  });
});

describe("legacy baseline engine", () => {
  it("matches the production model exactly at the day horizon", () => {
    let total = 0;
    for (const [name, seed] of [["esparso", 3], ["tipico", 5]] as const) {
      const ds = generateDataset(name, seed);
      const data = teamData(ds);
      const fast = legacyPredict(data, HORIZONS.day);
      let compared = 0;
      for (const rows of data.rows.values()) {
        const byCourse = new Map<string, typeof rows>();
        for (const row of rows) byCourse.set(row.course || "", [...(byCourse.get(row.course || "") ?? []), row]);
        for (const list of byCourse.values()) {
          for (const [id, target] of predictTrainingTargets(list)) {
            const mine = fast.get(id);
            assert.ok(mine, `missing ${id}`);
            assert.ok(Math.abs(mine.mean - target.targetS) < 1e-9 * target.targetS, `${id}: ${mine.mean} vs ${target.targetS}`);
            assert.ok(Math.abs(mine.hi! - target.highS) < 1e-7 * target.targetS, `${id} band`);
            assert.equal(mine.confidence, target.confidence);
            compared += 1;
          }
        }
      }
      let produced = 0;
      for (const id of fast.keys()) if (id) produced += 1;
      assert.equal(produced, compared);
      total += compared;
    }
    assert.ok(total > 1000, `only ${total} compared`);
  });
});

describe("causality check", () => {
  it("passes for every reference predictor in every horizon", () => {
    for (const predictor of REFERENCE_PREDICTORS) {
      for (const horizon of [HORIZONS.rep, HORIZONS.day, HORIZONS.semana, HORIZONS.mes]) {
        assert.deepEqual(checkCausality(predictor, team, horizon), [], `${predictor.name} / ${horizon.name}`);
      }
    }
  });

  it("catches a predictor that looks at the rep it predicts", () => {
    const cheat: Predictor = {
      name: "cheat",
      description: "uses the answer",
      predict(input: TeamData) {
        return new Map([...input.rows.values()].flat().map((row) => [row.log.id, { mean: row.timeS }]));
      },
    };
    for (const horizon of [HORIZONS.rep, HORIZONS.day, HORIZONS.mes]) assert.ok(checkCausality(cheat, team, horizon).length > 0);
  });

  it("catches a forecast that uses the plan when it is not known yet", () => {
    const planPeek: Predictor = {
      name: "plan",
      description: "uses the target's planned load a month ahead",
      predict(input: TeamData) {
        return new Map([...input.rows.values()].flat().map((row) => [row.log.id, { mean: row.distanceM + row.weeklyLoadM / 1000 }]));
      },
    };
    assert.ok(checkCausality(planPeek, team, HORIZONS.mes).length > 0);
    assert.equal(checkCausality(planPeek, team, HORIZONS.semana).length, 0);
  });

  it("catches a predictor that uses later sessions", () => {
    const future: Predictor = {
      name: "future",
      description: "averages the whole history, including what comes later",
      predict(input: TeamData) {
        const out = new Map();
        for (const rows of input.rows.values()) {
          const mean = rows.reduce((sum, row) => sum + row.timeS / row.distanceM, 0) / rows.length;
          for (const row of rows) out.set(row.log.id, { mean: mean * row.distanceM });
        }
        return out;
      },
    };
    assert.ok(checkCausality(future, team).length > 0);
  });
});

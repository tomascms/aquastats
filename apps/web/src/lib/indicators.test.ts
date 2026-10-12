import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cssPace, fadeIndex, levelOfPoints, pctOfBest, splitDifferential, swolf, distancePerStroke, strokeRate, trainingSignals, trend } from "./indicators";
import { generateDataset, SCENARIOS } from "./ml/synthetic";
import { finaPoints } from "./rankings";
import { annotateTrainingReps } from "./training-context";

describe("indicadores — fórmulas", () => {
  it("CSS 200/400: (T400 − T200) / 2", () => {
    assert.equal(cssPace(200, 130, 400, 270), 70);
    assert.equal(cssPace(400, 270, 200, 130), null);
  });

  it("queda, parciais, SWOLF, DPS, frequência, % do melhor, tendência", () => {
    assert.ok(Math.abs(fadeIndex([60, 60, 63, 63])! - 5) < 1e-9);
    assert.equal(fadeIndex([60, 61]), null);
    assert.ok(Math.abs(splitDifferential(22.4, 46.9)! - 9.375) < 1e-9);
    assert.equal(swolf(30, 18), 48);
    assert.equal(distancePerStroke(50, 25), 2);
    assert.equal(strokeRate(25, 30), 50);
    assert.ok(Math.abs(pctOfBest(51, 50) - 2) < 1e-9);
    assert.ok(Math.abs(trend(110, [100, 100], 5)!.pct - 10) < 1e-9 && trend(110, [100, 100], 5)!.real);
    assert.equal(trend(100.5, [100], 1)!.real, false);
  });

  it("pontos World Aquatics e níveis: o recorde vale 1000, elite ≥ 870", () => {
    assert.equal(finaPoints(46.4, "lcm", "free", 100, "M"), 1000);
    assert.equal(levelOfPoints(1000), "Elite mundial");
    assert.equal(levelOfPoints(finaPoints(53.5, "lcm", "free", 100, "M")), "Nacional absoluto");
    assert.equal(levelOfPoints(120), "Iniciação");
  });
});

describe("indicadores — coerência com o gerador 4.0", () => {
  const data = generateDataset({ ...SCENARIOS.tipico, athletes: 12 }, 6104);

  it("os sinais nunca afirmam certeza e pedem dados quando não os há", () => {
    const athlete = data.athletes[3];
    const reps = annotateTrainingReps(data.workouts, data.timeLogs, athlete.id);
    const signals = trainingSignals({ reps, weeklyLoad: [10, 10, 10, 10, 20], phase: "general", daysToMeetA: 10, today: data.dataEnd });
    assert.ok(signals.some((s) => s.kind === "taper"));
    assert.ok(signals.some((s) => s.kind === "carga-acima"));
    assert.ok(signals.every((s) => s.data.length > 0 && ["baixa", "média", "alta"].includes(s.uncertainty)));
    assert.deepEqual(trainingSignals({ reps: [], weeklyLoad: [], phase: null, daysToMeetA: null, today: data.dataEnd }).map((s) => s.kind), ["sem-dados"]);
  });
});

describe("indicadores — plano de prova", () => {
  it("as frações de referência somam 1 e o plano termina no tempo-alvo", async () => {
    const { referenceFractions, splitPlan, fractionsFromSplits } = await import("./indicators");
    for (const d of [100, 200, 400, 800, 1500]) {
      const f = referenceFractions(d);
      assert.ok(Math.abs(f.reduce((a, b) => a + b, 0) - 1) < 1e-9, `${d}`);
      assert.ok(Math.abs(splitPlan(60, f).at(-1)!.cumulativeS - 60) < 1e-9);
    }
    const f = fractionsFromSplits([{ atM: 50, mm: 0, ss: 25, cc: 0 }, { atM: 100, mm: 0, ss: 52, cc: 0 }], 100)!;
    assert.ok(Math.abs(f[0] - 25 / 52) < 1e-9);
    assert.equal(fractionsFromSplits([{ atM: 50, mm: 0, ss: 25, cc: 0 }], 100), null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cssPace, fadeIndex, intensityAdherence, levelOfPoints, lcmPaceS100, pctOfBest, splitDifferential, swolf, distancePerStroke, strokeRate, trainingSignals, trend, zoneTargets } from "./indicators";
import { cssSpeed, dayOf, generateDataset, SCENARIOS } from "./ml/synthetic";
import { finaPoints } from "./rankings";
import { annotateTrainingReps } from "./training-context";

describe("indicadores — fórmulas", () => {
  it("CSS 200/400: (T400 − T200) / 2", () => {
    assert.equal(cssPace(200, 130, 400, 270), 70);
    assert.equal(cssPace(400, 270, 200, 130), null);
  });

  it("zonas: A1 mais lenta que A2, A2 que A3, A3 que PA; em % da velocidade CSS", () => {
    const z = new Map(zoneTargets(70).map((t) => [t.intensity, t]));
    assert.ok(Math.abs(z.get("A2")!.fromS100 - 70 / 0.95) < 1e-9 && Math.abs(z.get("A2")!.toS100 - 70 / 0.92) < 1e-9);
    assert.ok(z.get("A1")!.fromS100 > z.get("A2")!.toS100);
    assert.ok(z.get("A3")!.toS100 < z.get("A2")!.fromS100);
    assert.ok(z.get("PA")!.toS100 < 70);
  });

  it("aderência com 1 s de tolerância", () => {
    const a2 = { intensity: "A2" as const, fromS100: 74, toS100: 78 };
    assert.equal(intensityAdherence(73.5, a2), "dentro");
    assert.equal(intensityAdherence(72.5, a2), "rapido");
    assert.equal(intensityAdherence(79.5, a2), "lento");
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
  const end = dayOf(data.dataEnd);

  it("o A2 livre sem material cai no alvo da CSS do atleta na maioria das reps", () => {
    let inside = 0;
    let total = 0;
    for (const athlete of data.athletes) {
      const css = 100 / cssSpeed(athlete.profile, end);
      const a2 = zoneTargets(css).find((t) => t.intensity === "A2")!;
      const reps = annotateTrainingReps(data.workouts, data.timeLogs, athlete.id).filter(
        (row) => row.intensity === "A2" && row.stroke === "free" && !row.gear.length && dayOf(row.date) > end - 60,
      );
      for (const row of reps) {
        total += 1;
        if (intensityAdherence(lcmPaceS100(row), a2, 2) === "dentro") inside += 1;
      }
    }
    assert.ok(total > 50, `${total} reps`);
    assert.ok(inside / total > 0.6, `${((inside / total) * 100).toFixed(0)} % dentro`);
  });

  it("os sinais nunca afirmam certeza e pedem dados quando não os há", () => {
    const athlete = data.athletes[3];
    const reps = annotateTrainingReps(data.workouts, data.timeLogs, athlete.id);
    const signals = trainingSignals({ reps, weeklyLoad: [10, 10, 10, 10, 20], css: 70, phase: "general", daysToMeetA: 10, today: data.dataEnd });
    assert.ok(signals.some((s) => s.kind === "taper"));
    assert.ok(signals.some((s) => s.kind === "carga-acima"));
    assert.ok(signals.every((s) => s.data.length > 0 && ["baixa", "média", "alta"].includes(s.uncertainty)));
    assert.deepEqual(trainingSignals({ reps: [], weeklyLoad: [], css: null, phase: null, daysToMeetA: null, today: data.dataEnd }).map((s) => s.kind), ["sem-dados"]);
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

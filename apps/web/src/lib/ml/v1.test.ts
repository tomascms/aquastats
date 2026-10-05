import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HORIZONS, teamData, type Dataset } from "./backtest";
import { ACCEPTED, ACCEPTED_CALIBRATION, V1 } from "./registry";
import { DEFAULT_OPTIONS } from "./state-model";
import { generateDataset } from "./synthetic";
import { V1_CALIBRATION, V1_OPTIONS } from "./v1";

/*
 * v1.0 is frozen: these checksums were taken when it was frozen (docs/ml/experiments.md). If a change
 * anywhere moves a v1.0 forecast, this fails — that change is a new model version, not a refactor.
 */
const GOLDEN = {
  day: { n: 526, sumMean: 33027.948069, sumHi: 34958.457288 },
  rep: { n: 526, sumMean: 33140.017508, sumHi: 33950.753127 },
};

describe("v1.0 (frozen)", () => {
  it("is the state model plus exactly the changes the final phase accepted", () => {
    assert.deepEqual(V1_OPTIONS, { ...DEFAULT_OPTIONS, ...ACCEPTED });
    assert.deepEqual(V1_CALIBRATION, ACCEPTED_CALIBRATION);
  });

  it("still makes the forecasts it made when it was frozen", () => {
    const team = teamData(generateDataset("arranque", 3) as unknown as Dataset);
    for (const horizon of ["day", "rep"] as const) {
      const out = V1.predict(team, HORIZONS[horizon]);
      let sumMean = 0;
      let sumHi = 0;
      for (const prediction of out.values()) {
        sumMean += prediction.mean;
        sumHi += prediction.hi!;
      }
      assert.equal(out.size, GOLDEN[horizon].n);
      assert.ok(Math.abs(sumMean - GOLDEN[horizon].sumMean) < 1e-5, `${horizon}: mean checksum ${sumMean}`);
      assert.ok(Math.abs(sumHi - GOLDEN[horizon].sumHi) < 1e-5, `${horizon}: interval checksum ${sumHi}`);
    }
  });
});

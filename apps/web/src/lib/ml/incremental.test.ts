import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayNumber, HORIZONS, teamData, teamUpTo, type Dataset, type Prediction } from "./backtest";
import { calibrateStream, type CalibrationCheckpoint } from "./calibration";
import { runStateModel, type StateCheckpoint, type TeamForecast } from "./forecaster";
import { teamSuspects } from "./quality";
import { generateDataset } from "./synthetic";
import { V1_CALIBRATION, V1_OPTIONS } from "./v1";

function assertSameForecasts(a: Map<string, TeamForecast>, b: Map<string, TeamForecast>) {
  assert.equal(a.size, b.size);
  for (const [id, forecast] of a) {
    const other = b.get(id);
    assert.ok(other, `missing ${id}`);
    assert.equal(other.logMean, forecast.logMean, `${id}: mean differs`);
    assert.equal(other.logSd, forecast.logSd, `${id}: sd differs`);
    assert.equal(other.pBreakBy, forecast.pBreakBy, `${id}: break probability differs`);
  }
}

describe("incremental state (checkpoint and resume)", () => {
  const team = teamData(generateDataset("tipico", 5) as unknown as Dataset);
  const excluded = new Set(teamSuspects(team.rows).keys());
  const dates = [...new Set([...team.rows.values()].flat().map((row) => dayNumber(row.date)))].sort((a, b) => a - b);
  const cut = dates[Math.floor(dates.length * 0.7)];

  for (const horizon of ["day", "rep"] as const) {
    it(`${horizon}: resuming from a checkpoint gives exactly the full run`, () => {
      const full = runStateModel(team, HORIZONS[horizon], V1_OPTIONS, excluded);
      let saved: StateCheckpoint | null = null;
      runStateModel(team, HORIZONS[horizon], V1_OPTIONS, excluded, { checkpointAt: cut, onCheckpoint: (cp) => (saved = cp) });
      assert.ok(saved);
      assertSameForecasts(full, runStateModel(team, HORIZONS[horizon], V1_OPTIONS, excluded, { resume: saved! }));
    });

    it(`${horizon}: a checkpoint taken before later days existed, resumed once they are entered, gives exactly the full run`, () => {
      const full = runStateModel(team, HORIZONS[horizon], V1_OPTIONS, excluded);
      let saved: StateCheckpoint | null = null;
      const past = teamUpTo(team, cut);
      runStateModel(past, HORIZONS[horizon], V1_OPTIONS, new Set([...excluded].filter((id) => [...past.rows.values()].some((rows) => rows.some((row) => row.log.id === id)))), {
        checkpointAt: cut,
        onCheckpoint: (cp) => (saved = cp),
      });
      assert.ok(saved);
      const resumed = runStateModel(team, HORIZONS[horizon], V1_OPTIONS, excluded, { resume: saved! });
      assertSameForecasts(full, resumed);
      // And the checkpoint is not consumed: it can be resumed from again.
      assertSameForecasts(full, runStateModel(team, HORIZONS[horizon], V1_OPTIONS, excluded, { resume: saved! }));
    });
  }

  for (const horizon of ["day", "rep"] as const) {
    it(`${horizon}: the calibrated intervals resume exactly too`, () => {
      const point = (forecasts: Map<string, TeamForecast>) => {
        const out = new Map<string, Prediction>();
        for (const [id, f] of forecasts) out.set(id, { mean: f.meanS, sd: f.meanS * f.logSd, nominal: 0.8 });
        return out;
      };
      const suspects = teamSuspects(team.rows, { withinDayCausal: horizon === "rep" });
      const full = calibrateStream(point(runStateModel(team, HORIZONS[horizon], V1_OPTIONS, excluded)), team, HORIZONS[horizon], V1_CALIBRATION, { suspects });
      const past = teamUpTo(team, cut);
      let saved: CalibrationCheckpoint | null = null;
      calibrateStream(point(runStateModel(past, HORIZONS[horizon], V1_OPTIONS, excluded)), past, HORIZONS[horizon], V1_CALIBRATION, {
        suspects: teamSuspects(past.rows, { withinDayCausal: horizon === "rep" }),
        checkpointAt: cut,
        onCheckpoint: (cp) => (saved = cp),
      });
      assert.ok(saved);
      const resumed = calibrateStream(point(runStateModel(team, HORIZONS[horizon], V1_OPTIONS, excluded)), team, HORIZONS[horizon], V1_CALIBRATION, { suspects, resume: saved! });
      assert.equal(resumed.size, full.size);
      for (const [id, prediction] of full) {
        assert.equal(resumed.get(id)?.lo, prediction.lo, `${id}: interval differs`);
        assert.equal(resumed.get(id)?.hi, prediction.hi, `${id}: interval differs`);
      }
    });
  }

  it("suspect times: checking only the new days, with the earlier flags known, finds exactly the same", () => {
    const full = teamSuspects(team.rows);
    const before = teamSuspects(teamUpTo(team, cut).rows);
    const after = teamSuspects(team.rows, { fromDay: cut + 1, known: before });
    const merged = new Map([...before, ...after]);
    assert.deepEqual([...merged.keys()].sort(), [...full.keys()].sort());
    for (const [id, suspect] of full) assert.deepEqual(merged.get(id), suspect);
  });
});

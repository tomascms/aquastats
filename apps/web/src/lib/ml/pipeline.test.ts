import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayNumber, HORIZONS, teamData, teamUpTo, type Dataset } from "./backtest";
import { calibrateStream } from "./calibration";
import { runStateModel } from "./forecaster";
import { clearPipelineCache, runV1Pipeline, teamFingerprint } from "./pipeline";
import { teamSuspects } from "./quality";
import { generateDataset } from "./synthetic";
import { V1_CALIBRATION, V1_OPTIONS } from "./v1";

describe("v1.0 pipeline in the app (incremental)", () => {
  const team = teamData(generateDataset("denso", 6) as unknown as Dataset);
  const dates = [...new Set([...team.rows.values()].flat().map((row) => dayNumber(row.date)))].sort((a, b) => a - b);

  function fullRun() {
    const suspects = teamSuspects(team.rows);
    const raw = runStateModel(team, HORIZONS.day, V1_OPTIONS, new Set(suspects.keys()));
    const point = new Map([...raw].map(([id, f]) => [id, { mean: f.meanS, sd: f.meanS * f.logSd, nominal: 0.8 }]));
    return calibrateStream(point, team, HORIZONS.day, V1_CALIBRATION, { suspects });
  }

  it("reuses the result for the same data, resumes for new days, and matches a full run exactly", () => {
    clearPipelineCache();
    const reference = fullRun();
    // Monday: data up to some day. Later: two more weeks entered.
    const monday = teamUpTo(team, dates[Math.floor(dates.length * 0.8)]);
    assert.equal(runV1Pipeline(monday).mode, "full");
    assert.equal(runV1Pipeline(monday).mode, "cache");
    const later = runV1Pipeline(team);
    assert.equal(later.mode, "resume");
    assert.ok(later.daysRun < dates.length / 4, `resumed run processed ${later.daysRun} days`);
    assert.equal(later.calibrated.size, reference.size);
    for (const [id, prediction] of reference) {
      const got = later.calibrated.get(id)!;
      assert.equal(got.mean, prediction.mean, `${id}: mean differs`);
      assert.equal(got.hi, prediction.hi, `${id}: interval differs`);
    }
  });

  it("an edited old time invalidates the checkpoint: full run", () => {
    clearPipelineCache();
    runV1Pipeline(team);
    const [athleteId, rows] = [...team.rows][0];
    const edited = { ...team, rows: new Map(team.rows) };
    edited.rows.set(athleteId, rows.map((row, i) => (i === 3 ? { ...row, timeS: row.timeS + 0.5 } : row)));
    const editedDay = dayNumber(rows[3].date);
    assert.notEqual(teamFingerprint(edited, editedDay), teamFingerprint(team, editedDay));
    assert.equal(teamFingerprint(edited, editedDay - 1), teamFingerprint(team, editedDay - 1));
    assert.equal(runV1Pipeline(edited).mode, "full");
  });
});

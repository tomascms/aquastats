import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayNumber, teamData, type Dataset, type RaceResult, type TeamData } from "./backtest";
import { predictRaces, referenceRaceTime } from "./races";
import { ACCEPTED } from "./registry";
import { createRng } from "./rng";
import { DEFAULT_OPTIONS } from "./state-model";
import { generateDataset } from "./synthetic";

const options = { ...DEFAULT_OPTIONS, ...ACCEPTED };

describe("race times (E13)", () => {
  const dataset = generateDataset("tipico", 7) as unknown as Dataset;
  const team = teamData(dataset);

  it("forecasts races with a finite time and an interval around it", () => {
    const predictions = predictRaces(team, options, 1);
    assert.ok(predictions.length > 20);
    for (const p of predictions) {
      assert.ok(Number.isFinite(p.meanS) && p.meanS > 0);
      assert.ok(p.lo < p.meanS && p.meanS < p.hi);
    }
  });

  it("never looks past its origin: changing everything after it leaves the forecast unchanged", () => {
    for (const lead of [1, 28]) {
      const original = new Map(predictRaces(team, options, lead).map((p) => [p.id, p]));
      const days = [...new Set([...(team.races?.values() ?? [])].flat().map((race) => dayNumber(race.date)))].sort((a, b) => a - b);
      const cutoff = days[Math.floor(days.length / 2)] - lead;
      const rng = createRng(11);
      // Future training times jittered, future races moved: nothing dated after the cutoff may matter.
      const rows = new Map([...team.rows].map(([id, list]) => [id, list.map((row) => (dayNumber(row.date) > cutoff ? { ...row, timeS: row.timeS * rng.uniform(0.95, 1.05) } : row))]));
      const races = new Map([...(team.races ?? new Map())].map(([id, list]) => [id, list.map((race: RaceResult) => (dayNumber(race.date) > cutoff ? { ...race, timeS: race.timeS * rng.uniform(0.95, 1.05) } : race))]));
      const perturbed: TeamData = { ...team, rows, races };
      let checked = 0;
      for (const p of predictRaces(perturbed, options, lead)) {
        if (dayNumber(p.race.date) - lead > cutoff) continue;
        const before = original.get(p.id)!;
        assert.equal(p.meanS, before.meanS, `${p.id} moved with future data (lead ${lead})`);
        assert.equal(p.hi, before.hi);
        checked += 1;
      }
      assert.ok(checked > 5);
    }
  });

  it("the reference uses only earlier races of the same event", () => {
    for (const race of [...(team.races?.values() ?? [])].flat().slice(0, 50)) {
      const reference = referenceRaceTime(team, race, 1);
      const earlier = (team.races?.get(race.athleteId) ?? []).filter((other) => other.date < race.date && other.distanceM === race.distanceM && other.stroke === race.stroke && other.course === race.course);
      assert.equal(reference == null, earlier.length === 0);
    }
  });
});

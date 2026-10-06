import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Athlete, Workout } from "../types";
import { ledgerItems } from "./ledger";
import { runMlJob } from "./ml-jobs";
import { appTeam, predictionsFor, timingSuggestions } from "./production";
import { generateDataset } from "./synthetic";

// Synthetic only (tuning seed): the worker must compute exactly what the screens computed inline.
const data = generateDataset("tipico", 2);
const athletes: Athlete[] = data.athletes.map((a) => ({
  id: a.id, name: a.name, isPlaceholder: false, primaryStroke: a.primaryStroke, teamId: "team", groupName: a.group, gender: a.gender,
}));
const last = [...data.workouts].sort((a, b) => a.date.localeCompare(b.date)).at(-1) as Workout;
const upcoming: Workout = { ...last, id: "upcoming", date: "2099-01-01" };
const workouts = [...data.workouts, upcoming];
const timeLogs = data.timeLogs;

describe("model jobs (Web Worker payloads)", () => {
  it("ledger job = predictionsFor + ledgerItems on the same planned reps", () => {
    const result = runMlJob({ kind: "ledger", models: [["estado", "champion"]], athletes, workouts, timeLogs, workoutId: upcoming.id });
    assert.equal(result.kind, "ledger");
    const { team, planned } = appTeam(athletes, workouts, timeLogs, [upcoming]);
    const expected = ledgerItems(predictionsFor("estado", team), planned);
    assert.ok(expected.length > 0);
    assert.deepEqual(result.kind === "ledger" ? result.recordings[0].items : null, expected);
  });

  it("hints job = timingSuggestions, first N", () => {
    const result = runMlJob({ kind: "hints", limit: 3, athletes, workouts, timeLogs, workoutId: upcoming.id });
    const { team, planned } = appTeam(athletes, workouts, timeLogs, [upcoming]);
    assert.deepEqual(result.kind === "hints" ? result.hints : null, timingSuggestions(team, planned).slice(0, 3));
  });

  it("an unknown workout gives empty results, not an error", () => {
    const result = runMlJob({ kind: "ledger", models: [["estado", "champion"]], athletes, workouts, timeLogs, workoutId: "missing" });
    assert.deepEqual(result, { kind: "ledger", recordings: [] });
  });
});

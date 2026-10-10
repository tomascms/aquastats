import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sinceLastSession, weekComparison, whoNeedsAttention } from "./morning";
import type { Athlete, TimeLog, Workout } from "./types";

const athlete = (id: string, extra: Partial<Athlete> = {}): Athlete => ({ id, name: id, isPlaceholder: false, primaryStroke: "free", teamId: "t", ...extra });
const workout = (id: string, date: string, athleteIds: string[]): Workout => ({ id, title: id, date, shift: "morning", athleteIds, blocks: [] });
const log = (workoutId: string, athleteId: string): TimeLog => ({ id: `${workoutId}-${athleteId}`, workoutId, blockId: "b", athleteId, repNumber: 1, mm: 0, ss: 30, cc: 0, splits: [], stroke: "free", pending: false, recordedAt: "" });

describe("morning view", () => {
  const today = "2026-10-09";

  it("flags athletes who train but have no recent times, and stale or poor wellness", () => {
    const athletes = [
      athlete("timed"),
      athlete("untimed"),
      athlete("away"),
      athlete("tired", { wellness: [{ date: "2026-10-08", sleepHours: 6, gym: null, recovery: 2 }] }),
      athlete("silent", { wellness: [{ date: "2026-09-20", sleepHours: 8, gym: null, recovery: 4 }] }),
    ];
    const workouts = [workout("w1", "2026-10-07", ["timed", "untimed", "tired", "silent"]), workout("w0", "2026-08-01", ["away"])];
    const out = whoNeedsAttention(athletes, workouts, [log("w1", "timed"), log("w1", "tired"), log("w1", "silent")], today);
    const reasons = Object.fromEntries(out.map((item) => [item.athlete.id, item.reasons.map((r) => r.kind)]));
    assert.deepEqual(reasons.untimed, ["noTimes"]);
    assert.deepEqual(reasons.tired, ["lowRecovery"]);
    assert.deepEqual(reasons.silent, ["noWellness"]);
    assert.equal(reasons.timed, undefined);
    assert.equal(reasons.away, undefined); // not training lately: not "missing data"
  });

  it("compares this week with the same days of last week", () => {
    const workouts = [workout("now", "2026-10-06", []), workout("before", "2026-09-29", []), workout("late", "2026-10-03", [])];
    const { current, previous } = weekComparison(workouts, [log("now", "a"), log("before", "a"), log("before", "b")], today);
    assert.deepEqual([current.sessions, current.times], [1, 1]);
    assert.deepEqual([previous.sessions, previous.times], [1, 2]); // 3 Oct is a Saturday: outside Mon-Thu of last week
  });

  it("counts times entered since the previous session day", () => {
    const workouts = [workout("a", "2026-10-01", []), workout("b", "2026-10-07", [])];
    assert.deepEqual(sinceLastSession(workouts, [log("a", "x"), log("b", "x"), log("b", "y")], today), { since: "2026-10-07", times: 2 });
  });
});

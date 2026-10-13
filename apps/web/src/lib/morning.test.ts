import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { periodComparison, periodRanges, sinceLastSession } from "./morning";
import type { TimeLog, Workout } from "./types";

const workout = (id: string, date: string, athleteIds: string[]): Workout => ({ id, title: id, date, shift: "morning", athleteIds, blocks: [] });
const log = (workoutId: string, athleteId: string): TimeLog => ({ id: `${workoutId}-${athleteId}`, workoutId, blockId: "b", athleteId, repNumber: 1, mm: 0, ss: 30, cc: 0, splits: [], stroke: "free", pending: false, recordedAt: "" });

describe("morning view", () => {
  const today = "2026-10-09";

  it("compares this week with the same days of last week", () => {
    const workouts = [workout("now", "2026-10-06", []), workout("before", "2026-09-29", []), workout("late", "2026-10-03", [])];
    const { current, previous } = periodComparison(workouts, [log("now", "a"), log("before", "a"), log("before", "b")], [], today, "week");
    assert.deepEqual([current.sessions, current.times], [1, 1]);
    assert.deepEqual([previous.sessions, previous.times], [1, 2]); // 3 Oct is a Saturday: outside Mon-Thu of last week
  });

  it("compares day, month and year with the same elapsed days of the previous period", () => {
    assert.deepEqual(periodRanges(today, "day"), { current: [today, today], previous: ["2026-10-08", "2026-10-08"] });
    assert.deepEqual(periodRanges(today, "month"), { current: ["2026-10-01", today], previous: ["2026-09-01", "2026-09-09"] });
    assert.deepEqual(periodRanges("2026-03-31", "month").previous, ["2026-02-01", "2026-02-28"]); // shorter month stops at its end
    assert.deepEqual(periodRanges(today, "year"), { current: ["2026-01-01", today], previous: ["2025-01-01", "2025-10-09"] });
  });

  it("counts groups training in parallel once per shift, like the calendar", () => {
    const sized = (id: string, meters: number) =>
      ({ ...workout(id, today, []), blocks: [{ id, type: "main", rounds: 1, segments: [{ reps: 1, distanceM: meters, intensity: "A1", details: [] }] }] }) as unknown as Workout;
    assert.equal(periodComparison([sized("fast", 4000), sized("long", 6000)], [], [], today, "day").current.meters, 6000);
  });

  it("counts attendance marks, late as present", () => {
    const session = (date: string, statuses: ("present" | "late" | "absent")[]) => ({
      id: date, date, groupName: "", createdAt: "", marks: statuses.map((status, i) => ({ athleteId: `a${i}`, status, volumeM: 0 })),
    });
    const { current, previous } = periodComparison([], [], [session("2026-10-09", ["present", "late", "absent"]), session("2026-10-08", ["present"])], today, "day");
    assert.deepEqual(current.attendance, { present: 2, marked: 3 });
    assert.deepEqual(previous.attendance, { present: 1, marked: 1 });
  });

  it("counts times entered since the previous session day", () => {
    const workouts = [workout("a", "2026-10-01", []), workout("b", "2026-10-07", [])];
    assert.deepEqual(sinceLastSession(workouts, [log("a", "x"), log("b", "x"), log("b", "y")], today), { since: "2026-10-07", times: 2 });
  });
});

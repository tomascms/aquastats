import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { periodComparison, periodRanges, sinceLastSession, whoNeedsAttention } from "./morning";
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

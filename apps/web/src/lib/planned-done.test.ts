import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { donePct, plannedVsDone } from "./planned-done";
import { normalizeSegment } from "./set";
import type { TimeLog, Workout } from "./types";

const block = (id: string, reps: number, distanceM: number, rounds = 1) => ({
  id, type: "main" as const, rounds, noSendOff: false, betweenRounds: null, segments: [normalizeSegment({ reps, distanceM, intensity: "A3" })],
});
const log = (blockId: string, repNumber: number, extra: Partial<TimeLog> = {}): TimeLog => ({
  id: `${blockId}-${repNumber}`, workoutId: "w", blockId, athleteId: "a", repNumber, mm: 1, ss: 10, cc: 0, splits: [], stroke: "free", pending: false, recordedAt: "", ...extra,
});

describe("planned vs done", () => {
  const workout: Workout = { id: "w", title: "w", date: "2026-10-09", shift: "morning", athleteIds: ["a"], blocks: [block("easy", 1, 400), block("main", 4, 100, 2)] };

  it("counts reps with a time or splits, once each; skipped and empty reps do not count", () => {
    const logs = [
      log("main", 1),
      log("main", 1), // duplicate rep
      log("main", 5), // second round
      log("main", 2, { skipped: true }),
      log("main", 3, { mm: 0, ss: 0, cc: 0 }),
      log("main", 4, { mm: 0, ss: 0, cc: 0, splits: [{ atM: 50, mm: 0, ss: 35, cc: 0 }] }),
      log("main", 6, { athleteId: "other" }),
    ];
    const result = plannedVsDone(workout, logs, "a");
    assert.deepEqual(result, { planned: 1200, done: 300 });
    assert.equal(donePct(result), 25);
    assert.equal(donePct({ planned: 0, done: 0 }), null);
  });
});

import { workoutMeters } from "./rankings";
import { flattenInner, splitRepNumber } from "./set";
import { hasClockTime } from "./swim-time";
import type { TimeLog, Workout } from "./types";

export type PlannedDone = { planned: number; done: number };

/**
 * Planned metres of a session (the whole set) and the metres an athlete has on record as done:
 * reps with a time or splits. Skipped reps and reps with nothing entered do not count.
 */
export function plannedVsDone(workout: Workout, timeLogs: TimeLog[], athleteId: string): PlannedDone {
  const seen = new Set<string>();
  let done = 0;
  for (const log of timeLogs) {
    if (log.workoutId !== workout.id || log.athleteId !== athleteId || log.skipped) continue;
    if (!hasClockTime(log.mm, log.ss, log.cc) && !log.splits?.length) continue;
    const key = `${log.blockId}:${log.repNumber}`;
    const block = workout.blocks.find((item) => item.id === log.blockId);
    if (!block || seen.has(key)) continue;
    const inners = flattenInner(block);
    const inner = inners[splitRepNumber(log.repNumber, inners.length).innerRep - 1];
    if (!inner) continue;
    seen.add(key);
    done += inner.distanceM;
  }
  return { planned: workoutMeters(workout), done };
}

/** Done as a share of planned, rounded; null when nothing was planned. */
export const donePct = ({ planned, done }: PlannedDone): number | null => (planned > 0 ? Math.round((done / planned) * 100) : null);

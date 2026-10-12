import { addDays, addMonths, weekStartMonday } from "./dates";
import { workoutMeters } from "./rankings";
import type { AttendanceSession, TimeLog, Workout } from "./types";

/*
 * The coach's morning view: what changed since the last session and how the period compares. Plain rules over the data already in the app (no model, no guesses):
 * every number shown here can be checked in the athlete's page.
 */

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export type Period = "day" | "week" | "month" | "year";
export type PeriodSummary = { sessions: number; meters: number; times: number; attendance: { present: number; marked: number } };

/** First day of the period that contains `today`, and the same span (same elapsed days) of the period before. */
export function periodRanges(today: string, period: Period): { current: [string, string]; previous: [string, string] } {
  if (period === "day") return { current: [today, today], previous: [addDays(today, -1), addDays(today, -1)] };
  const start = period === "week" ? weekStartMonday(today) : period === "month" ? `${today.slice(0, 8)}01` : `${today.slice(0, 4)}-01-01`;
  const previousStart = period === "week" ? addDays(start, -7) : period === "month" ? addMonths(start, -1) : addMonths(start, -12);
  const sameDay = period === "week" ? addDays(previousStart, daysBetween(start, today)) : addMonths(today, period === "month" ? -1 : -12);
  // A shorter previous month (31 March → "31 February") stops at its own last day.
  const lastBefore = addDays(start, -1);
  return { current: [start, today], previous: [previousStart, sameDay < lastBefore ? sameDay : lastBefore] };
}

/** The current period so far and the same days of the previous one, for a fair comparison. */
export function periodComparison(
  workouts: Workout[],
  timeLogs: TimeLog[],
  attendance: AttendanceSession[],
  today: string,
  period: Period,
): { current: PeriodSummary; previous: PeriodSummary } {
  const summary = ([from, to]: [string, string]): PeriodSummary => {
    const inRange = workouts.filter((workout) => workout.date >= from && workout.date <= to);
    const ids = new Set(inRange.map((workout) => workout.id));
    const marks = attendance.filter((session) => session.date >= from && session.date <= to).flatMap((session) => session.marks);
    return {
      sessions: inRange.length,
      meters: inRange.reduce((sum, workout) => sum + workoutMeters(workout), 0),
      times: timeLogs.filter((log) => ids.has(log.workoutId)).length,
      attendance: { present: marks.filter((mark) => mark.status !== "absent").length, marked: marks.length },
    };
  };
  const ranges = periodRanges(today, period);
  return { current: summary(ranges.current), previous: summary(ranges.previous) };
}

/** Times entered for sessions after the previous session day (what changed since the coach last looked). */
export function sinceLastSession(workouts: Workout[], timeLogs: TimeLog[], today: string): { since: string | null; times: number } {
  const earlier = workouts.map((workout) => workout.date).filter((date) => date < today).sort();
  const since = earlier.at(-1) ?? null;
  if (!since) return { since: null, times: 0 };
  const ids = new Set(workouts.filter((workout) => workout.date >= since && workout.date <= today).map((workout) => workout.id));
  return { since, times: timeLogs.filter((log) => ids.has(log.workoutId)).length };
}

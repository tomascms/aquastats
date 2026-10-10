import { addDays, weekStartMonday } from "./dates";
import { acwrBand, dailyLoadPerAthlete, ewmaAcwr } from "./ml/load-risk";
import { workoutMeters } from "./rankings";
import type { Athlete, TimeLog, Workout } from "./types";

/*
 * The coach's morning view: who needs attention today and why, with one suggested action each, and what
 * changed since the last session. Plain rules over the data already in the app (no model, no guesses):
 * every number shown here can be checked in the athlete's page.
 */

export type AttentionReason =
  | { kind: "load"; ratio: number; band: "acima" | "pico" }
  | { kind: "noTimes"; days: number | null }
  | { kind: "noWellness"; days: number }
  | { kind: "lowRecovery"; recovery: number };

export type Attention = { athlete: Athlete; reasons: AttentionReason[] };

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** Athletes with at least one reason, most reasons (and load peaks) first. */
export function whoNeedsAttention(athletes: Athlete[], workouts: Workout[], timeLogs: TimeLog[], today: string): Attention[] {
  const lastTime = new Map<string, string>();
  const workoutDate = new Map(workouts.map((workout) => [workout.id, workout.date]));
  for (const log of timeLogs) {
    const date = workoutDate.get(log.workoutId);
    if (date && date <= today && (lastTime.get(log.athleteId) ?? "") < date) lastTime.set(log.athleteId, date);
  }
  const out: Attention[] = [];
  for (const athlete of athletes.filter((item) => item.active !== false)) {
    const own = workouts.filter((workout) => workout.date <= today && workout.athleteIds.includes(athlete.id));
    const reasons: AttentionReason[] = [];
    const ratio = ewmaAcwr(dailyLoadPerAthlete(own), today).get(today)?.ratio ?? null;
    if (ratio !== null) {
      const band = acwrBand(ratio);
      if (band === "acima" || band === "pico") reasons.push({ kind: "load", ratio, band });
    }
    // Only athletes who trained in the last two weeks: someone away is not "missing data".
    if (own.some((workout) => daysBetween(workout.date, today) <= 14)) {
      const last = lastTime.get(athlete.id);
      const days = last ? daysBetween(last, today) : null;
      if (days === null || days > 14) reasons.push({ kind: "noTimes", days });
    }
    const wellness = [...(athlete.wellness ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    if (wellness.length) {
      const days = daysBetween(wellness[0].date, today);
      if (days > 7) reasons.push({ kind: "noWellness", days });
      else if (days <= 3 && wellness[0].recovery != null && wellness[0].recovery <= 2) {
        reasons.push({ kind: "lowRecovery", recovery: wellness[0].recovery });
      }
    }
    if (reasons.length) out.push({ athlete, reasons });
  }
  const weight = (item: Attention) => item.reasons.length * 10 + (item.reasons.some((r) => r.kind === "load" && r.band === "pico") ? 5 : 0);
  return out.sort((a, b) => weight(b) - weight(a) || a.athlete.name.localeCompare(b.athlete.name));
}

export type WeekSummary = { sessions: number; meters: number; times: number };

/** This week (Monday to today) and the same days of last week, for a fair comparison. */
export function weekComparison(workouts: Workout[], timeLogs: TimeLog[], today: string): { current: WeekSummary; previous: WeekSummary } {
  const start = weekStartMonday(today);
  const elapsed = daysBetween(start, today);
  const summary = (from: string, to: string): WeekSummary => {
    const inRange = workouts.filter((workout) => workout.date >= from && workout.date <= to);
    const ids = new Set(inRange.map((workout) => workout.id));
    return {
      sessions: inRange.length,
      meters: inRange.reduce((sum, workout) => sum + workoutMeters(workout), 0),
      times: timeLogs.filter((log) => ids.has(log.workoutId)).length,
    };
  };
  const previousStart = addDays(start, -7);
  return { current: summary(start, today), previous: summary(previousStart, addDays(previousStart, elapsed)) };
}

/** Times entered for sessions after the previous session day (what changed since the coach last looked). */
export function sinceLastSession(workouts: Workout[], timeLogs: TimeLog[], today: string): { since: string | null; times: number } {
  const earlier = workouts.map((workout) => workout.date).filter((date) => date < today).sort();
  const since = earlier.at(-1) ?? null;
  if (!since) return { since: null, times: 0 };
  const ids = new Set(workouts.filter((workout) => workout.date >= since && workout.date <= today).map((workout) => workout.id));
  return { since, times: timeLogs.filter((log) => ids.has(log.workoutId)).length };
}

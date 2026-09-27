import type { MessageKey } from "@/i18n";
import { raceSummary } from "./race-analysis";
import type { RaceRecord } from "./rankings";
import type { Goal, GoalMetric, RaceSession } from "./types";

/*
 * Goal progress is never typed by anyone: time goals read the athlete's results (official,
 * imported or entered) and technical goals read the race analyses from "Adicionar informação".
 */

export const METRIC_LABEL: Record<GoalMetric, MessageKey> = {
  reaction: "Reação",
  at15: "Aos 15 m",
  dps: "Distância por ciclo",
  sr: "Frequência média",
  underwater: "Subaquático",
};

export const METRIC_UNIT: Record<GoalMetric, string> = {
  reaction: "s",
  at15: "s",
  dps: "m",
  sr: "c/min",
  underwater: "m",
};

/** Whether a lower value is better for the metric. */
const LOWER_IS_BETTER: Record<GoalMetric, boolean> = {
  reaction: true,
  at15: true,
  dps: false,
  sr: false,
  underwater: false,
};

export type GoalProgress = {
  /** Best / latest value relevant to the goal. */
  current: number | null;
  /** First value on record since the goal (for the progress bar baseline). */
  baseline: number | null;
  /** 0–1 share of the way from baseline to target; 1 when reached. */
  ratio: number;
  reached: boolean;
  /** Signed distance to the target in the goal's unit (positive = still to go). */
  gap: number | null;
  lowerIsBetter: boolean;
};

function progressOf(values: { value: number; date: string }[], target: number, lowerIsBetter: boolean): GoalProgress {
  if (!values.length) return { current: null, baseline: null, ratio: 0, reached: false, gap: null, lowerIsBetter };
  const chronological = [...values].sort((a, b) => a.date.localeCompare(b.date));
  const best = lowerIsBetter ? Math.min(...values.map((v) => v.value)) : Math.max(...values.map((v) => v.value));
  const baseline = chronological[0].value;
  const reached = lowerIsBetter ? best <= target : best >= target;
  const span = lowerIsBetter ? baseline - target : target - baseline;
  const done = lowerIsBetter ? baseline - best : best - baseline;
  const ratio = reached ? 1 : span > 0 ? Math.max(0, Math.min(1, done / span)) : 0;
  const gap = lowerIsBetter ? best - target : target - best;
  return { current: best, baseline, ratio, reached, gap: Math.round(gap * 100) / 100, lowerIsBetter };
}

/** Official reaction times from imported results, so a reaction goal moves without any manual analysis. */
export type OfficialReaction = { athleteId: string; stroke: string; distanceM: number; value: number; date: string };

export function goalProgress(
  goal: Goal,
  records: RaceRecord[],
  sessions: RaceSession[],
  officialReactions: OfficialReaction[] = [],
): GoalProgress {
  if (goal.kind === "time" && goal.stroke && goal.distanceM && goal.targetValue) {
    const relevant = records.filter(
      (record) =>
        record.athleteId === goal.athleteId &&
        record.stroke === goal.stroke &&
        record.distanceM === goal.distanceM &&
        (!goal.course || record.course === goal.course),
    );
    return progressOf(relevant.map((record) => ({ value: record.timeS, date: record.date })), goal.targetValue, true);
  }
  if (goal.kind === "technical" && goal.metric && goal.targetValue != null) {
    const lower = LOWER_IS_BETTER[goal.metric];
    const values = sessions
      .filter(
        (session) =>
          session.athleteId === goal.athleteId &&
          (!goal.stroke || session.stroke === goal.stroke) &&
          (!goal.distanceM || session.distanceM === goal.distanceM),
      )
      .map((session) => ({ value: metricValue(session, goal.metric as GoalMetric), date: session.date }))
      .filter((item): item is { value: number; date: string } => item.value != null && item.value > 0);
    if (goal.metric === "reaction") {
      for (const item of officialReactions) {
        if (item.athleteId !== goal.athleteId) continue;
        if (goal.stroke && item.stroke !== goal.stroke) continue;
        if (goal.distanceM && item.distanceM !== goal.distanceM) continue;
        values.push({ value: item.value, date: item.date });
      }
    }
    return progressOf(values, goal.targetValue, lower);
  }
  return { current: null, baseline: null, ratio: goal.status === "achieved" ? 1 : 0, reached: goal.status === "achieved", gap: null, lowerIsBetter: true };
}

export function metricValue(session: RaceSession, metric: GoalMetric): number | null {
  const summary = raceSummary(session);
  switch (metric) {
    case "reaction":
      return summary.reactionS || null;
    case "at15":
      return summary.startS || null;
    case "dps":
      return summary.avgDps || null;
    case "sr":
      return summary.avgSr || null;
    case "underwater":
      return summary.underwater.length ? Math.max(...summary.underwater.map((item) => item.distanceM)) || null : null;
  }
}

export function isGoalReached(goal: Goal, progress: GoalProgress): boolean {
  return goal.status === "achieved" || progress.reached;
}

/** Goals relevant to one event of a meet (for the selection screen). */
export function goalsForEvent(goals: Goal[], athleteId: string, stroke: string, distanceM: number, course: string): Goal[] {
  return goals.filter(
    (goal) =>
      goal.athleteId === athleteId &&
      goal.status !== "dropped" &&
      goal.kind === "time" &&
      goal.stroke === stroke &&
      goal.distanceM === distanceM &&
      (!goal.course || goal.course === course),
  );
}

import { addDays, weekStartMonday } from "./dates";
import { trainingSignals, type Signal } from "./indicators";
import { planContext, workoutBands, type PhaseKind } from "./season";
import type { TrainingRep } from "./training-context";
import type { Competition, SeasonPlan, Workout } from "./types";

/*
 * The input of trainingSignals for one athlete, shared by the athlete page and "Hoje": weekly load over the last
 * 6 weeks (weeks without training count as 0), the plan phase and the next meet (an A meet of the plan or a team
 * competition the athlete is entered in).
 */
export function athleteSignals(input: {
  athleteId: string;
  reps: TrainingRep[];
  workouts: Workout[];
  competitions: Competition[];
  seasonPlans: SeasonPlan[];
  today: string;
}): { signals: Signal[]; phase: PhaseKind | null; daysToMeet: number | null } {
  const { athleteId, workouts, today } = input;
  const weeks = Array.from({ length: 6 }, (_, i) => weekStartMonday(addDays(today, -7 * (5 - i))));
  const weekly = new Map(weeks.map((week) => [week, 0]));
  for (const workout of workouts) {
    if (!workout.athleteIds.includes(athleteId) || workout.date > today) continue;
    const week = weekStartMonday(workout.date);
    if (weekly.has(week)) weekly.set(week, weekly.get(week)! + workoutBands(workout).load);
  }
  const context = planContext(input.seasonPlans, today);
  const phase = (context?.macro?.type as PhaseKind | undefined) ?? null;
  const meetDates = [
    ...input.competitions.filter((c) => c.athleteIds.includes(athleteId)).map((c) => c.date),
    ...input.seasonPlans.flatMap((plan) => plan.competitions.filter((c) => c.type === "A").map((c) => c.date)),
  ].filter((date) => date >= today);
  const next = meetDates.sort()[0];
  const daysToMeet = next ? Math.round((Date.parse(next) - Date.parse(today)) / 86_400_000) : null;
  // The current week is partial: compare the last complete week with the four before it.
  const loads = weeks.map((week) => weekly.get(week)!).slice(0, -1);
  const signals = trainingSignals({ reps: input.reps, weeklyLoad: loads, phase, daysToMeetA: daysToMeet, today });
  return { signals, phase, daysToMeet };
}

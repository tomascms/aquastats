import { addDays } from "../dates";
import { workoutBands } from "../season";
import type { Workout } from "../types";

/*
 * Load planning aids for the season view. Both are descriptive, and say so:
 *
 * Acute:chronic workload ratio with exponentially weighted moving averages (Williams et al. 2017):
 * acute λ = 2/(7+1), chronic λ = 2/(28+1). The claim that ACWR predicts injury is weak and disputed
 * (Impellizzeri et al. 2020); here it only shows how this week's load compares with the recent norm.
 *
 * Taper simulation with a fitness–fatigue model (Banister) using typical parameters (τ1 = 42 d,
 * τ2 = 7 d, k2/k1 = 2). Fitting them per athlete did not improve predictions in our backtest
 * (docs/ml/results/fase4-banister.md), so the output ranks taper options; it is not a time forecast.
 */

const DAY_MS = 86_400_000;
const dayOf = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** Average load per athlete per day, from the workouts entered (a parallel group session counts once per athlete). */
export function dailyLoadPerAthlete(workouts: Workout[]): Map<string, number> {
  const total = new Map<string, number>();
  const athletes = new Map<string, Set<string>>();
  for (const workout of workouts) {
    const load = workoutBands(workout).load;
    const people = Math.max(1, workout.athleteIds.length);
    total.set(workout.date, (total.get(workout.date) ?? 0) + load * people);
    const set = athletes.get(workout.date) ?? new Set<string>();
    for (const id of workout.athleteIds) set.add(id);
    athletes.set(workout.date, set);
  }
  const out = new Map<string, number>();
  for (const [date, value] of total) out.set(date, value / Math.max(1, athletes.get(date)?.size ?? 1));
  return out;
}

export type Acwr = { acute: number; chronic: number; ratio: number | null };

/** EWMA acute and chronic load for every day from the first entered day to `until`. */
export function ewmaAcwr(daily: Map<string, number>, until: string): Map<string, Acwr> {
  const out = new Map<string, Acwr>();
  const dates = [...daily.keys()].sort();
  if (!dates.length) return out;
  const acuteRate = 2 / (7 + 1);
  const chronicRate = 2 / (28 + 1);
  let acute = 0;
  let chronic = 0;
  let days = 0;
  for (let date = dates[0]; date <= until; date = addDays(date, 1)) {
    const load = daily.get(date) ?? 0;
    acute = acuteRate * load + (1 - acuteRate) * acute;
    chronic = chronicRate * load + (1 - chronicRate) * chronic;
    days += 1;
    // The chronic average means little in the first 4 weeks.
    out.set(date, { acute, chronic, ratio: days >= 28 && chronic > 0 ? acute / chronic : null });
  }
  return out;
}

export type AcwrBand = "abaixo" | "habitual" | "acima" | "pico";
export const acwrBand = (ratio: number): AcwrBand => (ratio < 0.8 ? "abaixo" : ratio <= 1.3 ? "habitual" : ratio <= 1.5 ? "acima" : "pico");

export type TaperOption = { weeks: number; dropPct: number; freshness: number };

/**
 * Freshness on race day (fitness − 2·fatigue, in units of the habitual load) for taper options,
 * assuming the habitual load of the last 4 weeks until the taper starts.
 */
export function taperOptions(daily: Map<string, number>, today: string, meetDate: string): TaperOption[] {
  const tau1 = 42;
  const tau2 = 7;
  let fitness = 0;
  let fatigue = 0;
  const dates = [...daily.keys()].filter((date) => date <= today).sort();
  if (!dates.length || meetDate <= today) return [];
  for (let date = dates[0]; date <= today; date = addDays(date, 1)) {
    const load = daily.get(date) ?? 0;
    fitness = fitness * Math.exp(-1 / tau1) + load;
    fatigue = fatigue * Math.exp(-1 / tau2) + load;
  }
  let recent = 0;
  for (let i = 0; i < 28; i += 1) recent += daily.get(addDays(today, -i)) ?? 0;
  const habitual = recent / 28;
  if (!(habitual > 0)) return [];
  const steady1 = habitual / (1 - Math.exp(-1 / tau1));
  const steady2 = habitual / (1 - Math.exp(-1 / tau2));
  const daysToMeet = dayOf(meetDate) - dayOf(today);
  const simulate = (weeks: number, drop: number) => {
    let f = fitness;
    let g = fatigue;
    for (let d = 1; d < daysToMeet; d += 1) {
      const inTaper = daysToMeet - d <= weeks * 7;
      const load = habitual * (inTaper ? 1 - drop : 1);
      f = f * Math.exp(-1 / tau1) + load;
      g = g * Math.exp(-1 / tau2) + load;
    }
    return f / steady1 - 2 * (g / steady2);
  };
  const out: TaperOption[] = [{ weeks: 0, dropPct: 0, freshness: simulate(0, 0) }];
  for (const weeks of [1, 2, 3]) for (const drop of [0.3, 0.45, 0.6]) if (weeks * 7 < daysToMeet) out.push({ weeks, dropPct: drop * 100, freshness: simulate(weeks, drop) });
  return out;
}

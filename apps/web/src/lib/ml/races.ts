import { dayNumber, HORIZONS, studentTQuantile, Z80, type RaceResult, type TeamData } from "./backtest";
import { raceRow, runStateModel } from "./forecaster";
import { developmentPerDay, type StateModelOptions } from "./state-model";

/*
 * Race times (protocol E13): what the athlete should swim in a race, from the training state.
 *
 * The state model already treats every race as an observation of the same engine (a maximal effort
 * from a dive, with a race factor learned from the team's earlier races). A race forecast is that
 * observation predicted ahead: the athlete's state at the end of the origin day, moved to the race
 * day with the training actually entered (so a taper counts through the return deficit and form),
 * plus the race factor. The interval is conformal on the team's earlier races (normalised by the
 * model's own uncertainty), with Student-t tails as for training reps; while fewer than
 * MIN_RACE_POOL races have been checked it stays wide.
 */

const MIN_RACE_POOL = 10;
const TAILS = 4;
export const RACE_NOMINAL = 0.8;

export type RacePrediction = { race: RaceResult; id: string; meanS: number; lo: number; hi: number; sd: number; df: number; logSd: number };

export const raceId = (race: RaceResult) => raceRow(race).log.id;

/** Every race of the team forecast `leadDays` ahead, with a calibrated 80 % interval. */
export function predictRaces(team: TeamData, options: StateModelOptions, leadDays: number): RacePrediction[] {
  const forecasts = runStateModel(team, HORIZONS.day, options, new Set(), { raceLeadDays: leadDays });
  const races = [...(team.races?.values() ?? [])].flat().sort((a, b) => a.date.localeCompare(b.date));
  const out: RacePrediction[] = [];
  // Normalised errors of races already swum; a forecast only uses those dated on or before its origin.
  const checked: { day: number; z: number }[] = [];
  const tail = studentTQuantile(0.9, TAILS);
  for (const race of races) {
    const day = dayNumber(race.date);
    const forecast = forecasts.get(raceId(race));
    if (!forecast) continue;
    const usable = checked.filter((item) => item.day <= day - leadDays).map((item) => item.z).sort((x, y) => x - y);
    const quantile = usable.length >= MIN_RACE_POOL ? usable[Math.min(usable.length - 1, Math.floor(RACE_NOMINAL * usable.length))] : Z80 * 1.5;
    const half = Math.max(0.004, quantile * forecast.logSd);
    out.push({
      race,
      id: raceId(race),
      meanS: forecast.meanS,
      lo: forecast.meanS * Math.exp(-half),
      hi: forecast.meanS * Math.exp(half),
      sd: (forecast.meanS * half) / tail,
      df: TAILS,
      logSd: forecast.logSd,
    });
    checked.push({ day, z: Math.abs(Math.log(race.timeS / forecast.meanS)) / forecast.logSd });
  }
  return out;
}

/** Reference: the athlete's best earlier time in the same event (before the origin), moved by the development expected for the age. */
export function referenceRaceTime(team: TeamData, race: RaceResult, leadDays: number, kind: "best" | "last" = "best"): number | null {
  const origin = dayNumber(race.date) - leadDays;
  const earlier = (team.races?.get(race.athleteId) ?? []).filter(
    (other) => other.distanceM === race.distanceM && other.stroke === race.stroke && other.course === race.course && dayNumber(other.date) <= origin,
  );
  if (!earlier.length) return null;
  const chosen = kind === "best" ? earlier.reduce((best, other) => (other.timeS < best.timeS ? other : best)) : earlier[earlier.length - 1];
  const meta = team.athletes.get(race.athleteId) ?? { id: race.athleteId };
  return chosen.timeS * Math.exp(developmentPerDay(meta, dayNumber(chosen.date)) * (dayNumber(race.date) - dayNumber(chosen.date)));
}

import type { TrainingRep } from "../training-context";
import { Z80 } from "./backtest";
import type { Outcome } from "./ledger";
import type { Suspect } from "./quality";

/*
 * Why a prediction missed — and what the model does about it.
 *
 * Every miss (real time outside the 80 % interval) gets the first cause that fits, in this order:
 *   dado-errado      the real time looks like a typing error      → not learned from (quality filter)
 *   dado-em-falta    first time of this kind of rep, or long gap  → learned, with the uncertainty it had
 *   regresso         still recovering from a break               → the return deficit is re-estimated
 *   dia-anormal      the whole day was off in the same direction  → absorbed by the day effect, level kept
 *   vies-atleta      this athlete's errors keep the same sign     → regime detector speeds learning up
 *   mal-calibrado    recent intervals miss far more than 20 %     → conformal widens the intervals
 *   contexto         morning / 2nd session / short sleep, slower  → noted (context did not pass the backtest)
 *   sem-causa-clara  none of the above: an ordinary bad (or good) rep
 * Each "→" is a mechanism the model already has; the cause names which one handled the miss.
 */

export type Cause = "dado-errado" | "dado-em-falta" | "regresso" | "dia-anormal" | "vies-atleta" | "mal-calibrado" | "contexto" | "sem-causa-clara";

export type AttributionInput = {
  outcome: Outcome;
  row?: TrainingRep;
  suspect?: Suspect;
  /** The prediction was for a kind of rep the athlete had never been timed in. */
  newKind?: boolean;
  /** Return-deficit contribution of the forecast, in %. */
  returnPct?: number;
  /** Days since the athlete's previous timed rep. */
  daysSinceLast?: number;
};

export type Attribution = { cause: Cause; miss: boolean; z: number };

const zOf = (outcome: Outcome) => {
  const sd = outcome.sdS ?? (outcome.hiS != null && outcome.loS != null ? (outcome.hiS - outcome.loS) / (2 * Z80) : null);
  return sd ? (outcome.actualS - outcome.meanS) / sd : 0;
};

export function attribute(inputs: AttributionInput[]): Map<string, Attribution> {
  const sorted = [...inputs].sort((a, b) => a.outcome.date.localeCompare(b.outcome.date));
  const byAthleteDay = new Map<string, AttributionInput[]>();
  for (const input of sorted) {
    const key = `${input.outcome.athleteId}|${input.outcome.date}`;
    byAthleteDay.set(key, [...(byAthleteDay.get(key) ?? []), input]);
  }
  const history = new Map<string, { z: number; miss: boolean }[]>();
  const out = new Map<string, Attribution>();
  for (const input of sorted) {
    const { outcome } = input;
    const z = zOf(outcome);
    const miss = outcome.inside != null ? !outcome.inside : Math.abs(z) > Z80;
    const past = history.get(outcome.athleteId) ?? [];
    let cause: Cause = "sem-causa-clara";
    if (input.suspect) cause = "dado-errado";
    else if (!miss) cause = "sem-causa-clara";
    else if (input.newKind || (input.daysSinceLast ?? 0) > 21) cause = "dado-em-falta";
    else if ((input.returnPct ?? 0) >= 0.5) cause = "regresso";
    else {
      const day = byAthleteDay.get(`${outcome.athleteId}|${outcome.date}`) ?? [];
      const sameWay = day.filter((other) => Math.sign(zOf(other.outcome)) === Math.sign(z) && Math.abs(zOf(other.outcome)) > 1).length;
      const recent = past.slice(-30);
      const meanZ = recent.length ? recent.reduce((sum, item) => sum + item.z, 0) / recent.length : 0;
      const sdZ = recent.length > 1 ? Math.sqrt(recent.reduce((sum, item) => sum + (item.z - meanZ) ** 2, 0) / (recent.length - 1)) : 1;
      const lastCoverage = past.length >= 50 ? 1 - past.slice(-50).filter((item) => item.miss).length / 50 : null;
      const row = input.row;
      if (day.length >= 3 && sameWay >= 0.75 * day.length) cause = "dia-anormal";
      else if (recent.length >= 15 && Math.sign(meanZ) === Math.sign(z) && Math.abs(meanZ) / (sdZ / Math.sqrt(recent.length)) > 2 && Math.abs(meanZ) > 0.4) cause = "vies-atleta";
      else if (lastCoverage != null && lastCoverage < 0.65) cause = "mal-calibrado";
      else if (row && z > 0 && (row.shift === "morning" || row.trainedEarlierToday || (row.sleepHours != null && row.sleepHours < 7))) cause = "contexto";
    }
    out.set(outcome.id, { cause, miss, z });
    if (!input.suspect) history.set(outcome.athleteId, [...past, { z, miss }]);
  }
  return out;
}

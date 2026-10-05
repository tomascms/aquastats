import { isPlausibleRep } from "../training-context";
import { dayNumber, lastUsableDay, type Horizon, type Prediction, type Predictor, type TeamData } from "./backtest";
import { teamSuspects } from "./quality";

/*
 * Online ensemble: combines several predictors with weights that learn from their checked errors
 * (exponentially weighted forecasters / Hedge, with forgetting so the weights follow changes).
 *
 * Every member's checked error moves the weights: w_k ∝ exp(−η · discounted absolute log-error).
 * Weights are per athlete once that athlete has enough checked predictions, the team's before.
 * A member that cannot predict a rep (cold start) simply drops out of that combination.
 * Causal: a combination issued for a rep uses only errors whose outcome is dated on or before the
 * last day its horizon allows. Suspect times never count as errors.
 */

const FORGET = 0.995;
const MIN_ATHLETE = 50;

type Event = { time: number; kind: "observe" | "issue"; id: string; athleteId: string; actual: number };

/** `eta`: how sharply the weights favour the member with the smaller discounted error (tuned on the tuning seeds). */
export function ensemble(members: Predictor[], name: string, eta = 5): Predictor {
  return {
    name,
    description: `Combinação online de ${members.map((member) => member.name).join(", ")} com pesos que aprendem com os erros verificados.`,
    predict(team: TeamData, horizon: Horizon) {
      const outputs = members.map((member) => member.predict(team, horizon));
      const suspects = teamSuspects(team.rows, { withinDayCausal: horizon.kind === "rep" });
      const events: Event[] = [];
      for (const [athleteId, rows] of team.rows) {
        for (const row of rows) {
          if (!isPlausibleRep(row)) continue;
          const id = row.log.id;
          if (outputs.some((output) => output.has(id))) events.push({ time: lastUsableDay(row, horizon, team.anchorDay) + 0.5, kind: "issue", id, athleteId, actual: row.timeS });
          if (!suspects.has(id)) events.push({ time: dayNumber(row.date) + 0.9, kind: "observe", id, athleteId, actual: row.timeS });
        }
      }
      events.sort((a, b) => a.time - b.time || (a.kind === b.kind ? 0 : a.kind === "observe" ? -1 : 1));

      const teamLoss = new Float64Array(members.length);
      const athleteLoss = new Map<string, { loss: Float64Array; n: number }>();
      const out = new Map<string, Prediction>();
      for (const event of events) {
        if (event.kind === "observe") {
          const preds = outputs.map((output) => output.get(event.id));
          if (preds.some((p) => !p)) continue; // only rounds where every member played compare them fairly
          const own = athleteLoss.get(event.athleteId) ?? { loss: new Float64Array(members.length), n: 0 };
          for (let k = 0; k < members.length; k += 1) {
            const loss = Math.abs(Math.log(event.actual / preds[k]!.mean));
            teamLoss[k] = FORGET * teamLoss[k] + loss;
            own.loss[k] = FORGET * own.loss[k] + loss;
          }
          own.n += 1;
          athleteLoss.set(event.athleteId, own);
          continue;
        }
        const own = athleteLoss.get(event.athleteId);
        const losses = own && own.n >= MIN_ATHLETE ? own.loss : teamLoss;
        const available = outputs.map((output, k) => ({ k, p: output.get(event.id) })).filter((item): item is { k: number; p: Prediction } => Boolean(item.p));
        const best = Math.min(...available.map((item) => losses[item.k]));
        const weights = available.map((item) => Math.exp(-eta * (losses[item.k] - best)));
        const total = weights.reduce((sum, w) => sum + w, 0);
        let logMean = 0;
        let sdSq = 0;
        available.forEach((item, i) => {
          const w = weights[i] / total;
          logMean += w * Math.log(item.p.mean);
          if (item.p.sd) sdSq += w * (item.p.sd / item.p.mean) ** 2;
        });
        const mean = Math.exp(logMean);
        out.set(event.id, { mean, sd: sdSq > 0 ? mean * Math.sqrt(sdSq) : undefined });
      }
      return out;
    },
  };
}

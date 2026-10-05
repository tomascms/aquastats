import { isPlausibleRep, type TrainingRep } from "../training-context";
import { groupKey } from "../training-prediction";
import { dayNumber, isPlanned, lastUsableDay, studentTQuantile, Z80, type Horizon, type Prediction, type Predictor, type TeamData } from "./backtest";
import { teamSuspects } from "./quality";

/*
 * Honest intervals from real out-of-sample errors (adaptive conformal prediction).
 *
 * A model's own spread is an in-sample number; what the coach needs is "how far off were
 * predictions like this one, when we could check them". So every interval is built from the
 * relative errors of earlier predictions whose outcome was already known when this prediction was
 * made:
 *   1. stratum = how much history the rep's group had (0, 1–3, 4–15, 16+ earlier reps): less data,
 *      wider interval — this is where the confidence label comes from;
 *   2. the stratum's recent errors across the team give the 80 % quantile (recency-weighted, so
 *      the band follows the season);
 *   3. each athlete's own multiplier adapts online (adaptive conformal inference, Gibbs & Candès
 *      2021): every miss widens, every hit narrows a little, so coverage stays near 80 % over time
 *      even when the athlete changes — separately for brand-new kinds of rep and for known ones.
 * Suspect times never enter the error pool. Until a stratum has enough checked errors the
 * interval falls back to a wide, honest prior (it says "a aprender").
 */

export const NOMINAL = 0.8;
const ALPHA = 1 - NOMINAL;
const RECENCY_HALF_LIFE = 60;
const POOL_LIMIT = 600;
const MIN_POOL = 30;
/** Log-step per checked outcome: a miss widens by ~1.6 %, a hit narrows by ~0.4 % (equilibrium at 20 % misses). */
const ACI_RATE = 0.02;
/** Relative half-width (80 %) used while a stratum has fewer than MIN_POOL checked errors. */
const PRIOR_HALF_WIDTH = [0.06, 0.035, 0.025, 0.02];

export type Stratum = 0 | 1 | 2 | 3;
export const stratumOf = (groupHistory: number): Stratum => (groupHistory === 0 ? 0 : groupHistory <= 3 ? 1 : groupHistory <= 15 ? 2 : 3);

export type Confidence = "alta" | "média" | "baixa";
/** Confidence from the calibrated interval itself: how wide real past errors say it must be. */
export const confidenceOf = (relHalfWidth: number): Confidence => (relHalfWidth <= 0.02 ? "alta" : relHalfWidth <= 0.035 ? "média" : "baixa");

type Residual = { day: number; abs: number };

/** Each athlete adapts separately for brand-new kinds of rep and for kinds already seen: misses on one must not widen the other. */
const adaptiveKey = (athleteId: string, stratum: Stratum) => `${athleteId}|${stratum === 0 ? "new" : "seen"}`;

function weightedQuantile(pool: Residual[], level: number, today: number): number {
  const items = pool.map((item) => ({ v: item.abs, w: Math.pow(0.5, (today - item.day) / RECENCY_HALF_LIFE) })).sort((a, b) => a.v - b.v);
  const total = items.reduce((sum, item) => sum + item.w, 0);
  let acc = 0;
  for (const item of items) {
    acc += item.w;
    if (acc >= level * total) return item.v;
  }
  return items[items.length - 1].v;
}

type Event = { time: number; kind: "observe" | "issue"; row: TrainingRep; athleteId: string };

/**
 * Wraps any predictor: keeps its point forecast, replaces its interval with a calibrated one.
 * Causal: an interval issued for a rep uses only outcomes dated on or before the last day that
 * rep's horizon allows, and the base predictor's own (causal) predictions for those outcomes.
 */
export type CalibrationOptions = {
  /** "model": errors are measured in units of the model's own uncertainty (normalised conformal). */
  scale?: "relative" | "model";
  /** E6: heavy tails — the predictive distribution is a Student-t with these degrees of freedom (same 80 % interval). */
  tails?: number;
  /** E7: errors also pooled by the athlete's maturity (weeks of data: < 2, 2–8, 8+), so new athletes get their own width. */
  byMaturity?: boolean;
};

/** Weeks since the athlete's first timed rep: 0 = under 2, 1 = 2 to 8, 2 = 8 or more. */
const maturityBand = (weeks: number) => (weeks < 2 ? 0 : weeks < 8 ? 1 : 2);

export function calibrated(base: Predictor, name = `${base.name} + conformal`, options: CalibrationOptions = {}): Predictor {
  const normalised = options.scale === "model";
  /** Relative uncertainty the model claims for a prediction (1 when errors are measured as plain %). */
  const unit = (prediction: Prediction) => (normalised && prediction.sd ? prediction.sd / prediction.mean : 1);
  return {
    name,
    description: `${base.description} Intervalo a 80 % a partir dos erros reais anteriores (conformal adaptativo, por quantidade de dados).`,
    predict(team: TeamData, horizon: Horizon) {
      const point = base.predict(team, horizon);
      const suspects = teamSuspects(team.rows, { withinDayCausal: horizon.kind === "rep" });
      const events: Event[] = [];
      const history = new Map<string, number>();
      const maturity = new Map<string, number>();
      for (const [athleteId, rows] of team.rows) {
        const counts = new Map<string, number>();
        let firstDay: number | null = null;
        let pending: TrainingRep[] = [];
        let currentDate = "";
        for (const row of rows.filter((item) => isPlausibleRep(item) || isPlanned(item))) {
          if (row.date !== currentDate) {
            for (const done of pending) counts.set(groupKey(done), (counts.get(groupKey(done)) ?? 0) + 1);
            pending = [];
            currentDate = row.date;
          }
          history.set(row.log.id, counts.get(groupKey(row)) ?? 0);
          maturity.set(row.log.id, firstDay == null ? 0 : maturityBand((dayNumber(row.date) - firstDay) / 7));
          if (firstDay == null && !isPlanned(row)) firstDay = dayNumber(row.date);
          if (point.has(row.log.id)) events.push({ time: lastUsableDay(row, horizon, team.anchorDay) + 0.5, kind: "issue", row, athleteId });
          if (isPlanned(row)) continue;
          pending.push(row);
          if (!suspects.has(row.log.id)) events.push({ time: dayNumber(row.date) + 0.9, kind: "observe", row, athleteId });
        }
      }
      events.sort((a, b) => a.time - b.time || (a.kind === b.kind ? 0 : a.kind === "observe" ? -1 : 1));

      const pools: Residual[][] = [[], [], [], []];
      const bandPools: Residual[][][] = [0, 1, 2, 3].map(() => [[], [], []]);
      const multiplier = new Map<string, number>();
      const issued = new Map<string, number>();
      const quantileCache = new Map<string, number>();
      const out = new Map<string, Prediction>();
      for (const event of events) {
        const id = event.row.log.id;
        const stratum = stratumOf(history.get(id) ?? 0);
        if (event.kind === "observe") {
          const prediction = point.get(id);
          if (!prediction) continue;
          const abs = Math.abs(event.row.timeS / prediction.mean - 1) / unit(prediction);
          const pool = pools[stratum];
          pool.push({ day: Math.floor(event.time), abs });
          if (pool.length > POOL_LIMIT) pool.shift();
          if (options.byMaturity) {
            const bandPool = bandPools[stratum][maturity.get(id) ?? 0];
            bandPool.push({ day: Math.floor(event.time), abs });
            if (bandPool.length > POOL_LIMIT) bandPool.shift();
          }
          quantileCache.clear();
          const width = issued.get(id);
          if (width != null) {
            const miss = abs > width ? 1 : 0;
            const key = adaptiveKey(event.athleteId, stratum);
            const m = multiplier.get(key) ?? 1;
            multiplier.set(key, Math.min(3, Math.max(0.5, m * Math.exp(ACI_RATE * (miss - ALPHA)))));
          }
          continue;
        }
        const prediction = point.get(id)!;
        const today = Math.floor(event.time);
        let pooled = Number.NaN;
        if (options.byMaturity) {
          const band = maturity.get(id) ?? 0;
          const bandPool = bandPools[stratum][band];
          if (bandPool.length >= MIN_POOL) {
            const key = `${stratum}|${band}#${today}`;
            if (!quantileCache.has(key)) quantileCache.set(key, weightedQuantile(bandPool, NOMINAL, today));
            pooled = quantileCache.get(key)!;
          }
        }
        // Fall back to the next stratum with more data when this one has too few checked errors.
        for (let s = stratum; s >= 0 && !Number.isFinite(pooled); s -= 1) {
          if (pools[s].length < MIN_POOL) continue;
          const key = `${s}#${today}`;
          if (!quantileCache.has(key)) quantileCache.set(key, weightedQuantile(pools[s], NOMINAL, today));
          pooled = quantileCache.get(key)! * (s === stratum ? 1 : 1 + 0.25 * (stratum - s));
        }
        const scaleUnit = unit(prediction);
        const quantile = Number.isFinite(pooled) ? pooled * scaleUnit : normalised && prediction.sd ? Z80 * scaleUnit * 1.5 : PRIOR_HALF_WIDTH[stratum];
        const half = Math.max(quantile, 0.004) * (multiplier.get(adaptiveKey(event.athleteId, stratum)) ?? 1);
        issued.set(id, half / scaleUnit);
        out.set(id, {
          ...prediction,
          mean: prediction.mean,
          lo: prediction.mean * (1 - half),
          hi: prediction.mean * (1 + half),
          nominal: NOMINAL,
          sd: (prediction.mean * half) / (options.tails ? studentTQuantile(0.9, options.tails) : Z80),
          df: options.tails,
          confidence: confidenceOf(half),
        });
      }
      return out;
    },
  };
}

import { isPlausibleRep, type TrainingRep } from "../training-context";
import { groupKey } from "../training-prediction";
import { dayNumber, lastUsableDay, Z80, type Horizon, type Prediction, type Predictor, type TeamData } from "./backtest";
import { runStateModel } from "./forecaster";
import { legacyPredict } from "./legacy-baseline";
import { teamSuspects } from "./quality";
import { DEFAULT_OPTIONS, type StateModelOptions } from "./state-model";

/** The model in production (training-prediction.ts), per athlete and pool as the dashboard runs it. */
export const baselinePredictor: Predictor = {
  name: "modelo atual",
  description: "Mediana ponderada por recência no grupo + ridge sobre o desvio relativo; banda ±1 DP residual.",
  predict(team: TeamData, horizon: Horizon) {
    const out = new Map<string, Prediction>();
    for (const [id, target] of legacyPredict(team, horizon)) {
      out.set(id, { mean: target.mean, lo: target.lo, hi: target.hi, nominal: target.nominal, sd: target.sd, confidence: target.confidence });
    }
    return out;
  },
};

/** Reference: the current model's group level alone (recency-weighted median), without the ridge. */
export const levelOnlyPredictor: Predictor = {
  name: "mediana",
  description: "Só a mediana ponderada por recência das reps anteriores do mesmo grupo (sem ajuste de contexto).",
  predict(team: TeamData, horizon: Horizon) {
    const out = new Map<string, Prediction>();
    for (const [id, target] of legacyPredict(team, horizon)) {
      const sd = target.sd!;
      out.set(id, { mean: target.levelS, lo: target.levelS - sd, hi: target.levelS + sd, nominal: target.nominal, sd });
    }
    return out;
  },
};

/**
 * Reference: repeat the last value of the same group. "rep": the previous rep of the group, the
 * same day included; otherwise the median of the latest usable day with reps of that group.
 */
export const lastValuePredictor: Predictor = {
  name: "último valor",
  description: "Referência ingénua: o último valor do mesmo grupo disponível no horizonte.",
  predict(team: TeamData, horizon: Horizon) {
    const out = new Map<string, Prediction>();
    for (const rows of team.rows.values()) {
      const valid = rows.filter(isPlausibleRep);
      const byGroup = new Map<string, TrainingRep[]>();
      for (const row of valid) byGroup.set(groupKey(row), [...(byGroup.get(groupKey(row)) ?? []), row]);
      for (const list of byGroup.values()) {
        list.forEach((row, index) => {
          if (horizon.kind === "rep") {
            if (index > 0) out.set(row.log.id, { mean: list[index - 1].timeS });
            return;
          }
          const last = lastUsableDay(row, horizon, team.anchorDay);
          let j = index - 1;
          while (j >= 0 && dayNumber(list[j].date) > last) j -= 1;
          if (j < 0) return;
          const day = list[j].date;
          const times: number[] = [];
          for (let k = j; k >= 0 && list[k].date === day; k -= 1) times.push(list[k].timeS);
          times.sort((a, b) => a - b);
          out.set(row.log.id, { mean: times[Math.floor(times.length / 2)] });
        });
      }
    }
    return out;
  },
};

export const REFERENCE_PREDICTORS: Predictor[] = [lastValuePredictor, levelOnlyPredictor, baselinePredictor];

/** Suspect times for a horizon: for next-rep predictions only the earlier reps of a set may be used. */
export function suspectsFor(team: TeamData, horizon: Horizon) {
  return teamSuspects(team.rows, { withinDayCausal: horizon.kind === "rep" });
}

/** Phase 1 candidate: the production model, learning only from times that are not suspect. */
export const qualityBaselinePredictor: Predictor = {
  name: "modelo atual + qualidade",
  description: "Modelo atual, mas os tempos suspeitos (erros de digitação prováveis) não entram no que ele aprende.",
  predict(team: TeamData, horizon: Horizon) {
    const excluded = new Set(suspectsFor(team, horizon).keys());
    const out = new Map<string, Prediction>();
    for (const [id, target] of legacyPredict(team, horizon, excluded)) {
      out.set(id, { mean: target.mean, lo: target.lo, hi: target.hi, nominal: target.nominal, sd: target.sd, confidence: target.confidence });
    }
    return out;
  },
};

/** Phase 2 candidate: the hierarchical state-space model, learning only from times that are not suspect. */
export function stateModelPredictor(options: StateModelOptions = DEFAULT_OPTIONS, name = "modelo de estado"): Predictor {
  return {
    name,
    description: "Modelo de espaço de estados: parâmetros fisiológicos por atleta com shrinkage para a equipa, forma multi-escala (sessão, dia, nível, défice de regresso) e filtro de Kalman robusto.",
    predict(team: TeamData, horizon: Horizon) {
      const excluded = new Set(suspectsFor(team, horizon).keys());
      const out = new Map<string, Prediction>();
      for (const [id, forecast] of runStateModel(team, horizon, options, excluded)) {
        out.set(id, {
          mean: forecast.meanS,
          lo: Math.exp(forecast.logMean - Z80 * forecast.logSd),
          hi: Math.exp(forecast.logMean + Z80 * forecast.logSd),
          nominal: 0.8,
          sd: forecast.meanS * forecast.logSd,
        });
      }
      return out;
    },
  };
}

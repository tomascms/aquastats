import { isPlausibleRep, type TrainingRep } from "../training-context";
import { groupKey } from "../training-prediction";
import { dayNumber, HORIZONS, isPlanned, lastUsableDay, originOf, Z80, type Horizon, type LeadHorizon, type Prediction, type Predictor, type TeamData } from "./backtest";
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
          pBreakBy: forecast.pBreakBy,
        });
      }
      return out;
    },
  };
}

/**
 * Reference for "should do": the frontier of the athlete's own recent reps — the recency-weighted
 * 20 % quantile of the same kind of rep over the last 8 weeks (protocol v3). "Will do" = the
 * recency-weighted median of the same window.
 */
export const frontierPredictor: Predictor = {
  name: "fronteira (q20)",
  description: "Quantil 20 % (ponderado pela recência) das reps do mesmo grupo nas últimas 8 semanas.",
  predict(team: TeamData, horizon: Horizon) {
    const out = new Map<string, Prediction>();
    const weightedQuantile = (items: { v: number; w: number }[], q: number) => {
      const sorted = [...items].sort((a, b) => a.v - b.v);
      const total = sorted.reduce((sum, item) => sum + item.w, 0);
      let acc = 0;
      for (const item of sorted) {
        acc += item.w;
        if (acc >= q * total) return item.v;
      }
      return sorted[sorted.length - 1].v;
    };
    for (const rows of team.rows.values()) {
      const valid = rows.filter(isPlausibleRep);
      const byGroup = new Map<string, TrainingRep[]>();
      for (const row of valid) byGroup.set(groupKey(row), [...(byGroup.get(groupKey(row)) ?? []), row]);
      for (const list of byGroup.values()) {
        for (const row of list) {
          const last = lastUsableDay(row, horizon, team.anchorDay);
          const window = list.filter((item) => dayNumber(item.date) <= last && last - dayNumber(item.date) < 56);
          if (window.length < 3) continue;
          const weighted = window.map((item) => ({ v: item.timeS, w: Math.pow(0.5, (last - dayNumber(item.date)) / 28) }));
          const q20 = weightedQuantile(weighted, 0.2);
          const median = weightedQuantile(weighted, 0.5);
          const logs = window.map((item) => Math.log(item.timeS / median));
          const mad = [...logs.map(Math.abs)].sort((a, b) => a - b)[Math.floor(logs.length / 2)];
          const rel = Math.max(0.005, 1.4826 * mad);
          out.set(row.log.id, {
            mean: median,
            sd: median * rel,
            capacity: { mean: q20, lo: q20 * (1 - Z80 * rel), hi: q20 * (1 + Z80 * rel), sd: q20 * rel },
          });
        }
      }
    }
    return out;
  },
};

/**
 * Per-athlete version of a component (protocol v3, R7): `component` replaces `base` for an athlete
 * only once that athlete's own evidence says it helps — the mean per-day difference in absolute %
 * error (component − base, day horizon, times not suspect) has its 90 % interval below zero, over at
 * least `minDays` days. The evidence only uses days already swum at the forecast's origin (the day
 * before for the rep/day horizons, the origin itself for the lead horizons). The break probability
 * always comes from the component (it is judged separately, R8).
 */
export function perAthleteGate(base: Predictor, component: Predictor, name: string, { z = 1.645, minDays = 5 } = {}): Predictor {
  return {
    name,
    description: `${component.name}, só nos atletas em que já provou ganhar (IC 90 % do ganho < 0); nos outros, ${base.name}.`,
    predict(team: TeamData, horizon: Horizon) {
      const a = base.predict(team, horizon);
      const b = component.predict(team, horizon);
      const evidenceA = horizon.kind === "day" ? a : base.predict(team, HORIZONS.day);
      const evidenceB = horizon.kind === "day" ? b : component.predict(team, HORIZONS.day);
      const suspects = suspectsFor(team, HORIZONS.day);
      const out = new Map<string, Prediction>();
      for (const rows of team.rows.values()) {
        // Per day: the mean difference in absolute % error, then running sums over the days in order.
        const byDay = new Map<number, number[]>();
        for (const row of rows) {
          if (!isPlausibleRep(row) || isPlanned(row) || suspects.has(row.log.id)) continue;
          const pa = evidenceA.get(row.log.id);
          const pb = evidenceB.get(row.log.id);
          if (!pa || !pb) continue;
          const day = dayNumber(row.date);
          byDay.set(day, [...(byDay.get(day) ?? []), (Math.abs(pb.mean - row.timeS) - Math.abs(pa.mean - row.timeS)) / row.timeS]);
        }
        const days = [...byDay.keys()].sort((x, y) => x - y);
        const cumulative: { day: number; n: number; sum: number; sumSq: number }[] = [];
        let n = 0;
        let sum = 0;
        let sumSq = 0;
        for (const day of days) {
          const list = byDay.get(day)!;
          const mean = list.reduce((total, value) => total + value, 0) / list.length;
          n += 1;
          sum += mean;
          sumSq += mean * mean;
          cumulative.push({ day, n, sum, sumSq });
        }
        const helpsBy = (origin: number) => {
          let lo = 0;
          let hi = cumulative.length - 1;
          let found = -1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (cumulative[mid].day <= origin) {
              found = mid;
              lo = mid + 1;
            } else hi = mid - 1;
          }
          if (found < 0 || cumulative[found].n < minDays) return false;
          const { n: count, sum: total, sumSq: totalSq } = cumulative[found];
          const mean = total / count;
          const sd = Math.sqrt(Math.max(0, (totalSq - count * mean * mean) / (count - 1)));
          return mean + (z * sd) / Math.sqrt(count) < 0;
        };
        for (const row of rows) {
          const pa = a.get(row.log.id);
          const pb = b.get(row.log.id);
          if (!pa && !pb) continue;
          const origin = horizon.kind === "lead" ? originOf(row.date, horizon as LeadHorizon, team.anchorDay) : dayNumber(row.date) - 1;
          const chosen = pb && (helpsBy(origin) || !pa) ? pb : pa!;
          out.set(row.log.id, { ...chosen, pBreakBy: pb?.pBreakBy });
        }
      }
      return out;
    },
  };
}

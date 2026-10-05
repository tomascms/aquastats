/*
 * Individual fatigue inside a set, with a cliff (protocol v3).
 *
 * Critical-speed / W′ model, per athlete: a rep swum faster than critical speed (CS) spends anaerobic
 * reserve W′; the rest between reps gives it back exponentially (time constant τ); the reserve
 * available for a set shrinks with the volume already swum in the session (fraction σ per 4 km).
 * When a rep needs more W′ than is left, the rest of it can only be swum at CS: the rep falls off
 * the curve — the set "breaks". This is non-linear and individual, so it is not a regression term:
 *
 *   - each athlete has a posterior over a grid of (W′, τ, σ) — 7 × 6 × 4 profiles;
 *   - a set is simulated under every profile: intended times come from the state model (what form
 *     allows in those conditions without in-set fatigue), rests from the planned send-off;
 *   - the posterior learns only from the SHAPE of a set (each profile's predicted slowdowns vs the
 *     observed ones, after removing the set's common level), so the level teaches capacity and the
 *     shape teaches fatigue — each answer updates the parameter it is about;
 *   - a set whose last planned reps are missing right after a slow rep counts as censored: the
 *     swimmer may have stopped (P(break by then) under each profile), or nobody timed the rest;
 *   - the posterior drifts a little every day, at a different speed per dimension (W′ adapts in
 *     weeks, recovery more slowly, volume sensitivity slowest), so improving in one does not move
 *     the others.
 * Monotonic by construction: more rest or fewer reps never make a set harder; more distance or a
 * shorter send-off never make it easier.
 */

export const W_GRID = [6, 9, 13, 18, 25, 35, 48];
export const TAU_GRID = [25, 40, 65, 100, 160, 250];
export const VOL_GRID = [0.03, 0.12, 0.22, 0.35];
const NW = W_GRID.length;
const NT = TAU_GRID.length;
const NV = VOL_GRID.length;
export const CELLS = NW * NT * NV;

const cellIndex = (w: number, t: number, v: number) => (w * NT + t) * NV + v;

/** A rep of a set as the fatigue model sees it. `observedS` when it has been swum, for the reps before. */
export type SetRep = { distanceM: number; intendedS: number; sendOffS: number | null; observedS?: number };
export type SetPlan = { reps: SetRep[]; metersBefore: number; cs: number };

/** Slowdown of a rep that counts as a break (operational definition: ≥ 4 % over the earlier reps). */
export const BREAK_PENALTY = 0.035;
const NOISE_BREAK_PER_REP = 0.006;
const SHAPE_SD = 0.014;
const DRIFT_PER_DAY = { w: 0.02, tau: 0.006, vol: 0.003 };

function priorWeights(): Float64Array {
  // Physiology: W′ ~ 18 m, τ ~ 80 s, σ ~ 0.15, wide (log-normal-ish) — the athletes' data decide.
  const p = new Float64Array(CELLS);
  for (let w = 0; w < NW; w += 1) {
    for (let t = 0; t < NT; t += 1) {
      for (let v = 0; v < NV; v += 1) {
        const lw = Math.log(W_GRID[w] / 18) / 0.6;
        const lt = Math.log(TAU_GRID[t] / 80) / 0.7;
        const lv = (VOL_GRID[v] - 0.15) / 0.15;
        p[cellIndex(w, t, v)] = Math.exp(-0.5 * (lw * lw + lt * lt + lv * lv));
      }
    }
  }
  return normalise(p);
}

function normalise(p: Float64Array): Float64Array {
  let total = 0;
  for (const value of p) total += value;
  for (let i = 0; i < p.length; i += 1) p[i] = total > 0 ? p[i] / total : 1 / p.length;
  return p;
}

export const PHYSIOLOGY_PRIOR = priorWeights();

/** Slowdown (log) of every rep of a set under one profile, and the rep (1-based) where it first falls off. */
export function simulateSet(plan: SetPlan, wPrime: number, tau: number, volSens: number): { penalty: number[]; cliffAt: number | null } {
  const wMax = wPrime * (1 - volSens * Math.min(1.5, plan.metersBefore / 4000));
  let balance = wMax;
  const penalty: number[] = [];
  let cliffAt: number | null = null;
  plan.reps.forEach((rep, index) => {
    const v = rep.distanceM / rep.intendedS;
    const need = Math.max(0, (v - plan.cs) * rep.intendedS);
    let time = rep.intendedS;
    if (need > balance && plan.cs > 0) {
      time = Math.max(rep.intendedS, (rep.distanceM - Math.max(0, balance)) / plan.cs);
    }
    const p = Math.log(time / rep.intendedS);
    penalty.push(p);
    if (p >= BREAK_PENALTY && cliffAt == null) cliffAt = index + 1;
    const swum = rep.observedS ?? time;
    const speed = rep.distanceM / swum;
    if (speed > plan.cs) balance -= (speed - plan.cs) * swum;
    const rest = rep.sendOffS != null ? Math.max(5, rep.sendOffS - swum) : 60;
    balance = wMax - (wMax - balance) * Math.exp(-rest / tau);
  });
  return { penalty, cliffAt };
}

export type FatigueForecast = { meanPenalty: number[]; varPenalty: number[]; pBreakBy: number[] };

export class FatigueProfile {
  post: Float64Array;
  day: number | null = null;
  sets = 0;

  constructor(prior: Float64Array = PHYSIOLOGY_PRIOR) {
    this.post = prior.slice();
  }

  clone(): FatigueProfile {
    const copy = new FatigueProfile(this.post);
    copy.day = this.day;
    copy.sets = this.sets;
    return copy;
  }

  /** Days pass: each dimension may move, at its own speed (a little mass flows to neighbouring values). */
  drift(day: number) {
    if (this.day == null || day <= this.day) {
      this.day = day;
      return;
    }
    const dt = day - this.day;
    this.day = day;
    const axes: [number, number][] = [
      [1 - Math.exp(-DRIFT_PER_DAY.w * dt), 0],
      [1 - Math.exp(-DRIFT_PER_DAY.tau * dt), 1],
      [1 - Math.exp(-DRIFT_PER_DAY.vol * dt), 2],
    ];
    for (const [rate, axis] of axes) {
      if (rate < 1e-6) continue;
      const next = new Float64Array(CELLS);
      for (let w = 0; w < NW; w += 1) {
        for (let t = 0; t < NT; t += 1) {
          for (let v = 0; v < NV; v += 1) {
            const here = this.post[cellIndex(w, t, v)];
            const coords = [w, t, v];
            const size = [NW, NT, NV][axis];
            const neighbours = [coords[axis] - 1, coords[axis] + 1].filter((value) => value >= 0 && value < size);
            next[cellIndex(w, t, v)] += here * (1 - rate);
            for (const n of neighbours) {
              const c = [...coords];
              c[axis] = n;
              next[cellIndex(c[0], c[1], c[2])] += (here * rate) / neighbours.length;
            }
          }
        }
      }
      this.post = next;
    }
  }

  forecast(plan: SetPlan): FatigueForecast {
    const n = plan.reps.length;
    const mean = new Array(n).fill(0);
    const second = new Array(n).fill(0);
    const broken = new Array(n).fill(0);
    for (let w = 0; w < NW; w += 1) {
      for (let t = 0; t < NT; t += 1) {
        for (let v = 0; v < NV; v += 1) {
          const weight = this.post[cellIndex(w, t, v)];
          if (weight < 1e-7) continue;
          const { penalty, cliffAt } = simulateSet(plan, W_GRID[w], TAU_GRID[t], VOL_GRID[v]);
          for (let i = 0; i < n; i += 1) {
            mean[i] += weight * penalty[i];
            second[i] += weight * penalty[i] * penalty[i];
            if (cliffAt != null && cliffAt <= i + 1) broken[i] += weight;
          }
        }
      }
    }
    return {
      meanPenalty: mean,
      varPenalty: mean.map((m, i) => Math.max(0, second[i] - m * m)),
      // Plus breaks that come from noise alone (a slow rep with no cliff), from the 3rd rep on.
      pBreakBy: broken.map((p, i) => 1 - (1 - p) * Math.pow(1 - NOISE_BREAK_PER_REP, Math.max(0, i - 1))),
    };
  }

  /**
   * Learns from a swum set. `observedLog[i]` = log(observed time), `levelLog[i]` = the state model's
   * log forecast without in-set fatigue; only the shape is used. `planned` = reps planned in the set.
   */
  update(plan: SetPlan, observedLog: number[], levelLog: number[], planned: number) {
    const n = plan.reps.length;
    if (n < 2) return;
    const missingTail = planned > n;
    const logLik = new Float64Array(CELLS);
    let best = -Infinity;
    for (let w = 0; w < NW; w += 1) {
      for (let t = 0; t < NT; t += 1) {
        for (let v = 0; v < NV; v += 1) {
          const i0 = cellIndex(w, t, v);
          if (this.post[i0] < 1e-12) {
            logLik[i0] = -Infinity;
            continue;
          }
          const { penalty } = simulateSet(plan, W_GRID[w], TAU_GRID[t], VOL_GRID[v]);
          const residual = observedLog.map((y, i) => y - levelLog[i] - penalty[i]);
          const sorted = [...residual].sort((a, b) => a - b);
          const offset = sorted[Math.floor(sorted.length / 2)];
          let ll = 0;
          for (const r of residual) {
            const z = (r - offset) / SHAPE_SD;
            ll += -2.5 * Math.log1p((z * z) / 4); // Student-t, 4 df: a freak rep does not decide alone
          }
          if (missingTail) {
            // Censoring: would this profile have broken by the first missing rep?
            const extended: SetPlan = { ...plan, reps: [...plan.reps, { ...plan.reps[n - 1], observedS: undefined }] };
            const next = simulateSet(extended, W_GRID[w], TAU_GRID[t], VOL_GRID[v]).penalty[n];
            const pStop = 0.5 + 0.5 / (1 + Math.exp(-(next - BREAK_PENALTY) / 0.01));
            ll += Math.log(pStop);
          }
          logLik[i0] = ll;
          if (ll > best) best = ll;
        }
      }
    }
    for (let i = 0; i < CELLS; i += 1) this.post[i] = Number.isFinite(logLik[i]) ? this.post[i] * Math.exp(logLik[i] - best) : 0;
    // Never fully certain: keep a sliver of the prior so a real change can still be learned.
    const floor = 1e-4;
    for (let i = 0; i < CELLS; i += 1) this.post[i] = this.post[i] + floor * PHYSIOLOGY_PRIOR[i];
    normalise(this.post);
    this.sets += 1;
  }

  /** Posterior means and the share of mass on the athlete's most likely values (how settled each dimension is). */
  summary(): { wPrime: number; tau: number; volSens: number; certainty: number } {
    let w = 0;
    let t = 0;
    let v = 0;
    let top = 0;
    for (let a = 0; a < NW; a += 1) {
      for (let b = 0; b < NT; b += 1) {
        for (let c = 0; c < NV; c += 1) {
          const p = this.post[cellIndex(a, b, c)];
          w += p * Math.log(W_GRID[a]);
          t += p * Math.log(TAU_GRID[b]);
          v += p * VOL_GRID[c];
          top = Math.max(top, p);
        }
      }
    }
    return { wPrime: Math.exp(w), tau: Math.exp(t), volSens: v, certainty: top };
  }
}

/** Team prior: the average of informed teammates' posteriors, flattened, blended with physiology. */
export function teamFatiguePrior(profiles: FatigueProfile[]): Float64Array {
  const informed = profiles.filter((profile) => profile.sets >= 10);
  if (informed.length < 2) return PHYSIOLOGY_PRIOR;
  const out = new Float64Array(CELLS);
  for (const profile of informed) for (let i = 0; i < CELLS; i += 1) out[i] += Math.sqrt(profile.post[i]) / informed.length;
  normalise(out);
  for (let i = 0; i < CELLS; i += 1) out[i] = 0.7 * out[i] + 0.3 * PHYSIOLOGY_PRIOR[i];
  return normalise(out);
}

import { isPlausibleRep, type TrainingRep } from "../training-context";
import { groupKey } from "../training-prediction";
import { dayNumber, originOf, type Horizon, type Prediction, type TeamData } from "./backtest";

/*
 * The production model (training-prediction.ts → predictTrainingTargets), re-implemented for the
 * backtest only:
 *   - identical at the day horizon (checked against production in legacy-baseline.test.ts), but
 *     incremental — O(n·p²) instead of O(dates·n·p²) — so it can run on years of data;
 *   - able to forecast "as of" an origin for the lead horizons, which production never does: the
 *     level and the regression only see reps up to the origin, and plan-derived features fall back
 *     to the athlete's own medians when the plan is not known yet.
 * It is not used by the app.
 */

const LEVEL_HALF_LIFE_DAYS = 28;
const PATTERN_HALF_LIFE_DAYS = 180;
const RIDGE_LAMBDA = 4;
const MIN_GROUP_REFS = 2;
const BREAK_DAYS = 10;
const P = 21;

type Ctx = { consecutiveDays: number; daysSinceReturn: number | null };

function sessionContext(rows: TrainingRep[]): Map<string, Ctx> {
  const days = [...new Set(rows.map((row) => row.date))].sort();
  const out = new Map<string, Ctx>();
  let streak = 0;
  let returnDay: number | null = null;
  for (let i = 0; i < days.length; i += 1) {
    const today = dayNumber(days[i]);
    const prev = i ? dayNumber(days[i - 1]) : null;
    if (prev != null && today - prev === 1) streak += 1;
    else streak = 0;
    if (prev != null && today - prev >= BREAK_DAYS) returnDay = today;
    out.set(days[i], { consecutiveDays: streak, daysSinceReturn: returnDay == null ? null : today - returnDay });
  }
  return out;
}

type Fields = { loadBeforeM: number; weeklyLoadM: number; sleepHours: number | null; gymType: TrainingRep["gymType"] };

function features(row: TrainingRep, ctx: Ctx, restDelta: number | null, fields: Fields): number[] {
  const x = new Array(P).fill(0);
  x[0] = 1;
  x[1 + row.weekday] = 1;
  x[8] = row.shift === "morning" ? 1 : 0;
  x[9] = row.trainedEarlierToday ? 1 : 0;
  x[10] = row.segmentReps > 1 ? (row.repInSegment - 1) / (row.segmentReps - 1) : 0;
  x[11] = restDelta == null ? 0 : restDelta / 10;
  x[12] = row.fromBlock ? 1 : 0;
  x[13] = fields.loadBeforeM / 1000;
  x[14] = fields.weeklyLoadM / 10000;
  x[15] = Math.min(ctx.consecutiveDays, 6);
  x[16] = ctx.daysSinceReturn == null ? 0 : Math.max(0, 1 - ctx.daysSinceReturn / 42);
  x[17] = fields.sleepHours == null ? 0 : Math.max(0, 8 - fields.sleepHours);
  x[18] = fields.gymType === "strength" ? 1 : 0;
  x[19] = fields.gymType === "explosive" ? 1 : 0;
  x[20] = fields.gymType === "mobility" ? 1 : 0;
  return x;
}

function ridgeSolve(xtx: number[][], xty: number[], lambda: number): number[] {
  const p = xty.length;
  const a = xtx.map((row, i) => row.map((value, j) => value + (i === j && i > 0 ? lambda : 0)));
  const b = [...xty];
  for (let col = 0; col < p; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < p; r += 1) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    const diag = a[col][col] || 1e-9;
    for (let r = col + 1; r < p; r += 1) {
      const f = a[r][col] / diag;
      if (!f) continue;
      for (let c = col; c < p; c += 1) a[r][c] -= f * a[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array(p).fill(0);
  for (let r = p - 1; r >= 0; r -= 1) {
    let sum = b[r];
    for (let c = r + 1; c < p; c += 1) sum -= a[r][c] * x[c];
    x[r] = sum / (a[r][r] || 1e-9);
  }
  return x;
}

/** Per group: items in date order, plus a value-sorted copy grown as the cutoff advances. */
type GroupIndex = {
  items: TrainingRep[];
  /** How many items (a date prefix) are in `sorted`. */
  used: number;
  sorted: TrainingRep[];
  rests: number[];
};

function insertSorted<T>(list: T[], item: T, key: (value: T) => number) {
  let lo = 0;
  let hi = list.length;
  const k = key(item);
  // After every equal value, so equal values keep their date order (a stable sort).
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(list[mid]) <= k) lo = mid + 1;
    else hi = mid;
  }
  list.splice(lo, 0, item);
}

const powCache = new Map<number, number>();
const levelWeight = (days: number) => {
  let w = powCache.get(days);
  if (w == null) {
    w = Math.pow(0.5, days / LEVEL_HALF_LIFE_DAYS);
    powCache.set(days, w);
  }
  return w;
};

type Level = { levelS: number; n: number; spread: number; typicalRest: number | null };

/** Level from the group's items dated on or before `lastDay`, weighted as seen from `today`. */
function levelAsOf(group: GroupIndex, lastDay: number, today: number): Level | null {
  while (group.used < group.items.length && dayNumber(group.items[group.used].date) <= lastDay) {
    const item = group.items[group.used];
    insertSorted(group.sorted, item, (row) => row.timeS);
    if (item.restSeconds != null) insertSorted(group.rests, item.restSeconds, (value) => value);
    group.used += 1;
  }
  const n = group.used;
  if (n < MIN_GROUP_REFS) return null;
  let total = 0;
  for (const item of group.sorted) total += levelWeight(today - dayNumber(item.date));
  let acc = 0;
  let levelS = group.sorted[group.sorted.length - 1].timeS;
  for (const item of group.sorted) {
    acc += levelWeight(today - dayNumber(item.date));
    if (acc >= total / 2) {
      levelS = item.timeS;
      break;
    }
  }
  // Spread exactly as production sums it: in date order.
  let totalDate = 0;
  let sq = 0;
  for (let i = 0; i < n; i += 1) {
    const item = group.items[i];
    const w = levelWeight(today - dayNumber(item.date));
    totalDate += w;
    sq += w * (item.timeS - levelS) ** 2;
  }
  const rests = group.rests;
  const typicalRest = rests.length ? rests[Math.max(0, Math.ceil(rests.length / 2) - 1)] : null;
  return { levelS, n, spread: Math.sqrt(sq / totalDate), typicalRest };
}

/** Weighted sums for the ridge, decayed in place as the cutoff moves forward. */
class PatternAccumulator {
  xtx = Array.from({ length: P }, () => new Array(P).fill(0));
  xty = new Array(P).fill(0);
  yy = 0;
  weight = 0;
  n = 0;
  /** Day the weights are expressed relative to. */
  ref: number | null = null;

  moveTo(day: number) {
    if (this.ref == null) {
      this.ref = day;
      return;
    }
    if (day === this.ref) return;
    const f = Math.pow(0.5, (day - this.ref) / PATTERN_HALF_LIFE_DAYS);
    for (let i = 0; i < P; i += 1) {
      this.xty[i] *= f;
      for (let j = 0; j < P; j += 1) this.xtx[i][j] *= f;
    }
    this.yy *= f;
    this.weight *= f;
    this.ref = day;
  }

  add(x: number[], gap: number, day: number) {
    const w = Math.pow(0.5, (this.ref! - day) / PATTERN_HALF_LIFE_DAYS);
    for (let i = 0; i < P; i += 1) {
      if (!x[i]) continue;
      this.xty[i] += w * x[i] * gap;
      for (let j = 0; j < P; j += 1) if (x[j]) this.xtx[i][j] += w * x[i] * x[j];
    }
    this.yy += w * gap * gap;
    this.weight += w;
    this.n += 1;
  }

  fit(): { beta: number[]; residualSd: number; n: number } {
    if (!this.n) return { beta: new Array(P).fill(0), residualSd: 0, n: 0 };
    const beta = ridgeSolve(this.xtx, this.xty, RIDGE_LAMBDA);
    let sse = this.yy;
    for (let i = 0; i < P; i += 1) {
      sse -= 2 * beta[i] * this.xty[i];
      for (let j = 0; j < P; j += 1) sse += beta[i] * this.xtx[i][j] * beta[j];
    }
    return { beta, residualSd: Math.sqrt(Math.max(0, sse) / this.weight), n: this.n };
  }
}

export type LegacyTarget = Prediction & { levelS: number; groupN: number };

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** One athlete, one pool. Predictions per log id under `horizon`; `excluded` reps are predicted but never learned from. */
function predictCourse(rows: TrainingRep[], horizon: Horizon, anchorDay: number, excluded?: Set<string>): Map<string, LegacyTarget> {
  const valid = rows.filter(isPlausibleRep);
  const out = new Map<string, LegacyTarget>();
  if (!valid.length) return out;
  const ctx = sessionContext(valid);
  const learnable = excluded?.size ? valid.filter((row) => !excluded.has(row.log.id)) : valid;
  const groups = new Map<string, GroupIndex>();
  for (const row of learnable) {
    const key = groupKey(row);
    const group = groups.get(key) ?? { items: [], used: 0, sorted: [], rests: [] };
    group.items.push(row);
    groups.set(key, group);
  }

  // Training samples: every rep with a level from strictly earlier dates (as production builds them).
  const sampleGroups = new Map<string, GroupIndex>();
  for (const [key, group] of groups) sampleGroups.set(key, { items: group.items, used: 0, sorted: [], rests: [] });
  type Sample = { row: TrainingRep; day: number; x: number[]; gap: number };
  const samples: Sample[] = [];
  const byDate = new Map<string, TrainingRep[]>();
  for (const row of learnable) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
  for (const [date, list] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const day = dayNumber(date);
    for (const row of list) {
      const level = levelAsOf(sampleGroups.get(groupKey(row))!, day - 1, day);
      if (!level) continue;
      const restDelta = row.restSeconds != null && level.typicalRest != null ? row.restSeconds - level.typicalRest : null;
      samples.push({ row, day, x: features(row, ctx.get(date)!, restDelta, row), gap: row.timeS / level.levelS - 1 });
    }
  }
  samples.sort((a, b) => a.day - b.day);

  // Targets with the last day they may use; processed in that order so every structure only grows.
  const targets = valid
    .map((row) => ({ row, last: horizon.kind === "lead" ? originOf(row.date, horizon, anchorDay) : dayNumber(row.date) - 1 }))
    .sort((a, b) => a.last - b.last);
  const acc = new PatternAccumulator();
  let nextSample = 0;
  let fitCache: { last: number; fit: ReturnType<PatternAccumulator["fit"]> } | null = null;
  const lastCtxDate = (lastDay: number) => {
    let best: string | null = null;
    for (const date of ctx.keys()) if (dayNumber(date) <= lastDay) best = date;
    return best;
  };
  const history: TrainingRep[] = [];
  let historyUsed = 0;
  const levels = new Map<string, Level | null>();
  for (const { row, last } of targets) {
    const key = groupKey(row);
    const today = dayNumber(row.date);
    const cacheKey = `${key}#${last}#${today}`;
    if (!levels.has(cacheKey)) levels.set(cacheKey, groups.has(key) ? levelAsOf(groups.get(key)!, last, today) : null);
    const level = levels.get(cacheKey);
    if (!level) continue;
    if (!fitCache || fitCache.last !== last) {
      acc.moveTo(last + 1);
      while (nextSample < samples.length && samples[nextSample].day <= last) {
        acc.add(samples[nextSample].x, samples[nextSample].gap, samples[nextSample].day);
        nextSample += 1;
      }
      fitCache = { last, fit: acc.fit() };
    }
    const fit = fitCache.fit;
    let rowCtx = ctx.get(row.date)!;
    let fields: Fields = row;
    if (horizon.kind === "lead") {
      const date = lastCtxDate(last);
      rowCtx = date ? ctx.get(date)! : { consecutiveDays: 0, daysSinceReturn: null };
      while (historyUsed < learnable.length && dayNumber(learnable[historyUsed].date) <= last) history.push(learnable[historyUsed++]);
      fields = {
        loadBeforeM: horizon.planKnown ? row.loadBeforeM : median(history.map((item) => item.loadBeforeM)),
        weeklyLoadM: horizon.planKnown ? row.weeklyLoadM : median(history.map((item) => item.weeklyLoadM)),
        sleepHours: null,
        gymType: null,
      };
    }
    const restDelta = row.restSeconds != null && level.typicalRest != null ? row.restSeconds - level.typicalRest : null;
    const x = features(row, rowCtx, restDelta, fields);
    const adjust = fit.n >= 8 ? x.reduce((sum, value, i) => sum + value * fit.beta[i], 0) : 0;
    const targetS = level.levelS * (1 + Math.max(-0.08, Math.min(0.08, adjust)));
    const relSpread = fit.n >= 8 ? fit.residualSd : level.spread / level.levelS;
    const spread = Math.max(targetS * 0.005, targetS * relSpread);
    const confidence = level.n >= 8 && fit.n >= 30 ? "alta" : level.n >= 4 ? "média" : "baixa";
    out.set(row.log.id, {
      mean: targetS,
      lo: Math.max(0, targetS - spread),
      hi: targetS + spread,
      nominal: 0.6826894921370859,
      sd: spread,
      confidence,
      levelS: level.levelS,
      groupN: level.n,
    });
  }
  return out;
}

/** The production model per athlete and per pool, as the training dashboard runs it. */
export function legacyPredict(team: TeamData, horizon: Horizon, excluded?: Set<string>): Map<string, LegacyTarget> {
  const out = new Map<string, LegacyTarget>();
  for (const rows of team.rows.values()) {
    const byCourse = new Map<string, TrainingRep[]>();
    for (const row of rows) byCourse.set(row.course || "", [...(byCourse.get(row.course || "") ?? []), row]);
    for (const list of byCourse.values()) for (const [id, target] of predictCourse(list, horizon, team.anchorDay, excluded)) out.set(id, target);
  }
  return out;
}

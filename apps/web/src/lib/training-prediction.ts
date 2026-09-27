import { tx, type MessageKey } from "@/i18n";
import { weekStartMonday } from "./dates";
import { isPlausibleRep, type TrainingRep } from "./training-context";

/*
 * Athlete-learned training model.
 *
 * 1. Reps are only compared within the same group: pool length, rep distance, stroke,
 *    intensity and gear. No conversion between pools or intensities is assumed.
 * 2. The expected level for a rep is the recency-weighted median of that athlete's earlier
 *    reps in the same group, so it follows the athlete's current form.
 * 3. How context moves times (weekday, shift, send-off, set position, load, consecutive days,
 *    return from a break, sleep, gym) is learned from the athlete's own history with a ridge
 *    regression on the relative gap to that level. Nothing about the size or direction of any
 *    effect is predefined; with little data the effects stay close to zero.
 * 4. Only reps from dates before the rep being estimated are used.
 */

export type TargetConfidence = "alta" | "média" | "baixa";

export type TrainingTarget = {
  targetS: number;
  lowS: number;
  highS: number;
  levelS: number;
  confidence: TargetConfidence;
  groupN: number;
  trainN: number;
  basis: string;
};

export type LearnedEffect = {
  key: string;
  label: string;
  /** Change in time, in % (negative = faster). */
  pct: number;
  support: number;
};

export type FormPoint = { week: string; indexPct: number; n: number };
export type FormBreak = { from: string; to: string; days: number; recoveryWeeks: number | null };

const LEVEL_HALF_LIFE_DAYS = 28;
const PATTERN_HALF_LIFE_DAYS = 180;
const RIDGE_LAMBDA = 4;
const MIN_GROUP_REFS = 2;
const BREAK_DAYS = 10;
const WEEKDAY_NAMES: MessageKey[] = ["Segundas", "Terças", "Quartas", "Quintas", "Sextas", "Sábados", "Domingos"];

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T12:00:00Z`) / DAY_MS);

export function groupKey(row: TrainingRep): string {
  const gear = [...row.gear].sort().join("+") || "-";
  return `${row.course || "?"}|${row.distanceM}|${row.stroke || "-"}|${row.intensity}|${gear}`;
}

type Context = {
  consecutiveDays: number;
  daysSinceReturn: number | null;
};

/** Per session date: consecutive training days before it, and days since coming back from a break. */
function sessionContext(rows: TrainingRep[]): Map<string, Context> {
  const days = [...new Set(rows.map((row) => row.date))].sort();
  const out = new Map<string, Context>();
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

type FeatureSpec = { key: string; label: MessageKey; step: number; value: (row: TrainingRep, extra: RowExtra) => number };
type RowExtra = { ctx: Context; restDelta: number | null };

const FEATURES: FeatureSpec[] = [
  ...WEEKDAY_NAMES.map((name, index) => ({
    key: `weekday-${index}`,
    label: name,
    step: 1,
    value: (row: TrainingRep) => (row.weekday === index ? 1 : 0),
  })),
  { key: "morning", label: "Treino de manhã", step: 1, value: (row) => (row.shift === "morning" ? 1 : 0) },
  { key: "second", label: "2.º treino do dia", step: 1, value: (row) => (row.trainedEarlierToday ? 1 : 0) },
  {
    key: "position",
    label: "Última rep da série face à primeira",
    step: 1,
    value: (row) => (row.segmentReps > 1 ? (row.repInSegment - 1) / (row.segmentReps - 1) : 0),
  },
  {
    key: "sendoff",
    label: "Saída 10\" mais longa do que o habitual",
    step: 1,
    value: (_row, extra) => (extra.restDelta == null ? 0 : extra.restDelta / 10),
  },
  { key: "block", label: "Partida do bloco", step: 1, value: (row) => (row.fromBlock ? 1 : 0) },
  { key: "loadBefore", label: "Mais 1 km nadado antes, no treino", step: 1, value: (row) => row.loadBeforeM / 1000 },
  { key: "weekly", label: "Mais 10 km na semana", step: 1, value: (row) => row.weeklyLoadM / 10000 },
  {
    key: "streak",
    label: "Cada dia seguido de treino antes",
    step: 1,
    value: (_row, extra) => Math.min(extra.ctx.consecutiveDays, 6),
  },
  {
    key: "return",
    label: "Primeiros dias após uma paragem",
    step: 1,
    value: (_row, extra) =>
      extra.ctx.daysSinceReturn == null ? 0 : Math.max(0, 1 - extra.ctx.daysSinceReturn / 42),
  },
  {
    key: "sleep",
    label: "Menos 1 h de sono",
    step: 1,
    value: (row) => (row.sleepHours == null ? 0 : Math.max(0, 8 - row.sleepHours)),
  },
  { key: "gymStrength", label: "Ginásio de força no dia", step: 1, value: (row) => (row.gymType === "strength" ? 1 : 0) },
  { key: "gymExplosive", label: "Ginásio explosivo no dia", step: 1, value: (row) => (row.gymType === "explosive" ? 1 : 0) },
  { key: "gymMobility", label: "Mobilidade no dia", step: 1, value: (row) => (row.gymType === "mobility" ? 1 : 0) },
];

function weightedMedian(values: { v: number; w: number }[]): number {
  const sorted = [...values].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((sum, item) => sum + item.w, 0);
  let acc = 0;
  for (const item of sorted) {
    acc += item.w;
    if (acc >= total / 2) return item.v;
  }
  return sorted[sorted.length - 1].v;
}

type Level = { levelS: number; n: number; spread: number; typicalRest: number | null };

/** Expected level from earlier reps of the same group (strictly before `date`). */
function levelFor(history: TrainingRep[], date: string): Level | null {
  const earlier = history.filter((item) => item.date < date);
  if (earlier.length < MIN_GROUP_REFS) return null;
  const today = dayNumber(date);
  const weighted = earlier.map((item) => ({
    v: item.timeS,
    w: Math.pow(0.5, (today - dayNumber(item.date)) / LEVEL_HALF_LIFE_DAYS),
  }));
  const levelS = weightedMedian(weighted);
  const total = weighted.reduce((sum, item) => sum + item.w, 0);
  const spread = Math.sqrt(weighted.reduce((sum, item) => sum + item.w * (item.v - levelS) ** 2, 0) / total);
  const rests = earlier.map((item) => item.restSeconds).filter((value): value is number => value != null);
  const typicalRest = rests.length ? weightedMedian(rests.map((v) => ({ v, w: 1 }))) : null;
  return { levelS, n: earlier.length, spread, typicalRest };
}

/** Solves (A + λI)x = b by Gaussian elimination; the first column (intercept) is not penalised. */
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

type Sample = { row: TrainingRep; x: number[]; gap: number; level: Level };

function features(row: TrainingRep, extra: RowExtra): number[] {
  return [1, ...FEATURES.map((spec) => spec.value(row, extra))];
}

/** Every rep that has an expected level, with its relative gap to that level. */
function buildSamples(rows: TrainingRep[]): Sample[] {
  const valid = rows.filter(isPlausibleRep);
  const byGroup = new Map<string, TrainingRep[]>();
  for (const row of valid) {
    const list = byGroup.get(groupKey(row)) ?? [];
    list.push(row);
    byGroup.set(groupKey(row), list);
  }
  const ctx = sessionContext(valid);
  const samples: Sample[] = [];
  for (const row of valid) {
    const level = levelFor(byGroup.get(groupKey(row)) ?? [], row.date);
    if (!level) continue;
    const extra: RowExtra = {
      ctx: ctx.get(row.date) ?? { consecutiveDays: 0, daysSinceReturn: null },
      restDelta: row.restSeconds != null && level.typicalRest != null ? row.restSeconds - level.typicalRest : null,
    };
    samples.push({ row, x: features(row, extra), gap: row.timeS / level.levelS - 1, level });
  }
  return samples;
}

type Fit = { beta: number[]; residualSd: number; n: number };

function fitPatterns(samples: Sample[], asOf: string): Fit {
  const p = FEATURES.length + 1;
  const xtx = Array.from({ length: p }, () => new Array(p).fill(0));
  const xty = new Array(p).fill(0);
  const today = dayNumber(asOf);
  let n = 0;
  const used: { s: Sample; w: number }[] = [];
  for (const s of samples) {
    if (s.row.date >= asOf) continue;
    const w = Math.pow(0.5, (today - dayNumber(s.row.date)) / PATTERN_HALF_LIFE_DAYS);
    for (let i = 0; i < p; i += 1) {
      xty[i] += w * s.x[i] * s.gap;
      for (let j = 0; j < p; j += 1) xtx[i][j] += w * s.x[i] * s.x[j];
    }
    used.push({ s, w });
    n += 1;
  }
  if (!n) return { beta: new Array(p).fill(0), residualSd: 0, n: 0 };
  const beta = ridgeSolve(xtx, xty, RIDGE_LAMBDA);
  const totalW = used.reduce((sum, item) => sum + item.w, 0);
  const sse = used.reduce((sum, { s, w }) => {
    const fitted = s.x.reduce((acc, value, i) => acc + value * beta[i], 0);
    return sum + w * (s.gap - fitted) ** 2;
  }, 0);
  return { beta, residualSd: Math.sqrt(sse / totalW), n };
}

export function predictTrainingTargets(rows: TrainingRep[]): Map<string, TrainingTarget> {
  const samples = buildSamples(rows);
  const fits = new Map<string, Fit>();
  const out = new Map<string, TrainingTarget>();
  for (const sample of samples) {
    const date = sample.row.date;
    let fit = fits.get(date);
    if (!fit) {
      fit = fitPatterns(samples, date);
      fits.set(date, fit);
    }
    // Intercept absorbs drift of the level itself; keep the pattern part only when there is enough to learn from.
    const adjust = fit.n >= 8 ? sample.x.reduce((acc, value, i) => acc + value * fit.beta[i], 0) : 0;
    const targetS = sample.level.levelS * (1 + Math.max(-0.08, Math.min(0.08, adjust)));
    const relSpread = fit.n >= 8 ? fit.residualSd : sample.level.spread / sample.level.levelS;
    const spread = Math.max(targetS * 0.005, targetS * relSpread);
    const confidence: TargetConfidence =
      sample.level.n >= 8 && fit.n >= 30 ? "alta" : sample.level.n >= 4 ? "média" : "baixa";
    out.set(sample.row.log.id, {
      targetS,
      lowS: Math.max(0, targetS - spread),
      highS: targetS + spread,
      levelS: sample.level.levelS,
      confidence,
      groupN: sample.level.n,
      trainN: fit.n,
      basis: tx("{same} reps anteriores iguais · padrões de {total} reps", { same: sample.level.n, total: fit.n }),
    });
  }
  return out;
}

/** What the model has learned so far for this athlete, fitted on all their history. */
export function learnedPatterns(rows: TrainingRep[]): { effects: LearnedEffect[]; n: number } {
  const samples = buildSamples(rows);
  const lastDate = samples.reduce((max, s) => (s.row.date > max ? s.row.date : max), "");
  if (!lastDate) return { effects: [], n: 0 };
  const asOf = new Date(Date.parse(`${lastDate}T12:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  const fit = fitPatterns(samples, asOf);
  const support = FEATURES.map((spec, i) => samples.filter((s) => s.x[i + 1] !== 0).length);

  const weekdayIdx = FEATURES.map((spec, i) => (spec.key.startsWith("weekday-") ? i : -1)).filter((i) => i >= 0);
  const seenDays = weekdayIdx.filter((i) => support[i] > 0);
  const dayMean = seenDays.length ? seenDays.reduce((sum, i) => sum + fit.beta[i + 1], 0) / seenDays.length : 0;

  const effects: LearnedEffect[] = FEATURES.map((spec, i) => {
    const raw = fit.beta[i + 1] * spec.step;
    const pct = (spec.key.startsWith("weekday-") ? raw - dayMean : raw) * 100;
    return { key: spec.key, label: spec.key.startsWith("weekday-") ? tx("{day} face à média da semana", { day: tx(spec.label) }) : tx(spec.label), pct, support: support[i] };
  }).filter((effect) => effect.support >= 5 && (effect.key !== "sendoff" || effect.support >= 5));

  return { effects, n: fit.n };
}

/**
 * Weekly form index: median gap of each week's reps to that group's all-time median (negative =
 * faster than usual). Breaks are gaps of 10+ days; recovery is weeks until the index is back to
 * the average of the three weeks before the break.
 */
export function formTimeline(rows: TrainingRep[]): { points: FormPoint[]; breaks: FormBreak[] } {
  const valid = rows.filter(isPlausibleRep);
  const groups = new Map<string, number[]>();
  for (const row of valid) {
    const list = groups.get(groupKey(row)) ?? [];
    list.push(row.timeS);
    groups.set(groupKey(row), list);
  }
  const medians = new Map<string, number>();
  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => a - b);
    medians.set(key, sorted[Math.floor(sorted.length / 2)]);
  }
  const weeks = new Map<string, number[]>();
  for (const row of valid) {
    const median = medians.get(groupKey(row));
    if (!median) continue;
    const week = weekStartMonday(row.date);
    const list = weeks.get(week) ?? [];
    list.push((row.timeS / median - 1) * 100);
    weeks.set(week, list);
  }
  const points = [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, gaps]) => {
      const sorted = [...gaps].sort((a, b) => a - b);
      return { week, indexPct: sorted[Math.floor(sorted.length / 2)], n: gaps.length };
    });

  const days = [...new Set(valid.map((row) => row.date))].sort();
  const breaks: FormBreak[] = [];
  for (let i = 1; i < days.length; i += 1) {
    const gap = dayNumber(days[i]) - dayNumber(days[i - 1]);
    if (gap < BREAK_DAYS) continue;
    const before = points.filter((p) => p.week < weekStartMonday(days[i - 1])).slice(-3);
    const target = before.length ? before.reduce((sum, p) => sum + p.indexPct, 0) / before.length : null;
    const after = points.filter((p) => p.week >= weekStartMonday(days[i]));
    const back = target == null ? -1 : after.findIndex((p) => p.indexPct <= target);
    breaks.push({ from: days[i - 1], to: days[i], days: gap, recoveryWeeks: back >= 0 ? back : null });
  }
  return { points, breaks };
}

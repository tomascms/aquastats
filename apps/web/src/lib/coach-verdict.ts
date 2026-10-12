/*
 * One vocabulary for "is this different?" across the app (docs/natacao/benchmark-visualizacao.md §5).
 * Each swimmer is compared with their own normal: the spread of their reps in the same kind of set (typical
 * error, TE), never a team-wide threshold. Certainty is said in words, never as a probability or a %.
 *   SWC (smallest change that matters) = 0.3 × TE                      (Hopkins 2004/2009)
 *   noise of a comparison σ = TE·√(1/m + 1/n), m capped at 4           (reps in one set are not independent)
 *   "quase de certeza" |d| ≥ SWC + 1.645σ · "provavelmente" |d| ≥ SWC + 0.674σ
 *   "igual ao habitual" |d| ≤ σ/2 · otherwise, or < 3 earlier reps: "ainda não dá para dizer"
 */

export type Direction = "faster" | "slower" | "same" | "unclear";
export type Certainty = "quase" | "provavel";
export type UnclearReason = "poucos-dados" | "varia-muito";
export type Verdict = { dir: Direction; certainty?: Certainty; reason?: UnclearReason };

/** Training prior when the swimmer has little history: ~0.8 % between tests, more for single reps (Pyne 2004; Anderson 2006). */
export const TE_FLOOR = 0.008;
export const TE_PRIOR = 0.015;
export const MIN_HISTORY = 3;

/** The swimmer's typical rep-to-rep spread (s) around `target`, with a floor so a few lucky reps never look "certain". */
export function typicalError(times: number[], target: number): number {
  if (times.length < 5) return Math.max(TE_PRIOR * target, sd(times));
  return Math.max(sd(times), TE_FLOOR * target);
}

/** Mean of `m` reps against a baseline (median of `n` earlier reps). Times: lower = faster. */
export function compareTimes(meanS: number, m: number, baselineS: number, n: number, te: number): Verdict {
  if (n < MIN_HISTORY) return { dir: "unclear", reason: "poucos-dados" };
  const d = meanS - baselineS;
  const sigma = te * Math.sqrt(1 / Math.min(Math.max(m, 1), 4) + 1 / n);
  const swc = 0.3 * te;
  const dir: Direction = d < 0 ? "faster" : "slower";
  if (Math.abs(d) >= swc + 1.645 * sigma) return { dir, certainty: "quase" };
  if (Math.abs(d) >= swc + 0.674 * sigma) return { dir, certainty: "provavel" };
  if (Math.abs(d) <= sigma / 2) return { dir: "same" };
  return { dir: "unclear", reason: "varia-muito" };
}

/** One rep against the swimmer's normal band (target ± TE): no certainty word, just where it fell. */
export function repPosition(timeS: number, targetS: number, te: number): "faster" | "same" | "slower" {
  const d = timeS - targetS;
  return Math.abs(d) <= te ? "same" : d < 0 ? "faster" : "slower";
}

export type Usual = "muito-acima" | "acima" | "habitual" | "abaixo" | "muito-abaixo";

/** Load, sleep, effort: "unusual for this swimmer" (z against their recent weeks), never better/worse. Null with < 3 points. */
export function vsUsual(value: number, history: number[]): Usual | null {
  if (history.length < 3) return null;
  const s = sd(history);
  const m = history.reduce((a, b) => a + b, 0) / history.length;
  if (s === 0) return value === m ? "habitual" : value > m ? "acima" : "abaixo";
  const z = (value - m) / s;
  return z >= 2 ? "muito-acima" : z >= 1 ? "acima" : z <= -2 ? "muito-abaixo" : z <= -1 ? "abaixo" : "habitual";
}

export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

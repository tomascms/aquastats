/** Seeded random numbers, so every synthetic dataset and backtest is reproducible from its seed. */

export type Rng = {
  /** Uniform in [0, 1). */
  next(): number;
  uniform(lo: number, hi: number): number;
  normal(mean?: number, sd?: number): number;
  /** Student-t with `df` degrees of freedom, scaled to unit variance (heavy tails, same spread). */
  studentT(df: number): number;
  chance(p: number): boolean;
  int(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly { value: T; weight: number }[]): T;
};

/** mulberry32: small, fast and good enough for simulation. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  const gauss = () => {
    if (spare != null) {
      const value = spare;
      spare = null;
      return value;
    }
    let u = 0;
    while (u <= Number.EPSILON) u = next();
    const v = next();
    const radius = Math.sqrt(-2 * Math.log(u));
    spare = radius * Math.sin(2 * Math.PI * v);
    return radius * Math.cos(2 * Math.PI * v);
  };
  const rng: Rng = {
    next,
    uniform: (lo, hi) => lo + (hi - lo) * next(),
    normal: (mean = 0, sd = 1) => mean + sd * gauss(),
    studentT(df) {
      let chi = 0;
      for (let i = 0; i < df; i += 1) chi += gauss() ** 2;
      const t = gauss() / Math.sqrt(chi / df);
      return df > 2 ? t * Math.sqrt((df - 2) / df) : t;
    },
    chance: (p) => next() < p,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted(items) {
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      let roll = next() * total;
      for (const item of items) {
        roll -= item.weight;
        if (roll <= 0) return item.value;
      }
      return items[items.length - 1].value;
    },
  };
  return rng;
}

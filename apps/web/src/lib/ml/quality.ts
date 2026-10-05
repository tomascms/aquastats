import { isPlausibleRep, type TrainingRep } from "../training-context";
import { groupKey } from "../training-prediction";

/*
 * Data quality: suspect times before anything learns from them.
 *
 * Every time is entered by hand on the site, so the realistic errors are typing errors: a wrong
 * minute (+/−60 s), two digits swapped, a split typed instead of the final time, or two swimmers'
 * times swapped in the same rep. A time is suspect when it disagrees with
 *   1. the other reps of the same set (same athlete, same set, same kind of rep) — the strongest
 *      evidence, available from the first session; or, for lone reps,
 *   2. the athlete's own recent reps of the same kind;
 * and the size of the disagreement is far beyond normal variation. When a known typing pattern
 * brings the time back in line, that pattern is the stated reason and its value the suggestion.
 *
 * Causal by construction: a rep's flag uses only that rep, its set (only the earlier reps of the
 * set when `withinDayCausal`), and the athlete's earlier days. Nothing is deleted: a suspect time
 * is only kept out of what the models learn from, and shown to the coach.
 */

export type SuspectReason = "minute" | "digits" | "split" | "swap" | "outlier";

export type Suspect = {
  reason: SuspectReason;
  /** The value the pattern suggests (null for a plain outlier). */
  suggestedS: number | null;
  /** Reference the time was compared with. */
  referenceS: number;
  /** Relative gap to the reference, in % (positive = slower). */
  gapPct: number;
};

export type QualityOptions = {
  /** Only earlier reps of the same set count as siblings (for next-rep predictions). */
  withinDayCausal?: boolean;
  /** Gap to the set's other reps that is never normal within a set. */
  setThreshold?: number;
  /** Gap to the athlete's own history that is never normal from one day to the next. */
  historyThreshold?: number;
};

const DEFAULTS = { setThreshold: 0.08, historyThreshold: 0.12 };
const HISTORY_DAYS = 120;
const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Seconds with the two digits of the seconds field swapped (1:12.3 → 1:21.3). */
export function swapSecondDigits(timeS: number): number {
  const minutes = Math.floor(timeS / 60);
  const seconds = Math.floor(timeS - minutes * 60);
  const rest = timeS - minutes * 60 - seconds;
  const swapped = (seconds % 10) * 10 + Math.floor(seconds / 10);
  return swapped > 59 ? Number.NaN : minutes * 60 + swapped + rest;
}

export const setKey = (row: TrainingRep) => `${row.workoutId}|${row.blockId}|${row.segmentIndex}|${row.round}|${groupKey(row)}`;
const repSlot = (row: TrainingRep) => `${row.workoutId}|${row.blockId}|${row.log.repNumber}`;

/**
 * Suspect times for one athlete's reps (chronological). `teammates` are the other athletes' reps,
 * used only to recognise two times swapped in the same rep.
 */
export function findSuspects(rows: TrainingRep[], teammates: TrainingRep[] = [], options: QualityOptions = {}): Map<string, Suspect> {
  const setThreshold = options.setThreshold ?? DEFAULTS.setThreshold;
  const historyThreshold = options.historyThreshold ?? DEFAULTS.historyThreshold;
  const valid = rows.filter(isPlausibleRep);
  const sets = new Map<string, TrainingRep[]>();
  for (const row of valid) sets.set(setKey(row), [...(sets.get(setKey(row)) ?? []), row]);
  const slots = new Map<string, TrainingRep[]>();
  for (const row of teammates) if (isPlausibleRep(row)) slots.set(repSlot(row), [...(slots.get(repSlot(row)) ?? []), row]);

  const history = new Map<string, { day: number; timeS: number }[]>();
  const out = new Map<string, Suspect>();
  let currentDate = "";
  let today: TrainingRep[] = [];
  const flushDay = () => {
    for (const row of today) {
      if (out.has(row.log.id)) continue;
      const list = history.get(groupKey(row)) ?? [];
      list.push({ day: dayNumber(row.date), timeS: row.timeS });
      history.set(groupKey(row), list);
    }
    today = [];
  };

  for (const row of valid) {
    if (row.date !== currentDate) {
      flushDay();
      currentDate = row.date;
    }
    today.push(row);
    const set = sets.get(setKey(row))!;
    const position = set.indexOf(row);
    const siblings = (options.withinDayCausal ? set.slice(0, position) : set.filter((other) => other !== row)).map((other) => other.timeS);
    let reference: number | null = null;
    let threshold = setThreshold;
    let spread = 0.015;
    if (siblings.length >= 2) {
      reference = median(siblings);
      const logs = siblings.map((value) => Math.log(value / reference!));
      spread = Math.max(0.015, 1.4826 * median(logs.map(Math.abs)));
    } else {
      const day = dayNumber(row.date);
      const past = (history.get(groupKey(row)) ?? []).filter((item) => day - item.day <= HISTORY_DAYS);
      if (past.length < 3) continue;
      reference = median(past.slice(-12).map((item) => item.timeS));
      const logs = past.slice(-12).map((item) => Math.log(item.timeS / reference!));
      spread = Math.max(0.02, 1.4826 * median(logs.map(Math.abs)));
      threshold = historyThreshold;
    }
    const gap = Math.log(row.timeS / reference);
    if (Math.abs(gap) < threshold || Math.abs(gap) < 4 * spread) continue;

    // Which typing pattern, if any, brings it back in line?
    const fits = (value: number) => Number.isFinite(value) && value > 0 && Math.abs(Math.log(value / reference!)) < Math.max(0.03, 2 * spread);
    let reason: SuspectReason = "outlier";
    let suggested: number | null = null;
    const candidates: [SuspectReason, number][] = [
      ["minute", row.timeS - 60],
      ["minute", row.timeS + 60],
      ["digits", swapSecondDigits(row.timeS)],
      ["split", row.timeS * 2.04],
    ];
    // Teammates' times of the same rep: only when the whole day may be seen (they are entered at the same moment).
    if (!options.withinDayCausal) for (const other of slots.get(repSlot(row)) ?? []) candidates.push(["swap", other.timeS]);
    let best = Number.POSITIVE_INFINITY;
    for (const [kind, value] of candidates) {
      if (!fits(value)) continue;
      const distance = Math.abs(Math.log(value / reference));
      if (distance < best) {
        best = distance;
        reason = kind;
        suggested = Math.round(value * 100) / 100;
      }
    }
    out.set(row.log.id, { reason, suggestedS: suggested, referenceS: reference, gapPct: (Math.exp(gap) - 1) * 100 });
  }
  return out;
}

/** Suspects for the whole team, each athlete checked against teammates for swapped times. */
export function teamSuspects(team: Map<string, TrainingRep[]>, options: QualityOptions = {}): Map<string, Suspect> {
  const out = new Map<string, Suspect>();
  for (const [athleteId, rows] of team) {
    const teammates = [...team.entries()].filter(([id]) => id !== athleteId).flatMap(([, list]) => list);
    for (const [id, suspect] of findSuspects(rows, teammates, options)) out.set(id, suspect);
  }
  return out;
}

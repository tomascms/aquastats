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
  /** Incremental runs: only reps from this day on are checked; earlier ones keep their flags from `known`. */
  fromDay?: number;
  known?: Map<string, Suspect>;
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
export function findSuspects(rows: TrainingRep[], teammates: TrainingRep[] | Map<string, TrainingRep[]> = [], options: QualityOptions = {}): Map<string, Suspect> {
  const setThreshold = options.setThreshold ?? DEFAULTS.setThreshold;
  const historyThreshold = options.historyThreshold ?? DEFAULTS.historyThreshold;
  // Only the history window before `fromDay` can matter to the reps being checked.
  const from = options.fromDay ?? Number.NEGATIVE_INFINITY;
  const valid = rows.filter((row) => isPlausibleRep(row) && dayNumber(row.date) >= from - HISTORY_DAYS - 1);
  const sets = new Map<string, TrainingRep[]>();
  for (const row of valid) {
    const list = sets.get(setKey(row));
    if (list) list.push(row);
    else sets.set(setKey(row), [row]);
  }
  // Teammates' times by rep slot: either given as a team-wide index (teamSuspects builds it once) or built here.
  const slots = teammates instanceof Map ? teammates : slotIndex(teammates);

  const history = new Map<string, { day: number; timeS: number }[]>();
  const out = new Map<string, Suspect>();
  let currentDate = "";
  let today: TrainingRep[] = [];
  const flushDay = () => {
    for (const row of today) {
      if (out.has(row.log.id) || options.known?.has(row.log.id)) continue;
      const list = history.get(groupKey(row));
      if (list) list.push({ day: dayNumber(row.date), timeS: row.timeS });
      else history.set(groupKey(row), [{ day: dayNumber(row.date), timeS: row.timeS }]);
    }
    today = [];
  };

  for (const row of valid) {
    if (row.date !== currentDate) {
      flushDay();
      currentDate = row.date;
    }
    today.push(row);
    if (dayNumber(row.date) < from) continue;
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
      // The group's history is chronological: the last HISTORY_DAYS start at the first entry recent enough.
      const all = history.get(groupKey(row)) ?? [];
      let lo = 0;
      let hi = all.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (day - all[mid].day <= HISTORY_DAYS) hi = mid;
        else lo = mid + 1;
      }
      if (all.length - lo < 3) continue;
      const recent = all.slice(Math.max(lo, all.length - 12));
      reference = median(recent.map((item) => item.timeS));
      const logs = recent.map((item) => Math.log(item.timeS / reference!));
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
    if (!options.withinDayCausal) for (const other of slots.get(repSlot(row)) ?? []) if (other.log.athleteId !== row.log.athleteId) candidates.push(["swap", other.timeS]);
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

function slotIndex(rows: Iterable<TrainingRep>): Map<string, TrainingRep[]> {
  const slots = new Map<string, TrainingRep[]>();
  for (const row of rows) {
    if (!isPlausibleRep(row)) continue;
    const list = slots.get(repSlot(row));
    if (list) list.push(row);
    else slots.set(repSlot(row), [row]);
  }
  return slots;
}

/** Suspects for the whole team, each athlete checked against teammates for swapped times (one index of rep slots for everyone). */
export function teamSuspects(team: Map<string, TrainingRep[]>, options: QualityOptions = {}): Map<string, Suspect> {
  const out = new Map<string, Suspect>();
  const from = options.fromDay ?? Number.NEGATIVE_INFINITY;
  const slots = slotIndex([...team.values()].flat().filter((row) => dayNumber(row.date) >= from));
  for (const rows of team.values()) for (const [id, suspect] of findSuspects(rows, slots, options)) out.set(id, suspect);
  return out;
}

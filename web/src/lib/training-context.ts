import { WEEKDAYS, parseIsoDate, weekStartMonday } from "./dates";
import { formatDistance } from "./distances";
import { BLOCK_LABEL, SHIFT_LABEL, STROKE_LABEL, strokeLabel } from "./labels";
import { workoutMeters } from "./rankings";
import { formatSendOff } from "./send-off";
import { flattenInner, formatGear, innerCount, INTENSITY_LABEL, splitRepNumber } from "./set";
import { hasClockTime, toCentiseconds } from "./swim-time";
import type {
  BlockType,
  Gear,
  Intensity,
  PoolCourse,
  Shift,
  Stroke,
  TimeLog,
  Workout,
  WorkoutBlock,
  WellnessEntry,
} from "./types";

export const INTENSITY_LOAD: Record<Intensity, number> = {
  SUAVE: 0.35,
  A1: 0.55,
  A2: 0.8,
  A3: 1,
  PA: 1.2,
  MAX: 1.4,
  P50: 1.45,
  P100: 1.35,
  P200: 1.25,
  P400: 1.15,
};

const INTENSITY_RANK: Record<Intensity, number> = {
  SUAVE: 0,
  A1: 1,
  A2: 2,
  A3: 3,
  PA: 4,
  MAX: 5,
  P50: 5.5,
  P100: 5.2,
  P200: 4.8,
  P400: 4.4,
};

export const MONTH_LABEL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export type RepSlot = "first" | "middle" | "last";
export type RestVsSet = "less" | "same" | "more";
export type FatigueBand = "fresco" | "médio" | "carregado" | "muito carregado";

export type TrainingRep = {
  log: TimeLog;
  timeS: number;
  workoutId: string;
  workoutTitle: string;
  date: string;
  month: number;
  weekday: number;
  weekdayLabel: string;
  shift: Shift;
  course: PoolCourse | "";
  sessionIndex: number;
  trainedEarlierToday: boolean;
  dayLoadBeforeM: number;
  blockType: BlockType;
  blockId: string;
  round: number;
  innerRep: number;
  segmentIndex: number;
  segmentReps: number;
  repInSegment: number;
  distanceM: number;
  setShape: string;
  intensity: Intensity;
  restSeconds: number | null;
  restLabel: string;
  restBucket: string;
  restVsSet: RestVsSet;
  fromBlock: boolean;
  gear: Gear[];
  gearLabel: string;
  stroke: Stroke | "";
  mixedIntensity: boolean;
  easierMiddle: boolean;
  strokeChanged: boolean;
  mixedStroke: boolean;
  slot: RepSlot;
  loadBeforeM: number;
  loadBeforeWeighted: number;
  loadBeforeBucket: string;
  weeklyLoadM: number;
  weeklyBucket: string;
  fatigue: number;
  fatigueBand: FatigueBand;
  sleepHours: number | null;
  gymType: WellnessEntry["gym"];
};

export type TrainingFilters = {
  distances: number[];
  setShapes: string[];
  intensities: Intensity[];
  restBuckets: string[];
  fromBlock: "" | "block" | "below";
  weekdays: number[];
  shifts: Shift[];
  trainedEarlier: "" | "yes" | "no";
  strokes: Array<Stroke | "none">;
  gears: Array<Gear | "none">;
  months: number[];
  slots: RepSlot[];
  restVsSet: RestVsSet[];
  easierMiddle: "" | "yes" | "no";
  mixedIntensity: "" | "yes" | "no";
  mixedStroke: "" | "yes" | "no";
  courses: PoolCourse[];
  blockTypes: BlockType[];
  loadBuckets: string[];
  weeklyBuckets: string[];
  fatigueBands: FatigueBand[];
};

export type TrainingGroupBy =
  | "intensity"
  | "setShape"
  | "weekday"
  | "shift"
  | "fromBlock"
  | "month"
  | "slot"
  | "trainedEarlier"
  | "stroke"
  | "gear"
  | "restBucket"
  | "fatigueBand"
  | "loadBeforeBucket"
  | "distance";

type SessionSlot = {
  workout: Workout;
  block: WorkoutBlock;
  round: number;
  innerRep: number;
  repNumber: number;
  distanceM: number;
  intensity: Intensity;
  restSeconds: number | null;
  fromBlock: boolean;
  gear: Gear[];
  segmentIndex: number;
  segmentReps: number;
  itemIndex: number;
  setShape: string;
  mixedIntensity: boolean;
  easierMiddle: boolean;
  meanRest: number | null;
  loadBeforeM: number;
  loadBeforeWeighted: number;
};

export const EMPTY_TRAINING_FILTERS: TrainingFilters = {
  distances: [],
  setShapes: [],
  intensities: [],
  restBuckets: [],
  fromBlock: "",
  weekdays: [],
  shifts: [],
  trainedEarlier: "",
  strokes: [],
  gears: [],
  months: [],
  slots: [],
  restVsSet: [],
  easierMiddle: "",
  mixedIntensity: "",
  mixedStroke: "",
  courses: [],
  blockTypes: [],
  loadBuckets: [],
  weeklyBuckets: [],
  fatigueBands: [],
};

export function restBucket(seconds: number | null): string {
  if (seconds == null) return "livre";
  if (seconds <= 40) return "≤40\"";
  if (seconds <= 55) return "45–55\"";
  if (seconds <= 70) return "1'–1'10";
  if (seconds <= 90) return "1'15–1'30";
  if (seconds <= 120) return "1'35–2'";
  return ">2'";
}

export function loadBeforeBucket(meters: number): string {
  if (meters < 400) return "<400 m";
  if (meters < 1500) return "400–1.5 km";
  if (meters < 3000) return "1.5–3 km";
  return ">3 km";
}

export function weeklyBucket(meters: number): string {
  if (meters < 8000) return "<8 km";
  if (meters < 15000) return "8–15 km";
  if (meters < 25000) return "15–25 km";
  return ">25 km";
}

export function fatigueBand(score: number): FatigueBand {
  if (score < 25) return "fresco";
  if (score < 50) return "médio";
  if (score < 75) return "carregado";
  return "muito carregado";
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function easierMiddleOf(details: Array<{ intensity: Intensity }>): boolean {
  if (details.length < 4) return false;
  const first = INTENSITY_RANK[details[0].intensity];
  const last = INTENSITY_RANK[details[details.length - 1].intensity];
  const middle = details.slice(1, -1).map((item) => INTENSITY_RANK[item.intensity]);
  return mean(middle) + 0.2 < (first + last) / 2;
}

function slotOf(itemIndex: number, reps: number): RepSlot {
  if (itemIndex <= 0) return "first";
  if (itemIndex >= reps - 1) return "last";
  return "middle";
}

function restVsMean(rest: number | null, meanRest: number | null): RestVsSet {
  if (rest == null || meanRest == null) return "same";
  const delta = rest - meanRest;
  if (delta <= -8) return "less";
  if (delta >= 8) return "more";
  return "same";
}

function walkWorkout(workout: Workout): SessionSlot[] {
  const slots: SessionSlot[] = [];
  let meters = 0;
  let weighted = 0;
  for (const block of workout.blocks) {
    const inners = flattenInner(block);
    const innerN = Math.max(1, inners.length);
    const rounds = Math.max(1, block.rounds || 1);
    for (let round = 1; round <= rounds; round += 1) {
      for (const inner of inners) {
        const segment = block.segments[inner.segmentIndex];
        const details = segment?.details ?? [];
        const rests = details.map((detail) => detail.sendOffSeconds).filter((value) => value != null);
        slots.push({
          workout,
          block,
          round,
          innerRep: inner.index + 1,
          repNumber: (round - 1) * innerN + inner.index + 1,
          distanceM: inner.distanceM,
          intensity: inner.intensity,
          restSeconds: inner.sendOffSeconds,
          fromBlock: inner.fromBlock,
          gear: inner.gear,
          segmentIndex: inner.segmentIndex,
          segmentReps: segment?.reps ?? 1,
          itemIndex: inner.itemIndex,
          setShape: `${segment?.reps ?? 1}×${formatDistance(inner.distanceM)}`,
          mixedIntensity: new Set(details.map((detail) => detail.intensity)).size > 1,
          easierMiddle: easierMiddleOf(details),
          meanRest: rests.length ? mean(rests) : inner.sendOffSeconds,
          loadBeforeM: meters,
          loadBeforeWeighted: weighted,
        });
        meters += inner.distanceM;
        weighted += inner.distanceM * (INTENSITY_LOAD[inner.intensity] ?? 1);
      }
      if (block.betweenRounds && round < rounds) {
        const extra = block.betweenRounds.distanceM || 0;
        meters += extra;
        weighted += extra * 0.4;
      }
    }
  }
  return slots;
}

function estimateFatigue(input: {
  loadBeforeWeighted: number;
  weeklyLoadM: number;
  trainedEarlierToday: boolean;
  itemIndex: number;
  segmentReps: number;
  restSeconds: number | null;
  sleepHours: number | null;
  gymType: WellnessEntry["gym"];
}): number {
  const restStress =
    input.restSeconds == null ? 0.15 : clamp01((90 - input.restSeconds) / 90);
  const setDepth = clamp01(input.itemIndex / Math.max(1, input.segmentReps - 1));
  const score =
    100 *
    (0.4 * clamp01(input.loadBeforeWeighted / 5000) +
      0.22 * clamp01(input.weeklyLoadM / 35000) +
      0.14 * (input.trainedEarlierToday ? 1 : 0) +
      0.12 * setDepth +
      0.12 * restStress +
      0.08 * (input.sleepHours != null ? clamp01((8 - input.sleepHours) / 4) : 0) +
      0.08 * (input.gymType === "strength" ? 1 : input.gymType === "explosive" ? 0.85 : input.gymType === "mobility" ? 0.15 : 0));
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function annotateTrainingReps(
  workouts: Workout[],
  timeLogs: TimeLog[],
  athleteId: string,
  wellness: WellnessEntry[] = [],
): TrainingRep[] {
  if (!athleteId) return [];
  const mine = workouts
    .filter((workout) => workout.athleteIds.includes(athleteId))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift) || a.id.localeCompare(b.id));
  const logs = timeLogs.filter((log) => log.athleteId === athleteId && hasClockTime(log.mm, log.ss, log.cc));
  const logsByKey = new Map<string, TimeLog>();
  for (const log of logs) {
    logsByKey.set(`${log.workoutId}:${log.blockId}:${log.repNumber}`, log);
  }

  const byDate = new Map<string, Workout[]>();
  for (const workout of mine) {
    const list = byDate.get(workout.date) ?? [];
    list.push(workout);
    byDate.set(workout.date, list);
  }

  const observedMeters = new Map<string, number>();
  const observedLoads = new Map<string, { meters: number; weighted: number }>();
  for (const workout of mine) {
    let meters = 0;
    let weighted = 0;
    for (const slot of walkWorkout(workout)) {
      const log = logsByKey.get(`${workout.id}:${slot.block.id}:${slot.repNumber}`);
      observedLoads.set(`${workout.id}:${slot.block.id}:${slot.repNumber}`, { meters, weighted });
      if (log?.skipped) continue;
      meters += slot.distanceM;
      weighted += slot.distanceM * (INTENSITY_LOAD[slot.intensity] ?? 1);
    }
    observedMeters.set(workout.id, meters);
  }

  const weeklyCache = new Map<string, number>();
  function weekMetersUntil(date: string, beforeWorkoutId: string, dayLoadBeforeM: number, sessionLoad: number): number {
    const start = weekStartMonday(date);
    const key = `${start}:${date}:${beforeWorkoutId}`;
    const cached = weeklyCache.get(key);
    if (cached != null) return cached + sessionLoad;
    let total = 0;
    for (const workout of mine) {
      if (workout.date < start || workout.date > date) continue;
      if (workout.date < date) total += observedMeters.get(workout.id) ?? 0;
      else if (workout.id === beforeWorkoutId) total += dayLoadBeforeM;
    }
    weeklyCache.set(key, total);
    return total + sessionLoad;
  }

  const rows: TrainingRep[] = [];
  for (const workout of mine) {
    const sameDay = byDate.get(workout.date) ?? [];
    const sessionIndex = sameDay.findIndex((item) => item.id === workout.id) + 1;
    const trainedEarlierToday = sessionIndex > 1;
    const dayLoadBeforeM = sameDay
      .slice(0, Math.max(0, sessionIndex - 1))
      .reduce((sum, item) => sum + (observedMeters.get(item.id) ?? 0), 0);
    const date = parseIsoDate(workout.date);
    const dayWellness = wellness.find((entry) => entry.date === workout.date);
    const weekday = (date.getDay() + 6) % 7;
    const slots = walkWorkout(workout);
    const observedCounts = new Map<string, number>();
    for (const slot of slots) {
      const log = logsByKey.get(`${workout.id}:${slot.block.id}:${slot.repNumber}`);
      if (log?.skipped) continue;
      const key = `${slot.block.id}:${slot.round}:${slot.segmentIndex}`;
      observedCounts.set(key, (observedCounts.get(key) ?? 0) + 1);
    }
    const strokesBySet = new Map<string, Set<string>>();
    for (const slot of slots) {
      const log = logsByKey.get(`${workout.id}:${slot.block.id}:${slot.repNumber}`);
      if (!log?.stroke) continue;
      const key = `${slot.block.id}:${slot.round}:${slot.segmentIndex}`;
      const set = strokesBySet.get(key) ?? new Set<string>();
      set.add(log.stroke);
      strokesBySet.set(key, set);
    }
    let previousStroke: Stroke | "" = "";
    const observedPositions = new Map<string, number>();
    for (const slot of slots) {
      const log = logsByKey.get(`${workout.id}:${slot.block.id}:${slot.repNumber}`);
      if (!log || log.skipped) {
        previousStroke = "";
        continue;
      }
      const setKey = `${slot.block.id}:${slot.round}:${slot.segmentIndex}`;
      const observedReps = observedCounts.get(setKey) ?? 1;
      const observedPosition = (observedPositions.get(setKey) ?? 0) + 1;
      observedPositions.set(setKey, observedPosition);
      const observedLoad = observedLoads.get(`${workout.id}:${slot.block.id}:${slot.repNumber}`) ?? {
        meters: 0,
        weighted: 0,
      };
      const weeklyLoadM = weekMetersUntil(workout.date, workout.id, dayLoadBeforeM, observedLoad.meters);
      const fatigue = estimateFatigue({
        loadBeforeWeighted: observedLoad.weighted + dayLoadBeforeM * 0.7,
        weeklyLoadM,
        trainedEarlierToday,
        itemIndex: observedPosition - 1,
        segmentReps: observedReps,
        restSeconds: slot.restSeconds,
          sleepHours: dayWellness?.sleepHours ?? null,
          gymType: dayWellness?.gym ?? null,
      });
      const strokeChanged = Boolean(previousStroke && log.stroke && previousStroke !== log.stroke);
      const mixedStroke =
        (strokesBySet.get(`${slot.block.id}:${slot.round}:${slot.segmentIndex}`)?.size ?? 0) > 1;
      rows.push({
        log,
        timeS: toCentiseconds(log.mm, log.ss, log.cc) / 100,
        workoutId: workout.id,
        workoutTitle: workout.title,
        date: workout.date,
        month: date.getMonth() + 1,
        weekday,
        weekdayLabel: WEEKDAYS[weekday] ?? "",
        shift: workout.shift,
        course: workout.course || "",
        sessionIndex,
        trainedEarlierToday,
        dayLoadBeforeM,
        blockType: slot.block.type,
        blockId: slot.block.id,
        round: slot.round,
        innerRep: slot.innerRep,
        segmentIndex: slot.segmentIndex,
        segmentReps: observedReps,
        repInSegment: observedPosition,
        distanceM: slot.distanceM,
        setShape: `${observedReps}×${formatDistance(slot.distanceM)}`,
        intensity: slot.intensity,
        restSeconds: slot.restSeconds,
        restLabel: formatSendOff(slot.restSeconds),
        restBucket: restBucket(slot.restSeconds),
        restVsSet: restVsMean(slot.restSeconds, slot.meanRest),
        fromBlock: slot.fromBlock,
        gear: slot.gear,
        gearLabel: formatGear(slot.gear),
        stroke: log.stroke || "",
        mixedIntensity: slot.mixedIntensity,
        easierMiddle: slot.easierMiddle,
        strokeChanged,
        mixedStroke,
        slot: slotOf(observedPosition - 1, observedReps),
        loadBeforeM: observedLoad.meters + dayLoadBeforeM,
        loadBeforeWeighted: observedLoad.weighted + dayLoadBeforeM * 0.7,
        loadBeforeBucket: loadBeforeBucket(observedLoad.meters + dayLoadBeforeM),
        weeklyLoadM,
        weeklyBucket: weeklyBucket(weeklyLoadM),
        fatigue,
        fatigueBand: fatigueBand(fatigue),
        sleepHours: dayWellness?.sleepHours ?? null,
        gymType: dayWellness?.gym ?? null,
      });
      previousStroke = log.stroke || previousStroke;
    }
  }
  return rows;
}

function allows<T>(selected: T[], value: T): boolean {
  return selected.length === 0 || selected.includes(value);
}

export function matchTrainingFilters(row: TrainingRep, filters: TrainingFilters): boolean {
  if (!allows(filters.distances, row.distanceM)) return false;
  if (!allows(filters.setShapes, row.setShape)) return false;
  if (!allows(filters.intensities, row.intensity)) return false;
  if (!allows(filters.restBuckets, row.restBucket)) return false;
  if (filters.fromBlock === "block" && !row.fromBlock) return false;
  if (filters.fromBlock === "below" && row.fromBlock) return false;
  if (!allows(filters.weekdays, row.weekday)) return false;
  if (!allows(filters.shifts, row.shift)) return false;
  if (filters.trainedEarlier === "yes" && !row.trainedEarlierToday) return false;
  if (filters.trainedEarlier === "no" && row.trainedEarlierToday) return false;
  if (filters.strokes.length) {
    const key = row.stroke || "none";
    if (!filters.strokes.includes(key)) return false;
  }
  if (filters.gears.length) {
    const none = filters.gears.includes("none") && row.gear.length === 0;
    const hit = row.gear.some((item) => filters.gears.includes(item));
    if (!none && !hit) return false;
  }
  if (!allows(filters.months, row.month)) return false;
  if (!allows(filters.slots, row.slot)) return false;
  if (!allows(filters.restVsSet, row.restVsSet)) return false;
  if (filters.easierMiddle === "yes" && !row.easierMiddle) return false;
  if (filters.easierMiddle === "no" && row.easierMiddle) return false;
  if (filters.mixedIntensity === "yes" && !row.mixedIntensity) return false;
  if (filters.mixedIntensity === "no" && row.mixedIntensity) return false;
  if (filters.mixedStroke === "yes" && !row.mixedStroke) return false;
  if (filters.mixedStroke === "no" && row.mixedStroke) return false;
  if (filters.courses.length && (!row.course || !filters.courses.includes(row.course))) return false;
  if (!allows(filters.blockTypes, row.blockType)) return false;
  if (!allows(filters.loadBuckets, row.loadBeforeBucket)) return false;
  if (!allows(filters.weeklyBuckets, row.weeklyBucket)) return false;
  if (!allows(filters.fatigueBands, row.fatigueBand)) return false;
  return true;
}

export function filterTrainingReps(rows: TrainingRep[], filters: TrainingFilters): TrainingRep[] {
  return rows.filter((row) => matchTrainingFilters(row, filters));
}

export function statsOf(values: number[]): { n: number; mean: number; sd: number; best: number; worst: number; median: number } {
  if (!values.length) return { n: 0, mean: 0, sd: 0, best: 0, worst: 0, median: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = mean(sorted);
  const variance = mean(sorted.map((value) => (value - avg) ** 2));
  const mid = Math.floor(sorted.length / 2);
  return {
    n: sorted.length,
    mean: avg,
    sd: Math.sqrt(variance),
    best: sorted[0],
    worst: sorted[sorted.length - 1],
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
  };
}

export function groupTrainingReps(
  rows: TrainingRep[],
  by: TrainingGroupBy,
): Array<{ key: string; label: string; rows: TrainingRep[] }> {
  const buckets = new Map<string, TrainingRep[]>();
  for (const row of rows) {
    const key = groupKey(row, by);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .map(([key, list]) => ({ key, label: groupLabel(list[0], by), rows: list }))
    .sort((a, b) => mean(a.rows.map((row) => row.timeS)) - mean(b.rows.map((row) => row.timeS)));
}

function groupKey(row: TrainingRep, by: TrainingGroupBy): string {
  switch (by) {
    case "intensity":
      return row.intensity;
    case "setShape":
      return row.setShape;
    case "weekday":
      return String(row.weekday);
    case "shift":
      return row.shift;
    case "fromBlock":
      return row.fromBlock ? "block" : "below";
    case "month":
      return String(row.month);
    case "slot":
      return row.slot;
    case "trainedEarlier":
      return row.trainedEarlierToday ? "yes" : "no";
    case "stroke":
      return row.stroke || "none";
    case "gear":
      return row.gearLabel || "none";
    case "restBucket":
      return row.restBucket;
    case "fatigueBand":
      return row.fatigueBand;
    case "loadBeforeBucket":
      return row.loadBeforeBucket;
    case "distance":
      return String(row.distanceM);
  }
}

export function groupLabel(row: TrainingRep, by: TrainingGroupBy): string {
  switch (by) {
    case "intensity":
      return INTENSITY_LABEL[row.intensity];
    case "setShape":
      return row.setShape;
    case "weekday":
      return row.weekdayLabel;
    case "shift":
      return SHIFT_LABEL[row.shift];
    case "fromBlock":
      return row.fromBlock ? "Bloco" : "De baixo";
    case "month":
      return MONTH_LABEL[row.month - 1] ?? String(row.month);
    case "slot":
      return row.slot === "first" ? "1.ª rep" : row.slot === "last" ? "Última" : "Meio";
    case "trainedEarlier":
      return row.trainedEarlierToday ? "Já treinou hoje" : "1.º treino do dia";
    case "stroke":
      return strokeLabel(row.stroke) || "Sem estilo";
    case "gear":
      return row.gearLabel || "Sem material";
    case "restBucket":
      return row.restBucket === "livre" ? "Sem intervalo" : row.restBucket;
    case "fatigueBand":
      return row.fatigueBand;
    case "loadBeforeBucket":
      return row.loadBeforeBucket;
    case "distance":
      return `${formatDistance(row.distanceM)} m`;
  }
}

export const GROUP_BY_LABEL: Record<TrainingGroupBy, string> = {
  intensity: "Intensidade",
  setShape: "Forma da série",
  weekday: "Dia da semana",
  shift: "Horário",
  fromBlock: "Partida",
  month: "Mês",
  slot: "Posição na série",
  trainedEarlier: "Já treinou hoje",
  stroke: "Estilo",
  gear: "Material",
  restBucket: "Descanso",
  fatigueBand: "Cansaço",
  loadBeforeBucket: "Carga antes",
  distance: "Distância",
};

export const SLOT_LABEL: Record<RepSlot, string> = {
  first: "1.ª rep",
  middle: "Meio",
  last: "Última",
};

export const REST_VS_LABEL: Record<RestVsSet, string> = {
  less: "Descansa menos",
  same: "Descanso igual",
  more: "Descansa mais",
};

export function uniqueSorted<T>(values: T[], compare?: (a: T, b: T) => number): T[] {
  const unique = [...new Set(values)];
  return compare ? unique.sort(compare) : unique.sort();
}

export function seriesKey(workoutId: string, blockId: string, segmentIndex: number): string {
  return `${workoutId}:${blockId}:${segmentIndex}`;
}

export function logSeriesKey(workout: Workout, log: TimeLog): string | null {
  const block = workout.blocks.find((item) => item.id === log.blockId);
  if (!block) return null;
  const split = splitRepNumber(log.repNumber, innerCount(block) || 1);
  const inner = flattenInner(block)[split.innerRep - 1];
  if (!inner) return null;
  return seriesKey(workout.id, block.id, inner.segmentIndex);
}

export function logRound(workout: Workout, log: TimeLog): number {
  const block = workout.blocks.find((item) => item.id === log.blockId);
  if (!block) return 1;
  return splitRepNumber(log.repNumber, innerCount(block) || 1).round;
}

export { BLOCK_LABEL, INTENSITY_LABEL, SHIFT_LABEL, STROKE_LABEL };

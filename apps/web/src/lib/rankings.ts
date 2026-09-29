import { tx } from "@/i18n";
import { addDays, weekStartMonday } from "./dates";
import { analyzeRace, sessionForEntry } from "./race";
import { betweenRoundsCount } from "./set";
import { toCentiseconds } from "./swim-time";
import type {
  Competition,
  DayPart,
  MeetEntry,
  MeetResult,
  PoolCourse,
  RaceSession,
  SeedRecord,
  Stroke,
  TimeLog,
  Workout,
} from "./types";

export type RaceRecord = {
  id: string;
  sessionId?: string;
  resultId?: string;
  entryId: string;
  athleteId: string;
  competitionId: string;
  date: string;
  dayPart: DayPart;
  course: PoolCourse;
  stroke: Stroke;
  distanceM: number;
  timeS: number;
  venue: string;
  meetTitle: string;
};

// World Aquatics Points base times (1000 points), official document "Points - Base Times SCM and LCM 2026".
// SCM valid 01.09.2026–31.08.2027, LCM valid 01.01.2026–31.12.2026. Keyed gender:course:stroke:distance.
const BASE: Record<string, number> = {
  "M:scm:free:50": 19.9,
  "M:scm:free:100": 44.84,
  "M:scm:free:200": 98.61,
  "M:scm:free:400": 212.25,
  "M:scm:free:800": 440.46,
  "M:scm:free:1500": 846.88,
  "M:scm:back:50": 22.11,
  "M:scm:back:100": 48.16,
  "M:scm:back:200": 105.12,
  "M:scm:breast:50": 24.95,
  "M:scm:breast:100": 55.28,
  "M:scm:breast:200": 119.52,
  "M:scm:fly:50": 21.32,
  "M:scm:fly:100": 47.68,
  "M:scm:fly:200": 106.85,
  "M:scm:im:100": 49.28,
  "M:scm:im:200": 108.88,
  "M:scm:im:400": 234.81,
  "F:scm:free:50": 22.83,
  "F:scm:free:100": 49.93,
  "F:scm:free:200": 109.36,
  "F:scm:free:400": 230.25,
  "F:scm:free:800": 474.0,
  "F:scm:free:1500": 908.24,
  "F:scm:back:50": 25.23,
  "F:scm:back:100": 54.02,
  "F:scm:back:200": 117.33,
  "F:scm:breast:50": 28.37,
  "F:scm:breast:100": 62.36,
  "F:scm:breast:200": 132.5,
  "F:scm:fly:50": 23.72,
  "F:scm:fly:100": 52.71,
  "F:scm:fly:200": 119.32,
  "F:scm:im:100": 55.11,
  "F:scm:im:200": 121.63,
  "F:scm:im:400": 255.48,
  "M:lcm:free:50": 20.91,
  "M:lcm:free:100": 46.4,
  "M:lcm:free:200": 102.0,
  "M:lcm:free:400": 219.96,
  "M:lcm:free:800": 452.12,
  "M:lcm:free:1500": 870.67,
  "M:lcm:back:50": 23.55,
  "M:lcm:back:100": 51.6,
  "M:lcm:back:200": 111.92,
  "M:lcm:breast:50": 25.95,
  "M:lcm:breast:100": 56.88,
  "M:lcm:breast:200": 125.48,
  "M:lcm:fly:50": 22.27,
  "M:lcm:fly:100": 49.45,
  "M:lcm:fly:200": 110.34,
  "M:lcm:im:200": 112.69,
  "M:lcm:im:400": 242.5,
  "F:lcm:free:50": 23.61,
  "F:lcm:free:100": 51.71,
  "F:lcm:free:200": 112.23,
  "F:lcm:free:400": 234.18,
  "F:lcm:free:800": 484.12,
  "F:lcm:free:1500": 920.48,
  "F:lcm:back:50": 26.86,
  "F:lcm:back:100": 57.13,
  "F:lcm:back:200": 123.14,
  "F:lcm:breast:50": 29.16,
  "F:lcm:breast:100": 64.13,
  "F:lcm:breast:200": 137.55,
  "F:lcm:fly:50": 24.43,
  "F:lcm:fly:100": 54.6,
  "F:lcm:fly:200": 121.81,
  "F:lcm:im:200": 125.7,
  "F:lcm:im:400": 263.65,
};

/**
 * World Aquatics points: floor(1000 × (base / time)³), truncated as the official tables do.
 * Base times differ by gender, so points are only returned when the athlete's gender is known.
 */
export function finaPoints(
  timeS: number,
  course: PoolCourse,
  stroke: Stroke,
  distanceM: number,
  gender: "M" | "F" | "" | undefined,
): number {
  if (gender !== "M" && gender !== "F") return 0;
  const base = BASE[`${gender}:${course}:${stroke}:${distanceM}`];
  if (!base || timeS <= 0) return 0;
  // Official tables work on hundredths; round first so e.g. 24.65 isn't 24.649999.
  const time = Math.round(timeS * 100) / 100;
  return Math.floor(1000 * (base / time) ** 3 + 1e-9);
}

export function meetEnd(meet: Competition): string {
  return meet.endDate && meet.endDate >= meet.date ? meet.endDate : meet.date;
}

function timeFromResult(result: MeetResult): number {
  return toCentiseconds(result.mm, result.ss, result.cc) / 100;
}

export function raceRecords(
  competitions: Competition[],
  entries: MeetEntry[],
  results: MeetResult[],
  sessions: RaceSession[],
  athleteId: string,
  seeds: SeedRecord[] = [],
): RaceRecord[] {
  const out: RaceRecord[] = [];
  for (const seed of seeds) {
    const timeS = toCentiseconds(seed.mm, seed.ss, seed.cc) / 100;
    if (timeS <= 0) continue;
    const id = `seed-${athleteId}-${seed.course}-${seed.stroke}-${seed.distanceM}`;
    out.push({
      id,
      entryId: id,
      athleteId,
      competitionId: "",
      date: seed.date,
      dayPart: "am",
      course: seed.course,
      stroke: seed.stroke,
      distanceM: seed.distanceM,
      timeS,
      venue: "",
      meetTitle: tx("Recorde pessoal"),
    });
  }
  for (const entry of entries.filter((item) => item.athleteId === athleteId)) {
    const meet = competitions.find((item) => item.id === entry.competitionId);
    if (!meet) continue;
    const session = sessionForEntry(sessions, entry, meet.id);
    const result = results.find((item) => item.entryId === entry.id);
    const view = session ? analyzeRace(session) : null;
    // The official result is the truth; an analysis total only fills in when there is none.
    const timeS = (result ? timeFromResult(result) : 0) || view?.totalTime || (session?.officialTimeS ?? 0);
    if (timeS <= 0) continue;
    out.push({
      id: session?.id ?? `r-${result?.id ?? entry.id}`,
      sessionId: session?.id,
      resultId: result?.id,
      entryId: entry.id,
      athleteId,
      competitionId: meet.id,
      date: session?.date || meet.date,
      dayPart: session?.dayPart ?? "am",
      course: meet.course,
      stroke: entry.stroke,
      distanceM: entry.distanceM,
      timeS,
      venue: meet.venue,
      meetTitle: meet.title,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.timeS - b.timeS);
}

export function personalBests(records: RaceRecord[]): RaceRecord[] {
  const best = new Map<string, RaceRecord>();
  for (const record of records) {
    const key = `${record.course}:${record.stroke}:${record.distanceM}`;
    const current = best.get(key);
    if (!current || record.timeS < current.timeS) best.set(key, record);
  }
  return [...best.values()].sort((a, b) => a.distanceM - b.distanceM || a.stroke.localeCompare(b.stroke) || a.course.localeCompare(b.course));
}

export function eventKey(stroke: Stroke, distanceM: number): string {
  return `${stroke}-${distanceM}`;
}

export function parseEventKey(key: string): { stroke: Stroke; distanceM: number } | null {
  const [stroke, raw] = key.split("-");
  const distanceM = Number(raw);
  if (!["free", "back", "breast", "fly", "im"].includes(stroke) || !Number.isFinite(distanceM) || distanceM <= 0) {
    return null;
  }
  return { stroke: stroke as Stroke, distanceM };
}

export function eventRecords(
  records: RaceRecord[],
  stroke: Stroke,
  distanceM: number,
  course?: PoolCourse,
): RaceRecord[] {
  return records.filter(
    (record) =>
      record.stroke === stroke &&
      record.distanceM === distanceM &&
      (!course || record.course === course),
  );
}

export function weeklyVolume(workouts: Workout[], athleteId: string, weeks = 8, endDate?: string) {
  const end = endDate || new Date().toISOString().slice(0, 10);
  const monday = weekStartMonday(end);
  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(monday, -7 * (weeks - 1 - index));
    const last = addDays(start, 6);
    const meters = workouts
      .filter((workout) => workout.athleteIds.includes(athleteId) && workout.date >= start && workout.date <= last)
      .reduce((sum, workout) => sum + workoutMeters(workout), 0);
    return { start, end: last, meters };
  });
}

export function sliceRecords(records: RaceRecord[], mode: "last" | "best"): RaceRecord[] {
  const sorted = mode === "best" ? [...records].sort((a, b) => a.timeS - b.timeS) : [...records].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.slice(0, 10);
}

export function findRecord(records: RaceRecord[], id: string): RaceRecord | undefined {
  return records.find((record) => record.id === id || record.sessionId === id || record.resultId === id);
}

export function timeDelta(fromS: number, toS: number): { seconds: number; pct: number } {
  if (!fromS || !toS) return { seconds: 0, pct: 0 };
  return { seconds: toS - fromS, pct: ((toS - fromS) / fromS) * 100 };
}

export function workoutMeters(workout: Workout): number {
  return workout.blocks.reduce((sum, block) => {
    const rounds = Math.max(1, block.rounds || 1);
    const setMeters = block.segments.reduce(
      (inner, segment) => inner + rounds * (segment.reps || 0) * (segment.distanceM || 0),
      0,
    );
    const between = betweenRoundsCount(rounds, block.betweenRounds) * (block.betweenRounds?.distanceM || 0);
    return sum + setMeters + between;
  }, 0);
}

export function athleteVolumeM(workouts: Workout[], athleteId: string, from?: string, to?: string): number {
  if (!athleteId) return 0;
  return workouts
    .filter(
      (workout) =>
        workout.athleteIds.includes(athleteId) &&
        (!from || workout.date >= from) &&
        (!to || workout.date <= to),
    )
    .reduce((sum, workout) => sum + workoutMeters(workout), 0);
}

export function formatMeters(meters: number): string {
  if (!meters) return "0 m";
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function trainingAround(
  workouts: Workout[],
  timeLogs: TimeLog[],
  athleteId: string,
  raceDate: string,
): {
  weekMeters: number;
  prevMeters: number;
  form: "descarga" | "estável" | "carga alta";
  logs: TimeLog[];
  weekWorkouts: Workout[];
} {
  const start = weekStartMonday(raceDate);
  const end = addDays(start, 6);
  const prevStart = addDays(start, -7);
  const inWeek = (workout: Workout, from: string, to: string) =>
    workout.date >= from && workout.date <= to && workout.athleteIds.includes(athleteId);
  const weekWorkouts = workouts.filter((workout) => inWeek(workout, start, end));
  const prevWorkouts = workouts.filter((workout) => inWeek(workout, prevStart, addDays(start, -1)));
  const weekMeters = weekWorkouts.reduce((sum, workout) => sum + workoutMeters(workout), 0);
  const prevMeters = prevWorkouts.reduce((sum, workout) => sum + workoutMeters(workout), 0);
  const ratio = prevMeters > 0 ? weekMeters / prevMeters : 1;
  const form = ratio > 1.15 ? "carga alta" : ratio < 0.7 ? "descarga" : "estável";
  const windowStart = addDays(raceDate, -14);
  const logs = timeLogs.filter((log) => {
    if (log.athleteId !== athleteId) return false;
    const workout = workouts.find((item) => item.id === log.workoutId);
    return Boolean(workout && workout.date >= windowStart && workout.date <= raceDate);
  });
  return { weekMeters, prevMeters, form, logs, weekWorkouts };
}

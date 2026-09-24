import { addDays, weekStartMonday } from "./dates";
import { analyzeRace, sessionForEntry } from "./race";
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

const BASE: Record<string, number> = {
  "lcm:free:50": 20.91,
  "lcm:free:100": 46.4,
  "lcm:free:200": 102.0,
  "lcm:free:400": 220.0,
  "lcm:free:800": 452.0,
  "lcm:free:1500": 858.0,
  "scm:free:50": 20.16,
  "scm:free:100": 44.84,
  "scm:free:200": 99.0,
  "scm:free:400": 212.0,
  "scm:free:800": 436.0,
  "scm:free:1500": 833.0,
  "lcm:back:50": 23.55,
  "lcm:back:100": 51.6,
  "lcm:back:200": 111.0,
  "scm:back:50": 22.22,
  "scm:back:100": 48.9,
  "scm:back:200": 106.0,
  "lcm:breast:50": 25.95,
  "lcm:breast:100": 56.88,
  "lcm:breast:200": 126.0,
  "scm:breast:50": 24.95,
  "scm:breast:100": 55.28,
  "scm:breast:200": 121.0,
  "lcm:fly:50": 22.27,
  "lcm:fly:100": 49.45,
  "lcm:fly:200": 110.0,
  "scm:fly:50": 21.5,
  "scm:fly:100": 47.78,
  "scm:fly:200": 106.0,
  "lcm:im:200": 114.0,
  "lcm:im:400": 243.0,
  "scm:im:100": 49.8,
  "scm:im:200": 110.0,
  "scm:im:400": 235.0,
};

export function finaPoints(timeS: number, course: PoolCourse, stroke: Stroke, distanceM: number): number {
  const base = BASE[`${course}:${stroke}:${distanceM}`];
  if (!base || timeS <= 0) return 0;
  return Math.floor(1000 * (base / timeS) ** 3);
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
      meetTitle: "Recorde pessoal",
    });
  }
  for (const entry of entries.filter((item) => item.athleteId === athleteId)) {
    const meet = competitions.find((item) => item.id === entry.competitionId);
    if (!meet) continue;
    const session = sessionForEntry(sessions, entry, meet.id);
    const result = results.find((item) => item.entryId === entry.id);
    const view = session ? analyzeRace(session) : null;
    const timeS = view?.totalTime || (session?.officialTimeS ?? 0) || (result ? timeFromResult(result) : 0);
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
    const between =
      block.betweenRounds && rounds > 1 ? (rounds - 1) * (block.betweenRounds.distanceM || 0) : 0;
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

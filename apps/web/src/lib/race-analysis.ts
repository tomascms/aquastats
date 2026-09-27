import type { MessageKey } from "@/i18n";
import { hydrateLaps, isDetailedRace, markMeta, poolLength, raceMarkRows, roundHundredths, type RaceMarkRow } from "./race";
import type { RaceLap, RaceSession } from "./types";

/*
 * Derived race metrics on top of what the coach enters in "Adicionar informação".
 * Everything is computed from the stored marks, so nothing new has to be typed.
 */

export type SegmentMetric = {
  from: number;
  to: number;
  timeS: number;
  /** m/s over the segment. */
  velocity: number;
  /** strokes per minute (cycles), as stored. */
  sr: number;
  /** metres per stroke cycle = velocity × 60 / SR. */
  dps: number;
  /** stroke index = velocity × DPS. */
  strokeIndex: number;
  kind: SegmentKind;
};

export type SegmentKind = "start" | "swim" | "turn" | "finish";

export const SEGMENT_KIND_LABEL: Record<SegmentKind, MessageKey> = {
  start: "Partida",
  swim: "Nado",
  turn: "Viragem",
  finish: "Chegada",
};

function metric(from: number, to: number, timeS: number, sr: number, kind: SegmentKind): SegmentMetric {
  const velocity = timeS > 0 ? (to - from) / timeS : 0;
  const dps = sr > 0 && velocity > 0 ? (velocity * 60) / sr : 0;
  return { from, to, timeS, velocity, sr, dps, strokeIndex: velocity * dps, kind };
}

/** Classifies each measured segment: 0–15 is the start, the segment crossing a wall is a turn, the last is the finish. */
export function raceSegments(session: RaceSession): SegmentMetric[] {
  const laps = hydrateLaps(session.laps, session.distanceM, session.course);
  const rows = raceMarkRows(laps, session.distanceM, session.course, session.stroke);
  const pool = poolLength(session.course);
  const out: SegmentMetric[] = [];
  let previous = 0;
  rows.forEach((row, index) => {
    if (row.tempo <= 0 || (index > 0 && previous <= 0)) {
      previous = row.tempo;
      return;
    }
    const from = index === 0 ? 0 : rows[index - 1].atM;
    const time = roundHundredths(row.tempo - (index === 0 ? 0 : previous));
    // A segment that starts at a wall (push-off + underwater + breakout) is the turn.
    const offWall = from > 0 && from % pool === 0;
    const kind: SegmentKind = index === 0 ? "start" : row.isFinish ? "finish" : offWall ? "turn" : "swim";
    out.push(metric(from, row.atM, time, row.sr, kind));
    previous = row.tempo;
  });
  return out;
}

export type RaceSummary = {
  finalS: number;
  reactionS: number;
  startS: number; // time at 15 m
  avgVelocity: number;
  avgSr: number;
  avgDps: number;
  underwater: { lap: number; timeS: number; distanceM: number; kicks: number }[];
  /** Speed lost from the fastest swim segment to the last one (%). */
  fadePct: number;
};

export function raceSummary(session: RaceSession): RaceSummary {
  const segments = raceSegments(session);
  const laps = hydrateLaps(session.laps, session.distanceM, session.course);
  const rows = raceMarkRows(laps, session.distanceM, session.course, session.stroke);
  const finish = rows.find((row) => row.isFinish);
  const finalS = finish?.tempo || session.officialTimeS || 0;
  const withSr = segments.filter((segment) => segment.sr > 0);
  // Free-swimming segments only: the start is faster by nature and the finish includes the touch.
  const swim = segments.filter((segment) => segment.kind === "swim");
  const fastest = Math.max(0, ...swim.map((segment) => segment.velocity));
  const last = swim.at(-1)?.velocity ?? 0;
  return {
    finalS,
    reactionS: session.reactionS || 0,
    startS: rows.find((row) => row.atM === 15)?.tempo || 0,
    avgVelocity: finalS > 0 ? session.distanceM / finalS : 0,
    avgSr: withSr.length ? withSr.reduce((sum, segment) => sum + segment.sr, 0) / withSr.length : 0,
    avgDps: withSr.length ? withSr.reduce((sum, segment) => sum + segment.dps, 0) / withSr.length : 0,
    underwater: laps
      .map((lap: RaceLap, index) => ({ lap: index + 1, timeS: lap.uw || 0, distanceM: lap.uwd || 0, kicks: lap.uwKicks || 0 }))
      .filter((item) => item.timeS > 0 || item.distanceM > 0 || item.kicks > 0),
    fadePct: fastest > 0 && last > 0 ? ((fastest - last) / fastest) * 100 : 0,
  };
}

/** How much of the analysis sheet is filled in: every editable cell counts once. */
export function raceCompleteness(session: Pick<RaceSession, "laps" | "distanceM" | "course" | "stroke" | "reactionS" | "flightS">): {
  filled: number;
  total: number;
} {
  const laps = hydrateLaps(session.laps, session.distanceM, session.course);
  const rows: RaceMarkRow[] = raceMarkRows(laps, session.distanceM, session.course, session.stroke);
  let filled = 0;
  let total = 0;
  const count = (value: number) => {
    total += 1;
    if (value > 0) filled += 1;
  };
  count(session.reactionS);
  count(session.flightS);
  for (const row of rows) {
    count(row.tempo);
    if (row.showUw) {
      count(row.uwKicks);
      count(row.uwd);
      count(row.breakS);
    }
    if (row.showScSr) count(row.sc);
  }
  return { filled, total };
}

export type SegmentDelta = {
  from: number;
  to: number;
  kind: SegmentKind;
  a: number;
  b: number;
  delta: number; // b − a; negative = B faster
};

/** Segment-by-segment comparison of two swims of the same event and pool. */
export function compareRaces(a: RaceSession, b: RaceSession): { segments: SegmentDelta[]; byKind: Record<SegmentKind, number>; total: number } {
  const segA = raceSegments(a);
  const segB = raceSegments(b);
  const segments: SegmentDelta[] = [];
  for (const left of segA) {
    const right = segB.find((item) => item.from === left.from && item.to === left.to);
    if (!right) continue;
    segments.push({ from: left.from, to: left.to, kind: left.kind, a: left.timeS, b: right.timeS, delta: roundHundredths(right.timeS - left.timeS) });
  }
  const byKind: Record<SegmentKind, number> = { start: 0, swim: 0, turn: 0, finish: 0 };
  for (const item of segments) byKind[item.kind] = roundHundredths(byKind[item.kind] + item.delta);
  return { segments, byKind, total: roundHundredths(segments.reduce((sum, item) => sum + item.delta, 0)) };
}

export function comparable(a: RaceSession, b: RaceSession): boolean {
  return a.id !== b.id && a.distanceM === b.distanceM && a.stroke === b.stroke && a.course === b.course;
}

/**
 * Parses pasted times (one per line, or tab/semicolon separated — as copied from Excel or Dartfish).
 * Accepts 1:02.34, 1'02"34, 62.34, 62,34 and 6234 (hundredths). Empty cells stay 0.
 */
export function parsePastedTimes(text: string): number[] {
  return text
    .split(/[\r\n\t;]+/)
    .map((raw) => raw.trim())
    .filter((raw, index, all) => raw !== "" || index < all.length - 1)
    .map(parseTime);
}

export function parseTime(raw: string): number {
  const value = raw.trim().replace(",", ".");
  if (!value) return 0;
  const clock = /^(?:(\d{1,2})[:'])?(\d{1,2})(?:[."](\d{1,2}))?"?$/.exec(value);
  if (clock && (clock[1] || clock[3])) {
    const minutes = Number(clock[1] || 0);
    const seconds = Number(clock[2]);
    const hundredths = clock[3] ? Number(clock[3].padEnd(2, "0")) : 0;
    return roundHundredths(minutes * 60 + seconds + hundredths / 100);
  }
  if (/^\d+$/.test(value) && value.length >= 3) return roundHundredths(Number(value) / 100);
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? roundHundredths(number) : 0;
}

export function isDetailedSession(session: Pick<RaceSession, "distanceM">): boolean {
  return isDetailedRace(session.distanceM);
}

export { markMeta };

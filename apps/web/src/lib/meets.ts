import type { MeetEntry, PoolCourse, Stroke } from "./types";

export const MEET_EVENTS: Array<{ stroke: Stroke; distanceM: number }> = [
  ...[50, 100, 200, 400, 800, 1500].map((distanceM) => ({ stroke: "free" as const, distanceM })),
  ...([50, 100, 200] as const).flatMap((distanceM) =>
    (["back", "breast", "fly"] as const).map((stroke) => ({ stroke, distanceM })),
  ),
  ...[100, 200, 400].map((distanceM) => ({ stroke: "im" as const, distanceM })),
];

export function isOfficialEvent(stroke: Stroke, distanceM: number, course: PoolCourse): boolean {
  if (distanceM < 50) return false;
  if (course === "lcm" && stroke === "im" && distanceM === 100) return false;
  return MEET_EVENTS.some((event) => event.stroke === stroke && event.distanceM === distanceM);
}

export function eventsForCourse(course: PoolCourse): Array<{ stroke: Stroke; distanceM: number }> {
  return MEET_EVENTS.filter((event) => isOfficialEvent(event.stroke, event.distanceM, course));
}

export function eventKey(stroke: Stroke, distanceM: number): string {
  return `${stroke}:${distanceM}`;
}

export function hasEntry(
  entries: MeetEntry[],
  competitionId: string,
  athleteId: string,
  stroke: Stroke,
  distanceM: number,
): boolean {
  return entries.some(
    (entry) =>
      entry.competitionId === competitionId &&
      entry.athleteId === athleteId &&
      entry.stroke === stroke &&
      entry.distanceM === distanceM,
  );
}

export function raceSplitMarks(distanceM: number, course: PoolCourse): number[] {
  const step = course === "scm" && distanceM <= 50 ? 25 : 50;
  const marks: number[] = [];
  for (let meters = step; meters < distanceM; meters += step) marks.push(meters);
  return marks;
}

export function seedSplitMarks(distanceM: number): number[] {
  const marks: number[] = [];
  for (let meters = 50; meters < distanceM; meters += 50) marks.push(meters);
  return marks;
}

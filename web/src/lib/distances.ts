export const MIN_DISTANCE = 5;
export const MAX_DISTANCE = 2000;

const PRESETS = [5, 7.5, 10, 12.5, 15, 20, 25, 30, 35, 50, 75, 100];

export const DISTANCES: number[] = [
  ...PRESETS,
  ...Array.from({ length: (MAX_DISTANCE - 150) / 50 + 1 }, (_, index) => 150 + index * 50),
];

export function sameMeters(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05;
}

export function formatDistance(meters: number): string {
  const rounded = Number.isInteger(meters) ? meters : Math.round(meters * 10) / 10;
  return String(rounded).replace(".", ",");
}

export function snapDistance(value: number | null | undefined): number {
  if (!value || value < MIN_DISTANCE) return 0;
  const match = DISTANCES.find((item) => sameMeters(item, value));
  if (match != null) return match;
  const extra = DISTANCES.filter((item) => item >= value);
  return extra[0] ?? DISTANCES[DISTANCES.length - 1];
}

export type SplitChoice = {
  atM: number;
  label: string;
};

export function lastFiveMark(distanceM: number): number | null {
  const lastFive = Math.round((distanceM - 5) * 10) / 10;
  if (lastFive <= 0 || lastFive >= distanceM - 0.04) return null;
  return lastFive;
}

export function splitChoices(distanceM: number): SplitChoice[] {
  const lastFive = lastFiveMark(distanceM);
  const marks = DISTANCES.filter((item) => item < distanceM - 0.04);
  if (lastFive != null && !marks.some((item) => sameMeters(item, lastFive))) {
    marks.push(lastFive);
    marks.sort((a, b) => a - b);
  }
  return marks.map((atM) => ({
    atM,
    label: lastFive != null && sameMeters(atM, lastFive) ? "últ. 5" : `${formatDistance(atM)}m`,
  }));
}

export function cleanSplitMarks(marks: number[] | undefined, distanceM: number): number[] {
  const allowed = splitChoices(distanceM);
  const unique: number[] = [];
  for (const mark of marks ?? []) {
    const match = allowed.find((item) => sameMeters(item.atM, mark));
    if (match && !unique.some((item) => sameMeters(item, match.atM))) unique.push(match.atM);
  }
  return unique.sort((a, b) => a - b);
}

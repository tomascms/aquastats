import { localizedMap } from "@/i18n";
import { cleanSplitMarks, formatDistance, formatReps, MIN_DISTANCE } from "./distances";
import { DEFAULT_SEND_OFF, snapSendOff } from "./send-off";
import type { BlockType, DraftBlock, Gear, Intensity, RepDetail, SegmentBand, SegmentPart, SetSegment, WorkoutBlock, WorkoutStroke } from "./types";

export const INTENSITIES: Intensity[] = ["SUAVE", "A1", "A2", "A3", "PROG", "PA", "MAX", "P50", "P100", "P200", "P400"];

export const INTENSITY_LABEL = localizedMap<Intensity>({
  SUAVE: "Suave",
  A1: "A1",
  A2: "A2",
  A3: "A3",
  PROG: "Prog",
  PA: "PA",
  MAX: "MAX",
  P50: "Ritmo 50",
  P100: "Ritmo 100",
  P200: "Ritmo 200",
  P400: "Ritmo 400",
});

/** Warmup and cool-down never take a logged time, whatever the intensity chosen inside them. */
export function needsClockTime(intensity: Intensity, blockType?: BlockType): boolean {
  if (blockType && blockType !== "main") return false;
  return intensity !== "SUAVE" && intensity !== "A1";
}

export const GEARS: Gear[] = ["legs", "arms", "paddles", "pullbuoy", "parachute", "fins"];

export const GEAR_LABEL = localizedMap<Gear>({
  legs: "Pernas",
  arms: "Braços",
  paddles: "Palas",
  pullbuoy: "Pullbuoy",
  parachute: "Paraquedas",
  fins: "Barbatanas",
});

export const WORKOUT_STROKES: WorkoutStroke[] = ["free", "back", "breast", "fly", "im", "sub"];

export const WORKOUT_STROKE_LABEL = localizedMap<WorkoutStroke>({
  free: "Livres",
  back: "Costas",
  breast: "Bruços",
  fly: "Mariposa",
  im: "Estilos",
  sub: "Subaquático",
});

function cleanStroke(stroke: WorkoutStroke | "" | undefined): WorkoutStroke | "" {
  return stroke && WORKOUT_STROKES.includes(stroke) ? stroke : "";
}

const MAX_PARTS = 6;

function cleanParts(parts: SegmentPart[] | undefined): SegmentPart[] | undefined {
  const cleaned = (parts ?? [])
    .map((part) => ({
      distanceM: Math.max(0, Math.round(Number(part?.distanceM) || 0)),
      intensity: (INTENSITIES.includes(part?.intensity) ? part.intensity : "A1") as Intensity,
      stroke: cleanStroke(part?.stroke),
    }))
    .filter((part) => part.distanceM > 0)
    .slice(0, MAX_PARTS);
  return cleaned.length >= 2 ? cleaned : undefined;
}

export type FlatInner = {
  index: number;
  segmentIndex: number;
  itemIndex: number;
  distanceM: number;
  intensity: Intensity;
  sendOffSeconds: number | null;
  fromBlock: boolean;
  gear: Gear[];
  stroke: WorkoutStroke | "";
  parts?: SegmentPart[];
  splitMarks: number[];
  isLast: boolean;
};

export function isReadySegment(segment: SetSegment): boolean {
  return segment.reps >= 1 && segment.distanceM >= MIN_DISTANCE;
}

function cleanGear(gear: Gear[] | undefined): Gear[] {
  const unique = new Set((gear ?? []).filter((item) => GEARS.includes(item)));
  return GEARS.filter((item) => unique.has(item));
}

export function makeDetail(source: {
  intensity: Intensity;
  sendOffSeconds: number;
  fromBlock: boolean;
  gear: Gear[];
  stroke?: WorkoutStroke | "";
}): RepDetail {
  return {
    intensity: source.intensity,
    sendOffSeconds: snapSendOff(source.sendOffSeconds),
    fromBlock: Boolean(source.fromBlock),
    gear: cleanGear(source.gear),
    stroke: cleanStroke(source.stroke),
  };
}

function resizeDetails(details: RepDetail[] | undefined, count: number, fill: RepDetail): RepDetail[] {
  const current = (details ?? []).map((detail) => makeDetail(detail));
  if (current.length === count) return current;
  if (current.length > count) return current.slice(0, count);
  const seed = current[current.length - 1] ?? fill;
  return [...current, ...Array.from({ length: count - current.length }, () => makeDetail(seed))];
}

export function emptySegment(): SetSegment {
  const defaults = {
    intensity: "A1" as Intensity,
    sendOffSeconds: DEFAULT_SEND_OFF,
    fromBlock: false,
    gear: [] as Gear[],
    stroke: "" as WorkoutStroke | "",
  };
  return {
    reps: 1,
    distanceM: 0,
    ...defaults,
    splitMarks: [],
    details: [makeDetail(defaults)],
  };
}

export function readySegments(block: Pick<WorkoutBlock, "segments">): SetSegment[] {
  return (block.segments ?? []).filter(isReadySegment);
}

export function innerCount(block: Pick<WorkoutBlock, "segments">): number {
  return readySegments(block).reduce((sum, segment) => sum + segment.reps, 0);
}

export function totalReps(block: Pick<WorkoutBlock, "rounds" | "segments">): number {
  return Math.max(1, block.rounds) * innerCount(block);
}

/** Cumulative distances at each part's boundary (the marks needed to record each chunk's time). */
export function partSplitMarks(parts: SegmentPart[] | undefined): number[] {
  if (!parts || parts.length < 2) return [];
  let running = 0;
  const marks: number[] = [];
  for (const part of parts.slice(0, -1)) {
    running += part.distanceM;
    marks.push(running);
  }
  return marks;
}

export function flattenInner(block: Pick<WorkoutBlock, "segments" | "noSendOff">): FlatInner[] {
  const rows: FlatInner[] = [];
  readySegments(block).forEach((segment, segmentIndex) => {
    const splitMarks = [...new Set([...(segment.splitMarks ?? []), ...partSplitMarks(segment.parts)])].sort((a, b) => a - b);
    for (let itemIndex = 0; itemIndex < segment.reps; itemIndex += 1) {
      const detail = segment.details[itemIndex] ?? makeDetail(segment);
      rows.push({
        index: rows.length,
        segmentIndex,
        itemIndex,
        distanceM: segment.distanceM,
        intensity: detail.intensity,
        sendOffSeconds: block.noSendOff ? null : detail.sendOffSeconds,
        fromBlock: detail.fromBlock,
        gear: detail.gear,
        stroke: detail.stroke ?? "",
        parts: segment.parts,
        splitMarks,
        isLast: false,
      });
    }
  });
  if (rows.length) rows[rows.length - 1].isLast = true;
  return rows;
}

export function formatGear(gear: Gear[] | undefined): string {
  return (gear ?? []).map((item) => GEAR_LABEL[item]).join(" ");
}

/** "25 Prog + 25 A1", or with strokes "25 Prog Mariposa + 25 A1 Livres". */
export function formatParts(parts: SegmentPart[]): string {
  return parts
    .map((part) => `${formatDistance(part.distanceM)} ${INTENSITY_LABEL[part.intensity] || part.intensity}${part.stroke ? ` ${WORKOUT_STROKE_LABEL[part.stroke]}` : ""}`)
    .join(" + ");
}

export function formatSegment(segment: SetSegment): string {
  if (segment.parts?.length) {
    return `${formatReps(segment.reps, segment.distanceM)} (${formatParts(segment.parts)})`;
  }
  const details = segment.details.length ? segment.details : [makeDetail(segment)];
  const intensities = [...new Set(details.map((detail) => INTENSITY_LABEL[detail.intensity] || detail.intensity))];
  const vel = intensities.join("/");
  const gears = details.map((detail) => formatGear(detail.gear));
  const sameGear = gears.every((item) => item === gears[0]);
  const gear = sameGear ? gears[0] : "";
  const strokes = details.map((detail) => detail.stroke || "");
  const sameStroke = strokes.every((item) => item === strokes[0]);
  const stroke = sameStroke && strokes[0] ? WORKOUT_STROKE_LABEL[strokes[0] as WorkoutStroke] : "";
  return `${formatReps(segment.reps, segment.distanceM)} ${vel}${stroke ? ` ${stroke}` : ""}${gear ? ` ${gear}` : ""}`;
}

export function formatSet(block: Pick<WorkoutBlock, "rounds" | "segments">): string {
  const segments = readySegments(block);
  if (!segments.length) return "—";
  const inner = segments.map(formatSegment).join(" + ");
  if (block.rounds <= 1) return inner;
  return `${block.rounds}×(${inner})`;
}

export function flatRepNumber(round: number, innerRep: number, innerReps: number): number {
  return (round - 1) * innerReps + innerRep;
}

export function splitRepNumber(flat: number, innerReps: number): { round: number; innerRep: number } {
  const count = Math.max(1, innerReps);
  const index = Math.max(0, flat - 1);
  return {
    round: Math.floor(index / count) + 1,
    innerRep: (index % count) + 1,
  };
}

export function normalizeSegment(segment: Partial<SetSegment> | undefined): SetSegment {
  const base = emptySegment();
  const reps = Math.max(1, segment?.reps || 1);
  const next: SetSegment = {
    reps,
    distanceM: Math.max(0, segment?.distanceM || 0),
    intensity: segment?.intensity ?? base.intensity,
    sendOffSeconds: snapSendOff(segment?.sendOffSeconds ?? base.sendOffSeconds),
    fromBlock: Boolean(segment?.fromBlock),
    gear: cleanGear(segment?.gear),
    stroke: cleanStroke(segment?.stroke),
    splitMarks: cleanSplitMarks(segment?.splitMarks, Math.max(0, segment?.distanceM || 0)),
    details: [],
  };
  next.details = resizeDetails(segment?.details, reps, makeDetail(next));
  const bands = cleanBands(segment?.bands);
  if (bands.length) next.bands = bands;
  const parts = cleanParts(segment?.parts);
  if (parts) next.parts = parts;
  return next;
}

function cleanBands(bands: SegmentBand[] | undefined): SegmentBand[] {
  const seen = new Set<string>();
  return (bands ?? [])
    .map((band) => ({ group: String(band?.group ?? "").trim().slice(0, 40), sendOffSeconds: snapSendOff(band?.sendOffSeconds) }))
    .filter((band) => band.group && !seen.has(band.group) && seen.add(band.group));
}

/** Send-off a swimmer of `group` actually leaves on for this rep. */
export function sendOffFor(segment: SetSegment | undefined, detailSendOff: number | null, group?: string): number | null {
  if (detailSendOff == null || !segment?.bands?.length || !group) return detailSendOff;
  return segment.bands.find((band) => band.group === group)?.sendOffSeconds ?? detailSendOff;
}

export function applySegmentDefaults(
  segment: SetSegment,
  patch: Partial<Pick<SetSegment, "intensity" | "sendOffSeconds" | "fromBlock" | "gear" | "stroke">>,
): SetSegment {
  const next = normalizeSegment({ ...segment, ...patch });
  return {
    ...next,
    details: next.details.map((detail) =>
      makeDetail({
        intensity: patch.intensity ?? detail.intensity,
        sendOffSeconds: patch.sendOffSeconds ?? detail.sendOffSeconds,
        fromBlock: patch.fromBlock ?? detail.fromBlock,
        gear: patch.gear ?? detail.gear,
        stroke: "stroke" in patch ? patch.stroke : detail.stroke,
      }),
    ),
  };
}

export function resizeSegment(segment: SetSegment, reps: number): SetSegment {
  return normalizeSegment({ ...segment, reps });
}

export function updateRepDetail(segment: SetSegment, index: number, patch: Partial<RepDetail>): SetSegment {
  const next = normalizeSegment(segment);
  return {
    ...next,
    details: next.details.map((detail, itemIndex) => (itemIndex === index ? makeDetail({ ...detail, ...patch }) : detail)),
  };
}

export function toggleRepGear(segment: SetSegment, index: number, gear: Gear): SetSegment {
  const detail = segment.details[index] ?? makeDetail(segment);
  const has = detail.gear.includes(gear);
  return updateRepDetail(segment, index, {
    gear: has ? detail.gear.filter((item) => item !== gear) : [...detail.gear, gear],
  });
}

export function toggleGear(segment: SetSegment, gear: Gear): SetSegment {
  const has = segment.gear.includes(gear);
  return applySegmentDefaults(segment, {
    gear: has ? segment.gear.filter((item) => item !== gear) : [...segment.gear, gear],
  });
}

/** Sets, or clears with "", the stroke swum in the whole segment (every rep, unless split into parts). */
export function setSegmentStroke(segment: SetSegment, stroke: WorkoutStroke | ""): SetSegment {
  return applySegmentDefaults(segment, { stroke });
}

/** Splits every rep of the segment into ordered chunks, each with its own pace and, optionally, stroke. */
export function setSegmentParts(segment: SetSegment, parts: SegmentPart[] | undefined): SetSegment {
  const next = normalizeSegment({ ...segment, parts: parts ?? [] });
  if (!parts?.length) next.parts = undefined;
  return next;
}

export function emptyPart(distanceM = MIN_DISTANCE): SegmentPart {
  return { distanceM, intensity: "A1", stroke: "" };
}

export function normalizeDraft(block: DraftBlock): DraftBlock {
  const rounds = Math.max(1, block.rounds || 1);
  const segments = (block.segments?.length ? block.segments : [emptySegment()]).map(normalizeSegment);
  return {
    id: block.id,
    type: block.type,
    rounds,
    noSendOff: Boolean(block.noSendOff),
    segments,
    betweenRounds: rounds > 1 ? block.betweenRounds : null,
  };
}

const BLOCK_ORDER: Record<BlockType, number> = { warmup: 0, main: 1, recovery: 2 };

export function orderDraftBlocks(blocks: DraftBlock[]): DraftBlock[] {
  return blocks
    .map((block, index) => ({ block, index }))
    .sort((a, b) => (BLOCK_ORDER[a.block.type] - BLOCK_ORDER[b.block.type]) || a.index - b.index)
    .map(({ block }) => block);
}

export function persistDraft(block: DraftBlock): DraftBlock {
  const next = normalizeDraft(block);
  return {
    ...next,
    segments: next.segments.filter(isReadySegment),
  };
}

export function emptyBlock(type: BlockType = "main"): DraftBlock {
  return normalizeDraft({
    type,
    rounds: 1,
    noSendOff: type !== "main",
    segments: [emptySegment()],
    betweenRounds: null,
  });
}

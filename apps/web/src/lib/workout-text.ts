import { BLOCK_LABEL, SHIFT_LABEL, formatDatePt } from "./labels";
import { formatSendOff } from "./send-off";
import { formatDistance } from "./distances";
import { INTENSITY_LABEL, formatGear, makeDetail, readySegments } from "./set";
import type { RepDetail, SetSegment, Workout, WorkoutBlock } from "./types";

function sameDetail(a: RepDetail, b: RepDetail): boolean {
  return (
    a.intensity === b.intensity &&
    a.sendOffSeconds === b.sendOffSeconds &&
    a.fromBlock === b.fromBlock &&
    formatGear(a.gear) === formatGear(b.gear)
  );
}

function formatDetail(detail: RepDetail, noSendOff: boolean, showStart: boolean): string {
  const gear = formatGear(detail.gear);
  const start = showStart ? (detail.fromBlock ? "bloco" : "de baixo") : "";
  const send = noSendOff ? "" : ` a ${formatSendOff(detail.sendOffSeconds)}`;
  return `${INTENSITY_LABEL[detail.intensity] || detail.intensity} ${gear ? `${gear} ` : ""}${start}${send}`.replace(/\s+/g, " ").trim();
}

function ordinalRange(from: number, to: number, lastIndex: number): string {
  if (from === to) {
    if (from === lastIndex) return "última";
    return `${from + 1}ª`;
  }
  if (to === lastIndex && from === 0) return `${from + 1}ª–última`;
  return `${from + 1}ª–${to + 1}ª`;
}

export type WrittenLine = {
  text: string;
  indent: number;
};

export function writtenSegmentLines(segment: SetSegment, noSendOff: boolean, showStart = true): WrittenLine[] {
  const details = segment.details.length ? segment.details : [makeDetail(segment)];
  const head = `${segment.reps}×${formatDistance(segment.distanceM)}`;
  if (details.every((detail) => sameDetail(detail, details[0]))) {
    return [{ text: `${head} ${formatDetail(details[0], noSendOff, showStart)}`.trim(), indent: 0 }];
  }

  const lines: WrittenLine[] = [{ text: head, indent: 0 }];
  let start = 0;
  for (let index = 1; index <= details.length; index += 1) {
    if (index < details.length && sameDetail(details[index], details[start])) continue;
    lines.push({
      text: `${ordinalRange(start, index - 1, details.length - 1)} ${formatDetail(details[start], noSendOff, showStart)}`,
      indent: 1,
    });
    start = index;
  }
  return lines;
}

export function writtenBlockLines(
  block: Pick<WorkoutBlock, "rounds" | "segments" | "noSendOff" | "betweenRounds"> & { type?: WorkoutBlock["type"] },
): WrittenLine[] {
  const segments = readySegments(block);
  if (!segments.length) return [{ text: "—", indent: 0 }];
  const showStart = block.type !== "warmup" && block.type !== "recovery";

  const inner = segments.flatMap((segment) => writtenSegmentLines(segment, block.noSendOff, showStart));
  const lines: WrittenLine[] =
    block.rounds > 1
      ? [{ text: `${block.rounds}×`, indent: 0 }, ...inner.map((line) => ({ ...line, indent: line.indent + 1 }))]
      : inner;
  if (block.noSendOff) lines.push({ text: "Sem saídas", indent: 0 });
  if (block.betweenRounds && block.rounds > 1) {
    lines.push({ text: `Suave entre séries: ${formatDistance(block.betweenRounds.distanceM)}m`, indent: 0 });
  }
  return lines;
}

export function workoutPlainText(workout: Workout): string {
  const parts = [
    workout.title,
    `${formatDatePt(workout.date)} · ${SHIFT_LABEL[workout.shift]}`,
    "",
  ];
  for (const block of workout.blocks) {
    parts.push(BLOCK_LABEL[block.type]);
    for (const line of writtenBlockLines(block)) {
      parts.push(line.indent ? `${"  ".repeat(line.indent)}${line.text}` : line.text);
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}

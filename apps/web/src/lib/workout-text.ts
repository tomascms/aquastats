import { getLocale, tx } from "@/i18n";
import { BLOCK_LABEL, SHIFT_LABEL, displayTitle, formatDatePt } from "./labels";
import { formatSendOff } from "./send-off";
import { formatDistance, formatReps } from "./distances";
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
  const start = showStart ? (detail.fromBlock ? tx("bloco") : tx("de baixo")) : "";
  const send = noSendOff ? "" : ` ${tx("a {time}", { time: formatSendOff(detail.sendOffSeconds) })}`;
  return `${INTENSITY_LABEL[detail.intensity] || detail.intensity} ${gear ? `${gear} ` : ""}${start}${send}`.replace(/\s+/g, " ").trim();
}

/** 1-based ordinal: "1ª" in Portuguese, "1st" in English. */
function ordinal(n: number): string {
  if (getLocale() === "pt") return `${n}ª`;
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

function ordinalRange(from: number, to: number, lastIndex: number): string {
  if (from === to) {
    if (from === lastIndex) return tx("última");
    return ordinal(from + 1);
  }
  if (to === lastIndex && from === 0) return `${ordinal(from + 1)}–${tx("última")}`;
  return `${ordinal(from + 1)}–${ordinal(to + 1)}`;
}

export type WrittenLine = {
  text: string;
  indent: number;
};

function bandLine(segment: SetSegment, noSendOff: boolean): WrittenLine[] {
  if (noSendOff || !segment.bands?.length) return [];
  return [
    {
      text: segment.bands.map((band) => tx("Grupo {group} a {time}", { group: band.group, time: formatSendOff(band.sendOffSeconds) })).join(" · "),
      indent: 1,
    },
  ];
}

export function writtenSegmentLines(segment: SetSegment, noSendOff: boolean, showStart = true): WrittenLine[] {
  const details = segment.details.length ? segment.details : [makeDetail(segment)];
  const head = formatReps(segment.reps, segment.distanceM);
  if (details.every((detail) => sameDetail(detail, details[0]))) {
    return [{ text: `${head} ${formatDetail(details[0], noSendOff, showStart)}`.trim(), indent: 0 }, ...bandLine(segment, noSendOff)];
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
  return [...lines, ...bandLine(segment, noSendOff)];
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
  if (block.noSendOff) lines.push({ text: tx("Sem saídas"), indent: 0 });
  if (block.betweenRounds && block.rounds > 1) {
    lines.push({ text: tx("Suave entre séries: {distance}m", { distance: formatDistance(block.betweenRounds.distanceM) }), indent: 0 });
  }
  return lines;
}

export function workoutPlainText(workout: Workout): string {
  const parts = [
    displayTitle(workout.title),
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

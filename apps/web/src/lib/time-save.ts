"use client";

import { sameMeters } from "./distances";
import {
  commitClockParts,
  hasClockTime,
  isEmptyParts,
  isSubMinuteDistance,
  isValidSeconds,
  normalizeParts,
} from "./swim-time";
import type { CellRef, SplitTime, Stroke, TimeLog, TimeParts } from "./types";

const DEBOUNCE_MS = 500;

export type TimeSavePayload = {
  payload: Record<string, unknown>;
  logKey: string;
  deleting: boolean;
  idempotencyKey: string;
};

type Scheduled = TimeSavePayload & { retry: () => Promise<void> };

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Map<string, Promise<void>>();
const scheduled = new Map<string, Scheduled>();

export function timeQueueKey(workoutId: string, cell: CellRef, splitAt: number | null) {
  return `${workoutId}:${cell.blockId}:${cell.athleteId}:${cell.repNumber}:${splitAt ?? "final"}`;
}

export function logKeyFromCell(workoutId: string, cell: CellRef) {
  return `${workoutId}:${cell.blockId}:${cell.athleteId}:${cell.repNumber}`;
}

export function isTimeComplete(parts: TimeParts, distanceM?: number | null): boolean {
  const next = commitClockParts(parts);
  if (isEmptyParts(next) || !isValidSeconds(next.ss)) return false;
  if (isSubMinuteDistance(distanceM)) return next.ss.length === 2;
  return next.ss.length === 2 && next.cc.length === 2;
}

export function buildTimeDraft(
  workoutId: string,
  cell: CellRef,
  parts: TimeParts,
  splitAt: number | null,
  stroke: Stroke | "",
  existing: TimeLog | undefined,
  skipped = false,
): TimeSavePayload | null {
  parts = commitClockParts(parts);
  if (!isEmptyParts(parts) && !isValidSeconds(parts.ss)) return null;
  const empty = isEmptyParts(parts);
  const normalized = empty ? { mm: 0, ss: 0, cc: 0 } : normalizeParts(parts);
  const nextStroke = stroke || existing?.stroke || "free";
  const splits: SplitTime[] = [...(existing?.splits ?? [])].filter((split) => hasClockTime(split.mm, split.ss, split.cc));
  let mm = existing?.mm ?? 0;
  let ss = existing?.ss ?? 0;
  let cc = existing?.cc ?? 0;
  let hasFinal = hasClockTime(mm, ss, cc);

  if (splitAt == null) {
    hasFinal = !empty;
    mm = empty ? 0 : normalized.mm;
    ss = empty ? 0 : normalized.ss;
    cc = empty ? 0 : normalized.cc;
  } else if (empty) {
    const index = splits.findIndex((item) => sameMeters(item.atM, splitAt));
    if (index >= 0) splits.splice(index, 1);
  } else {
    const nextSplit: SplitTime = { atM: splitAt, mm: normalized.mm, ss: normalized.ss, cc: normalized.cc };
    const index = splits.findIndex((item) => sameMeters(item.atM, splitAt));
    if (index >= 0) splits[index] = nextSplit;
    else splits.push(nextSplit);
    splits.sort((a, b) => a.atM - b.atM);
  }

  const logKey = logKeyFromCell(workoutId, cell);
  const deleting = !hasFinal && splits.length === 0 && !skipped;
  const recordedAt = existing?.recordedAt ?? new Date().toISOString();
  const stableId = existing?.id ?? crypto.randomUUID();
  const idempotencyKey = `time-${logKey}-${stableId}`;

  const payload = deleting
    ? {
        id: existing?.id ?? "",
        workoutId,
        blockId: cell.blockId,
        athleteId: cell.athleteId,
        repNumber: cell.repNumber,
        mm: 0,
        ss: 0,
        cc: 0,
        splits: [],
        stroke: nextStroke,
        skipped: false,
        recordedAt,
      }
    : {
        id: stableId,
        workoutId,
        blockId: cell.blockId,
        athleteId: cell.athleteId,
        repNumber: cell.repNumber,
        mm,
        ss,
        cc,
        splits,
        stroke: nextStroke,
        skipped,
        recordedAt,
      };

  return { payload, logKey, deleting, idempotencyKey };
}

export function cancelScheduledTimeSave(queueKey: string) {
  const timer = debounceTimers.get(queueKey);
  if (timer) clearTimeout(timer);
  debounceTimers.delete(queueKey);
}

export function scheduleTimeSave(
  queueKey: string,
  draft: TimeSavePayload,
  execute: () => Promise<void>,
  options: { immediate?: boolean; complete?: boolean },
): Promise<void> {
  scheduled.set(queueKey, { ...draft, retry: execute });
  cancelScheduledTimeSave(queueKey);

  if (options.immediate || draft.deleting) {
    return runTimeSave(queueKey, execute);
  }
  if (!options.complete) {
    return inflight.get(queueKey) ?? Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    debounceTimers.set(
      queueKey,
      setTimeout(() => {
        runTimeSave(queueKey, execute).then(resolve).catch(reject);
      }, DEBOUNCE_MS),
    );
  });
}

async function runTimeSave(queueKey: string, execute: () => Promise<void>) {
  cancelScheduledTimeSave(queueKey);
  const previous = inflight.get(queueKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(execute);
  inflight.set(queueKey, next);
  try {
    await next;
    if (scheduled.get(queueKey)?.retry === execute) scheduled.delete(queueKey);
  } finally {
    if (inflight.get(queueKey) === next) inflight.delete(queueKey);
  }
}

export async function flushTimeSave(queueKey: string): Promise<void> {
  const item = scheduled.get(queueKey);
  if (!item) return inflight.get(queueKey) ?? Promise.resolve();
  return runTimeSave(queueKey, item.retry);
}

export async function flushAllTimeSaves(): Promise<void> {
  const keys = [...scheduled.keys()];
  await Promise.all(keys.map((key) => flushTimeSave(key)));
  await Promise.all([...inflight.values()]);
}

export function listScheduledTimeKeys() {
  return [...scheduled.keys()];
}

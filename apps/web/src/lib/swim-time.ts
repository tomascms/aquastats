import type { TimeParts } from "./types";

export const EMPTY_PARTS: TimeParts = { mm: "", ss: "", cc: "" };

export function padLeft(value: string | number, size = 2): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, size).padStart(size, "0");
}

export function padRight(value: string | number, size = 2): string {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, size);
  if (!digits) return "00";
  return digits.padEnd(size, "0");
}

export function normalizeParts(parts: TimeParts): { mm: number; ss: number; cc: number } {
  return {
    mm: Number.parseInt(padLeft(parts.mm), 10) || 0,
    ss: Number.parseInt(padLeft(parts.ss), 10) || 0,
    cc: Number.parseInt(padRight(parts.cc), 10) || 0,
  };
}

export function formatTime(mm: number, ss: number, cc: number): string {
  return `${padLeft(mm)}'${padLeft(ss)}"${padLeft(cc)}`;
}

export function formatDraft(parts: TimeParts, field: 0 | 1 | 2): {
  mm: string;
  ss: string;
  cc: string;
} {
  const show = (value: string, index: 0 | 1 | 2, pad: "left" | "right") => {
    if (field === index) return value.padEnd(2, "_").slice(0, 2) || "__";
    if (!value) return "__";
    return pad === "right" ? padRight(value) : padLeft(value);
  };

  return {
    mm: show(parts.mm, 0, "left"),
    ss: show(parts.ss, 1, "left"),
    cc: show(parts.cc, 2, "right"),
  };
}

export function toCentiseconds(mm: number, ss: number, cc: number): number {
  return mm * 6000 + ss * 100 + cc;
}

export function fromCentiseconds(cs: number): { mm: number; ss: number; cc: number } {
  const mm = Math.floor(cs / 6000);
  const rem = cs % 6000;
  const ss = Math.floor(rem / 100);
  const cc = rem % 100;
  return { mm, ss, cc };
}

export function isBlankParts(parts: TimeParts): boolean {
  return !parts.mm && !parts.ss && !parts.cc;
}

export function isEmptyParts(parts: TimeParts): boolean {
  if (isBlankParts(parts)) return true;
  const normalized = normalizeParts(parts);
  return normalized.mm === 0 && normalized.ss === 0 && normalized.cc === 0;
}

export function hasClockTime(mm: number, ss: number, cc: number): boolean {
  return Boolean(mm || ss || cc);
}

export function isValidSeconds(ss: string | number): boolean {
  const digits = String(ss ?? "").replace(/\D/g, "");
  if (!digits) return true;
  return Number.parseInt(padLeft(digits), 10) <= 59;
}

export function padClockDigit(field: keyof TimeParts, digits: string): string {
  const clean = String(digits ?? "").replace(/\D/g, "").slice(0, 2);
  if (!clean) return "";
  if (field === "cc") return clean.padEnd(2, "0");
  return clean.padStart(2, "0");
}

export function commitClockParts(parts: TimeParts): TimeParts {
  return {
    mm: padClockDigit("mm", parts.mm),
    ss: padClockDigit("ss", parts.ss),
    cc: padClockDigit("cc", parts.cc),
  };
}

export function canAcceptSecondsDigit(current: string, digit: string): boolean {
  if (current.length >= 2) return false;
  const next = current + digit;
  if (next.length === 1) return true;
  return Number.parseInt(next, 10) <= 59;
}

export function partsFromNumbers(mm: number, ss: number, cc: number): TimeParts {
  return {
    mm: padLeft(mm),
    ss: padLeft(ss),
    cc: padLeft(cc),
  };
}

/** 50 m (and shorter) series are always entered in seconds; minutes stay writable. */
export function isSubMinuteDistance(distanceM: number | null | undefined): boolean {
  return Boolean(distanceM && distanceM > 0 && distanceM <= 50);
}

export function clockStartField(distanceM: number | null | undefined): 0 | 1 | 2 {
  return isSubMinuteDistance(distanceM) ? 1 : 0;
}

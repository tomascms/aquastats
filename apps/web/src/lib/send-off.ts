export const SEND_OFF_MIN = 30;
export const SEND_OFF_MAX = 600;
export const SEND_OFF_STEP = 5;
export const DEFAULT_SEND_OFF = 60;

export const SEND_OFF_OPTIONS: number[] = Array.from(
  { length: (SEND_OFF_MAX - SEND_OFF_MIN) / SEND_OFF_STEP + 1 },
  (_, index) => SEND_OFF_MIN + index * SEND_OFF_STEP,
);

export function snapSendOff(seconds: number | null | undefined): number {
  const value = typeof seconds === "number" && Number.isFinite(seconds) ? seconds : DEFAULT_SEND_OFF;
  const clamped = Math.min(SEND_OFF_MAX, Math.max(SEND_OFF_MIN, value));
  return Math.round(clamped / SEND_OFF_STEP) * SEND_OFF_STEP;
}

export function formatSendOff(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes === 0) return `${rest}"`;
  if (rest === 0) return `${minutes}'`;
  return `${minutes}'${String(rest).padStart(2, "0")}`;
}

export function parseSendOff(raw: string): number {
  const text = raw.trim().replace(/[´′’]/g, "'");
  if (!text) return 60;
  const minuteSeconds = text.match(/^(\d+)\s*'\s*(\d{1,2})?\s*"?$/);
  if (minuteSeconds) {
    return Number(minuteSeconds[1]) * 60 + Number(minuteSeconds[2] || 0);
  }
  const secondsOnly = text.match(/^(\d+)\s*"$/);
  if (secondsOnly) return Number(secondsOnly[1]);
  const colon = text.match(/^(\d+)\s*[:.]\s*(\d{1,2})$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const value = Number(text);
  if (Number.isNaN(value)) return 60;
  return value <= 9 ? value * 60 : value;
}

export function parseSendOffList(raw: string, count: number): number[] {
  const parts = raw
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseSendOff);
  if (!parts.length) return Array.from({ length: count }, () => 60);
  if (parts.length === 1) return Array.from({ length: count }, () => parts[0]);
  return resize(parts, count, parts[parts.length - 1]);
}

export function formatSendOffList(seconds: number[]): string {
  return seconds.map(formatSendOff).join("/");
}

export function resize<T>(values: T[], count: number, fill: T): T[] {
  if (values.length === count) return values;
  if (values.length > count) return values.slice(0, count);
  const last = values[values.length - 1] ?? fill;
  return [...values, ...Array.from({ length: count - values.length }, () => last)];
}

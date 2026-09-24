export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addMonths(isoDay: string, delta: number): string {
  const date = parseIsoDate(isoDay);
  date.setMonth(date.getMonth() + delta);
  return toIsoDate(date);
}

export function monthLabel(isoDay: string): string {
  const label = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(parseIsoDate(isoDay));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function weekdayIndexMonday(isoDay: string): number {
  return (parseIsoDate(isoDay).getDay() + 6) % 7;
}

export function daysInMonth(isoDay: string): number {
  const date = parseIsoDate(isoDay);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function monthDays(isoDay: string): Array<string | null> {
  const date = parseIsoDate(isoDay);
  const first = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  const leading = weekdayIndexMonday(first);
  const total = daysInMonth(isoDay);
  const cells: Array<string | null> = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function addDays(isoDay: string, delta: number): string {
  const date = parseIsoDate(isoDay);
  date.setDate(date.getDate() + delta);
  return toIsoDate(date);
}

export function eachIsoDay(start: string, end: string): string[] {
  const first = start <= end ? start : end;
  const last = start <= end ? end : start;
  const days: string[] = [];
  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) days.push(cursor);
  return days;
}

export function weekStartMonday(isoDay: string): string {
  return addDays(isoDay, -weekdayIndexMonday(isoDay));
}

export function inDateRange(iso: string, start: string, end?: string): boolean {
  const last = end && end >= start ? end : start;
  return iso >= start && iso <= last;
}

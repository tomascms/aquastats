import { intlLocale, localizedMap as localized, tx } from "@/i18n";
import type { BlockType, PoolCourse, Shift, Stroke } from "./types";

export const STROKE_LABEL = localized<Stroke>({
  free: "Livres",
  back: "Costas",
  breast: "Bruços",
  fly: "Mariposa",
  im: "Estilos",
});

export const STROKES: Stroke[] = ["free", "back", "breast", "fly", "im"];

export function asStroke(value: string | null | undefined): Stroke | "" {
  return STROKES.includes(value as Stroke) ? (value as Stroke) : "";
}

export function strokeLabel(value?: string | null): string {
  return STROKES.includes(value as Stroke) ? STROKE_LABEL[value as Stroke] : "";
}

export const SHIFT_LABEL = localized<Shift>({
  morning: "Manhã",
  afternoon: "Tarde",
});

export const BLOCK_LABEL = localized<BlockType>({
  warmup: "Aquecimento",
  main: "Tarefa",
  recovery: "Soltar",
});

export const COURSE_LABEL: Record<PoolCourse, string> = {
  scm: "25 m",
  lcm: "50 m",
};

export function courseLabel(value?: string | null): string {
  return value === "scm" || value === "lcm" ? COURSE_LABEL[value] : "";
}

export const GENDER_LABEL = localized<"M" | "F">({
  M: "Masculino",
  F: "Feminino",
});

export const TEAM_NAME = "Equipa A";
export const COACH_NAME = "Treinador";
export const JOIN_CODE = "EQUIPAA";

export const DAY_PART_LABEL = localized<"am" | "pm">({
  am: "Manhã",
  pm: "Tarde",
});

export function formatDatePt(iso: string): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateRange(start: string, end?: string): string {
  const last = end && end !== start ? end : "";
  if (!last) return formatDatePt(start);
  return `${formatDatePt(start)} → ${formatDatePt(last)}`;
}

export function treinoTitle(iso: string): string {
  const [year, month, day] = (iso || "").split("-");
  if (!year || !month || !day) return tx("Treino");
  return tx("Treino {date}", { date: `${day}/${month}/${year}` });
}

/**
 * Workout titles are stored as typed. The automatic "Treino dd/mm/yyyy" / "Workout dd/mm/yyyy"
 * default is shown in the active language; anything the coach wrote is shown untouched.
 */
export function displayTitle(title: string): string {
  const auto = /^(?:Treino|Workout) (\d{2}\/\d{2}\/\d{4})$/.exec(title.trim());
  return auto ? tx("Treino {date}", { date: auto[1] }) : title;
}

export function meetTitle(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const month = new Intl.DateTimeFormat(intlLocale(), { month: "short" }).format(date).replace(".", "");
  return tx("Competição {date}", { date: `${date.getDate()} ${month}` });
}

export function formatEvent(distanceM: number, stroke: Stroke): string {
  return `${distanceM} ${STROKE_LABEL[stroke]}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ageFromDob(dob?: string): number | null {
  if (!dob) return null;
  const birth = new Date(`${dob}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

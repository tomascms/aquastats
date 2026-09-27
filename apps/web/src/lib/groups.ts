import { localizedMap } from "@/i18n";

/** Training groups: everyone shares the meets; each group has its own sessions and season plan. */
export const GROUPS = ["velocidade", "intermedio", "fundo"] as const;
export type TrainingGroup = (typeof GROUPS)[number];

export const GROUP_LABEL = localizedMap<TrainingGroup>({
  velocidade: "Velocidade",
  intermedio: "Intermédio",
  fundo: "Fundo",
});

export function isGroup(value: string | undefined | null): value is TrainingGroup {
  return GROUPS.includes(value as TrainingGroup);
}

/** Label for any stored value; values from before the fixed groups are shown as they were. */
export function groupLabel(value: string | undefined | null): string {
  if (!value) return "";
  return isGroup(value) ? GROUP_LABEL[value] : value;
}

/**
 * Team volume without double counting: sessions on the same day and shift run in parallel for
 * different groups (a swimmer does one of them), so each shift counts its biggest session.
 */
export function parallelVolume<T extends { date: string; shift: string }>(workouts: T[], meters: (workout: T) => number): number {
  const byShift = new Map<string, number>();
  for (const workout of workouts) {
    const key = `${workout.date}|${workout.shift}`;
    byShift.set(key, Math.max(byShift.get(key) ?? 0, meters(workout)));
  }
  return [...byShift.values()].reduce((sum, value) => sum + value, 0);
}

/** The coach's own words for the day; free text, these are just suggestions. */
export const FOCUS_SUGGESTIONS = ["Aeróbio", "Limiar", "Potência", "Tolerância", "Velocidade", "Técnica", "Recuperação", "Teste"];

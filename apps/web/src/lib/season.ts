import type { MessageKey } from "@/i18n";
import { addDays, weekStartMonday } from "./dates";
import { workoutMeters } from "./rankings";
import { betweenRoundsCount, flattenInner } from "./set";
import type { Competition, Intensity, SeasonCycle, SeasonPlan, Workout } from "./types";

/*
 * Season planning on top of what already exists: realised volume, intensity and load come from
 * the recorded workouts; competitions are the team's competitions, only tagged A/B/C in the plan.
 */

export type PhaseKind = "general" | "specific" | "competitive" | "taper" | "transition";

export const PHASES: { kind: PhaseKind; label: MessageKey; tone: string }[] = [
  { kind: "general", label: "Preparação geral", tone: "bg-[#dcebfa] text-[#1668b8]" },
  { kind: "specific", label: "Preparação específica", tone: "bg-[#e3f4ed] text-[#138a64]" },
  { kind: "competitive", label: "Competitivo", tone: "bg-[#fff1d6] text-[#9a6200]" },
  { kind: "taper", label: "Taper", tone: "bg-[#fdd9d5] text-[#b3261e]" },
  { kind: "transition", label: "Transição", tone: "bg-panel-2 text-mute" },
];

export function phaseOf(kind: string) {
  return PHASES.find((phase) => phase.kind === kind) ?? PHASES[0];
}

/** Intensity bands used for the weekly distribution. */
export type Band = "easy" | "aerobic" | "threshold" | "high" | "race";

export const BANDS: { band: Band; label: MessageKey; color: string }[] = [
  { band: "easy", label: "Suave / A1", color: "#9fb6cf" },
  { band: "aerobic", label: "A2", color: "#1668b8" },
  { band: "threshold", label: "A3", color: "#e0a100" },
  { band: "high", label: "PA / MAX", color: "#c93a2e" },
  { band: "race", label: "Ritmo de prova", color: "#7b3fb8" },
];

const BAND_OF: Record<Intensity, Band> = {
  SUAVE: "easy",
  A1: "easy",
  A2: "aerobic",
  A3: "threshold",
  PROG: "threshold",
  PA: "high",
  MAX: "high",
  P50: "race",
  P100: "race",
  P200: "race",
  P400: "race",
};

/** Relative effort per metre, for a simple session-load index (volume × intensity). */
const EFFORT: Record<Intensity, number> = {
  SUAVE: 1,
  A1: 1,
  A2: 2,
  A3: 3,
  PROG: 3.2,
  PA: 4,
  MAX: 5,
  P50: 5,
  P100: 4.5,
  P200: 4,
  P400: 3.5,
};

export function workoutBands(workout: Workout): { bands: Record<Band, number>; load: number } {
  const bands: Record<Band, number> = { easy: 0, aerobic: 0, threshold: 0, high: 0, race: 0 };
  let load = 0;
  for (const block of workout.blocks) {
    const rounds = Math.max(1, block.rounds || 1);
    for (const inner of flattenInner(block)) {
      const meters = inner.distanceM * rounds;
      bands[BAND_OF[inner.intensity] ?? "easy"] += meters;
      load += meters * (EFFORT[inner.intensity] ?? 1);
    }
    const easy = betweenRoundsCount(rounds, block.betweenRounds) * (block.betweenRounds?.distanceM || 0);
    if (easy) {
      bands.easy += easy;
      load += easy;
    }
  }
  return { bands, load: load / 1000 };
}

export type PlanWeek = {
  index: number;
  start: string;
  end: string;
  macro?: SeasonCycle;
  meso?: SeasonCycle;
  planned: number;
  realized: number;
  sessions: number;
  bands: Record<Band, number>;
  load: number;
  /** Acute:chronic load ratio against the previous 4 weeks (null without history). */
  acwr: number | null;
  competitions: { competition: Competition; priority: string }[];
  tests: SeasonPlan["tests"];
};

function inside(iso: string, cycle: SeasonCycle): boolean {
  return iso >= cycle.start && iso <= cycle.end;
}

export function planWeeks(plan: SeasonPlan, workouts: Workout[], competitions: Competition[]): PlanWeek[] {
  const first = weekStartMonday(plan.start);
  const weeks: PlanWeek[] = [];
  for (let index = 0, start = first; start <= plan.end && index < 60; index += 1, start = addDays(start, 7)) {
    const end = addDays(start, 6);
    const mid = addDays(start, 3);
    const inWeek = workouts.filter((workout) => workout.date >= start && workout.date <= end);
    const bands: Record<Band, number> = { easy: 0, aerobic: 0, threshold: 0, high: 0, race: 0 };
    let load = 0;
    for (const workout of inWeek) {
      const split = workoutBands(workout);
      (Object.keys(bands) as Band[]).forEach((band) => (bands[band] += split.bands[band]));
      load += split.load;
    }
    weeks.push({
      index,
      start,
      end,
      macro: plan.macros.find((cycle) => inside(mid, cycle)),
      meso: plan.mesos.find((cycle) => inside(mid, cycle)),
      planned: plan.weeklyVolumes.find((item) => item.week === index)?.meters ?? 0,
      realized: inWeek.reduce((sum, workout) => sum + workoutMeters(workout), 0),
      sessions: inWeek.length,
      bands,
      load,
      acwr: null,
      competitions: plan.competitions
        .map((event) => ({ event, competition: competitions.find((item) => item.id === event.id) }))
        .filter((item): item is { event: (typeof plan.competitions)[number]; competition: Competition } =>
          Boolean(item.competition && item.competition.date >= start && item.competition.date <= end),
        )
        .map((item) => ({ competition: item.competition, priority: item.event.type || "B" })),
      tests: plan.tests.filter((test) => test.date >= start && test.date <= end),
    });
  }
  weeks.forEach((week, index) => {
    const previous = weeks.slice(Math.max(0, index - 4), index).filter((item) => item.load > 0);
    if (previous.length >= 2 && week.load > 0) {
      const chronic = previous.reduce((sum, item) => sum + item.load, 0) / previous.length;
      week.acwr = chronic > 0 ? week.load / chronic : null;
    }
  });
  return weeks;
}

/** Where a given day sits in the plan (for the calendar and the workout form). */
export function planContext(plans: SeasonPlan[], iso: string) {
  const plan = plans.find((item) => iso >= item.start && iso <= item.end);
  if (!plan) return null;
  const week = Math.floor((Date.parse(weekStartMonday(iso)) - Date.parse(weekStartMonday(plan.start))) / (7 * 86_400_000));
  return {
    plan,
    week,
    macro: plan.macros.find((cycle) => inside(iso, cycle)),
    meso: plan.mesos.find((cycle) => inside(iso, cycle)),
    planned: plan.weeklyVolumes.find((item) => item.week === week)?.meters ?? 0,
  };
}

/**
 * Classic step taper before an A meet: each of the last `weeks` weeks keeps `(1 − drop)^n`
 * of the reference volume (the last full week before the taper).
 */
export function taperVolumes(weeks: PlanWeek[], meetDate: string, taperWeeks: number, dropPct: number): { week: number; meters: number }[] {
  const meetWeek = weeks.find((week) => meetDate >= week.start && meetDate <= week.end);
  if (!meetWeek) return [];
  const firstTaper = meetWeek.index - taperWeeks + 1;
  const reference = weeks.find((week) => week.index === firstTaper - 1);
  const base = reference?.planned || reference?.realized || 0;
  if (!base) return [];
  const out: { week: number; meters: number }[] = [];
  for (let step = 1; step <= taperWeeks; step += 1) {
    const index = firstTaper + step - 1;
    if (index < 0) continue;
    out.push({ week: index, meters: Math.round((base * Math.pow(1 - dropPct / 100, step)) / 100) * 100 });
  }
  return out;
}

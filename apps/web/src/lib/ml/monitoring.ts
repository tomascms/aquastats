import { weekStartMonday } from "../dates";
import type { Gear } from "../types";
import { dayNumber, HORIZONS, type TeamData } from "./backtest";
import { runStateModel } from "./forecaster";
import type { Outcome } from "./ledger";
import type { Suspect } from "./quality";
import { DEFAULT_OPTIONS, IX, N, type AthleteFilter } from "./state-model";

/*
 * "What the model learned from this week": the athlete's state at the start and at the end of a
 * week (same replay the predictions come from), the factors that moved, regime changes, suspect
 * times, and whether this week's errors look like drift. Structured items; the panel words them.
 */

export type LearningItem =
  | { kind: "form"; pct: number }
  | { kind: "return"; fromPct: number; toPct: number }
  | { kind: "factor"; factor: string; fromPct: number; toPct: number; first: boolean }
  | { kind: "regime"; date: string }
  | { kind: "suspects"; count: number }
  | { kind: "accuracy"; n: number; mapePct: number; coverage: number | null; usualMapePct: number | null }
  | { kind: "drift"; coverage: number };

export type WeeklyReport = { week: string; items: LearningItem[] };

/** Factors worth telling a coach about, with how to read the coefficient as "% slower than plain freestyle". */
const EXPLAINED: { key: string; index: number }[] = [
  ...(["back", "breast", "fly", "im"] as const).map((stroke) => ({ key: `stroke:${stroke}`, index: IX.stroke[stroke] })),
  ...(["legs", "fins", "paddles", "pullbuoy", "arms", "parachute"] as Gear[]).map((gear) => ({ key: `gear:${gear}`, index: IX.gear[gear] })),
];

type Snapshot = { day: number; form: number; returnDeficit: number; active: Uint8Array; means: Float64Array; regimeShifts: number[] };

const snap = (day: number, filter: AthleteFilter): Snapshot => ({
  day,
  form: filter.form(),
  returnDeficit: filter.z[IX.R],
  active: filter.active.slice(),
  means: filter.z.slice(0, N),
  regimeShifts: [...filter.regimeShifts],
});

const pct = (value: number) => (Math.exp(value) - 1) * 100;
const DAY_MS = 86_400_000;
const isoOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

export function weeklyReport(team: TeamData, athleteId: string, weekStart: string, outcomes: Outcome[], suspects: Map<string, Suspect>): WeeklyReport {
  const start = dayNumber(weekStart);
  const end = start + 6;
  let before: Snapshot | null = null;
  let after: Snapshot | null = null;
  runStateModel(team, HORIZONS.day, DEFAULT_OPTIONS, new Set(suspects.keys()), {
    onDay: (id, day, filter) => {
      if (id !== athleteId) return;
      if (day < start) before = snap(day, filter);
      else if (day <= end) after = snap(day, filter);
    },
  });
  const items: LearningItem[] = [];
  const b = before as Snapshot | null;
  const a = after as Snapshot | null;
  if (a) {
    if (b) {
      const change = pct(a.form - b.form);
      if (Math.abs(change) >= 0.2) items.push({ kind: "form", pct: change });
      if (b.returnDeficit > 0.003 || a.returnDeficit > 0.003) items.push({ kind: "return", fromPct: pct(b.returnDeficit), toPct: pct(a.returnDeficit) });
    }
    for (const { key, index } of EXPLAINED) {
      if (!a.active[index]) continue;
      const first = !b || !b.active[index];
      const from = b && b.active[index] ? pct(b.means[index]) : pct(a.means[index]);
      const to = pct(a.means[index]);
      if (first || Math.abs(to - from) >= 1) items.push({ kind: "factor", factor: key, fromPct: from, toPct: to, first });
    }
    for (const day of a.regimeShifts.filter((d) => d >= start && d <= end)) items.push({ kind: "regime", date: isoOf(day) });
  }
  const rows = team.rows.get(athleteId) ?? [];
  const suspectCount = rows.filter((row) => suspects.has(row.log.id) && dayNumber(row.date) >= start && dayNumber(row.date) <= end).length;
  if (suspectCount) items.push({ kind: "suspects", count: suspectCount });

  const mine = outcomes.filter((item) => item.athleteId === athleteId);
  const thisWeek = mine.filter((item) => weekStartMonday(item.date) === weekStart);
  const earlier = mine.filter((item) => dayNumber(item.date) < start && start - dayNumber(item.date) <= 56);
  if (thisWeek.length) {
    const mape = (list: Outcome[]) => list.reduce((sum, item) => sum + Math.abs(item.errorPct), 0) / list.length;
    const intervals = thisWeek.filter((item) => item.inside != null);
    items.push({
      kind: "accuracy",
      n: thisWeek.length,
      mapePct: mape(thisWeek),
      coverage: intervals.length ? intervals.filter((item) => item.inside).length / intervals.length : null,
      usualMapePct: earlier.length >= 20 ? mape(earlier) : null,
    });
  }
  // Drift: over the last four weeks the 80 % intervals caught clearly fewer than they should.
  const recent = mine.filter((item) => item.inside != null && dayNumber(item.date) <= end && end - dayNumber(item.date) < 28);
  if (recent.length >= 40) {
    const coverage = recent.filter((item) => item.inside).length / recent.length;
    if (coverage < 0.7) items.push({ kind: "drift", coverage });
  }
  return { week: weekStart, items };
}

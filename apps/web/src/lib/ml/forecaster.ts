import { isPlausibleRep, type TrainingRep } from "../training-context";
import { dayNumber, isPlanned, originOf, plannedKey, setIdOf, type Horizon, type LeadHorizon, type TeamData } from "./backtest";
import { FatigueProfile, teamFatiguePrior, type SetPlan } from "./fatigue";
import { AthleteFilter, DEFAULT_OPTIONS, developmentPerDay, enginePrior, IX, TeamPool, type ContextAccess, type Forecast, type StateModelOptions } from "./state-model";

/*
 * Runs the state-space model over a whole team in one chronological pass: every athlete's filter
 * moves day by day, the team estimate is refreshed after each day, and every rep gets the forecast
 * its horizon allows (docs/ml/protocolo.md §3). One pass costs O(reps · state²) — years of data
 * never need re-fitting.
 */

export type TeamForecast = Forecast & {
  athleteId: string;
  filter: "rep" | "day" | "lead";
  /** Probability that the set has broken by this rep (with the individual fatigue model). */
  pBreakBy?: number;
  /** Form now vs its average over the last 8 weeks (log-time), for explanations. */
  formDelta: number;
};

const SEASON_RETURN_MONTHS = new Set([9]);

/** First data in September or the first half of October: the athlete is most likely just back from August. */
const startsAfterSummer = (iso: string) => {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return SEASON_RETURN_MONTHS.has(month) || (month === 10 && day <= 15);
};

const DAY_MS = 86_400_000;
const isoOfDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const dayOfYear = (day: number) => day - dayNumber(`${isoOfDay(day).slice(0, 4)}-01-01`);
/** Without any history: Portuguese club calendar, season over in late July, back in early/mid September. */
const DEFAULT_SUMMER_BREAK = { dayOfYear: 205, length: 45 };

/**
 * The summer break expected in `year`, from the athlete's own past summers, else the team's, else the
 * calendar default. Only breaks already completed when the forecast is made are used.
 */
export function expectedSummerBreak(own: { start: number; length: number }[], team: { start: number; length: number }[], year: number) {
  const summer = (item: { start: number; length: number }) => {
    const month = Number(isoOfDay(item.start).slice(5, 7));
    return month >= 6 && month <= 8 && item.length >= 21;
  };
  const pool = own.filter(summer).length ? own.filter(summer) : team.filter(summer);
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const doy = pool.length ? median(pool.map((item) => dayOfYear(item.start))) : DEFAULT_SUMMER_BREAK.dayOfYear;
  const length = pool.length ? median(pool.map((item) => item.length)) : DEFAULT_SUMMER_BREAK.length;
  return { start: dayNumber(`${year}-01-01`) + doy, length };
}

export type RunHooks = {
  /** Called after each athlete's day of data is learned (monitoring: what changed, when). */
  onDay?: (athleteId: string, day: number, filter: AthleteFilter, zScores: number[]) => void;
  /**
   * Chooses which of the day's reps the model may learn from (simulating which sets get timed).
   * Called before the day is learned, with the filter as it stands; returns log ids. Default: all.
   */
  select?: (athleteId: string, day: number, today: TrainingRep[], filter: AthleteFilter, prior: (j: number) => [number, number]) => Set<string>;
  /** With the individual fatigue model: the athlete's profile after the day was learned (parameter recovery). */
  onFatigue?: (athleteId: string, day: number, profile: FatigueProfile) => void;
};

/**
 * Planned reps (time NaN, see `isPlanned`) are forecast at the day horizon like any other rep but
 * never learned from: that is how the app predicts a session before it is swum.
 */
export function runStateModel(
  team: TeamData,
  horizon: Horizon,
  options: StateModelOptions = DEFAULT_OPTIONS,
  excluded: Set<string> = new Set(),
  hooks: RunHooks = {},
): Map<string, TeamForecast> {
  const out = new Map<string, TeamForecast>();
  const pool = new TeamPool();
  const filters = new Map<string, AthleteFilter>();
  const engineRef = new Map<AthleteFilter, number>();

  // Per athlete: plausible reps by day, and entered training by day.
  const repDays = new Map<string, Map<number, TrainingRep[]>>();
  const loadDays = new Map<string, { day: number; load: number }[]>();
  const days = new Set<number>();
  for (const [athleteId, rows] of team.rows) {
    const byDay = new Map<number, TrainingRep[]>();
    for (const row of rows) {
      if (!isPlausibleRep(row) && !isPlanned(row)) continue;
      const day = dayNumber(row.date);
      const list = byDay.get(day) ?? [];
      list.push(row);
      byDay.set(day, list);
      days.add(day);
    }
    repDays.set(athleteId, byDay);
    const loads = [...(team.load.get(athleteId)?.entries() ?? [])].map(([date, value]) => ({ day: dayNumber(date), load: value.load })).sort((a, b) => a.day - b.day);
    loadDays.set(athleteId, loads);
  }

  // Lead horizons: targets grouped by origin.
  const lead = horizon.kind === "lead" ? (horizon as LeadHorizon) : null;
  const targetsByOrigin = new Map<number, Map<string, TrainingRep[]>>();
  if (lead) {
    for (const [athleteId, byDay] of repDays) {
      for (const list of byDay.values()) {
        for (const row of list) {
          const origin = originOf(row.date, lead, team.anchorDay);
          const perAthlete = targetsByOrigin.get(origin) ?? new Map<string, TrainingRep[]>();
          perAthlete.set(athleteId, [...(perAthlete.get(athleteId) ?? []), row]);
          targetsByOrigin.set(origin, perAthlete);
        }
      }
    }
    for (const origin of targetsByOrigin.keys()) days.add(origin);
  }

  /** Training entered from `from` (its own session counts for what follows) up to, not including, `to`. */
  const loadsBetween = (athleteId: string, from: number, to: number) => (loadDays.get(athleteId) ?? []).filter((item) => item.day >= from && item.day < to);
  const priorFor = (filter: AthleteFilter, day: number) => (j: number) => pool.prior(j, filter, day);
  const gammaPrior = (filter: AthleteFilter, day: number) => pool.prior(IX.gamma, filter, day);

  const ensure = (athleteId: string, day: number): AthleteFilter => {
    let filter = filters.get(athleteId);
    if (!filter) {
      const meta = team.athletes.get(athleteId) ?? { id: athleteId };
      filter = new AthleteFilter(meta, options);
      filter.advance(day, null, true, gammaPrior(filter, day));
      const [engine, engineSd] = pool.prior(IX.engine, filter, day);
      filter.activate(IX.engine, engine, engineSd);
      engineRef.set(filter, enginePrior(meta, day)[0]);
      if (startsAfterSummer(new Date(day * 86_400_000).toISOString().slice(0, 10))) filter.startsAfterBreak(gammaPrior(filter, day));
      filters.set(athleteId, filter);
    }
    return filter;
  };

  // The rep's own day (sleep, gym, metres before) is known in the rep/day horizons; a forecast from an origin only knows the plan, if any.
  const linearOff = options.fatigueGrid && !options.fatigueKeepLinear;
  const known: ContextAccess = { use: options.context, dayKnown: true, planKnown: true, noLinearFatigue: linearOff };
  const ahead: ContextAccess = { use: options.context, dayKnown: false, planKnown: Boolean(lead?.planKnown), noLinearFatigue: linearOff };

  // Individual in-set fatigue (fatigue.ts): one posterior per athlete, started from the team's.
  const fatigue = new Map<string, FatigueProfile>();
  const fatigueFor = (athleteId: string) => {
    let profile = fatigue.get(athleteId);
    if (!profile) {
      profile = new FatigueProfile(teamFatiguePrior([...fatigue.values()]));
      fatigue.set(athleteId, profile);
    }
    return profile;
  };
  /** Metres swum before a set, per athlete: with no plan yet, a forecast from an origin uses the athlete's median so far (protocol §3). */
  const metersBefore = new Map<string, number[]>();
  const medianBefore = new Map<string, { n: number; value: number }>();
  const noteBefore = (athleteId: string, meters: number) => {
    const list = metersBefore.get(athleteId) ?? [];
    list.push(meters);
    metersBefore.set(athleteId, list);
  };
  const usualBeforeOf = (athleteId: string) => {
    const list = metersBefore.get(athleteId) ?? [];
    if (!list.length) return 1500;
    const cached = medianBefore.get(athleteId);
    if (cached?.n === list.length) return cached.value;
    const sorted = [...list].sort((x, y) => x - y);
    const value = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    medianBefore.set(athleteId, { n: list.length, value });
    return value;
  };
  /** The day's reps grouped by set, each set in rep order. */
  const setsOf = (rows: TrainingRep[]) => {
    const sets = new Map<string, TrainingRep[]>();
    for (const row of rows) sets.set(setIdOf(row), [...(sets.get(setIdOf(row)) ?? []), row]);
    return [...sets.values()].map((list) => [...list].sort((a, b) => a.log.repNumber - b.log.repNumber));
  };
  /** A set as the fatigue model sees it: intended times from the filter (no in-set fatigue), rests from the send-offs. */
  const planOf = (filter: AthleteFilter, rows: TrainingRep[], prior: (j: number) => [number, number], access: ContextAccess, observedUpTo = -1, metersBefore = rows[0].loadBeforeM): { plan: SetPlan; levels: number[] } => {
    const levels = rows.map((row) => filter.forecast(row, prior, access).logMean);
    return {
      levels,
      plan: {
        cs: filter.criticalSpeed(),
        metersBefore,
        reps: rows.map((row, index) => ({
          distanceM: row.distanceM,
          intendedS: Math.exp(levels[index]),
          sendOffS: row.restSeconds,
          // A suspect time (likely a typo) never drives the reserve: that rep counts as swum as intended.
          observedS: index <= observedUpTo && !isPlanned(row) && !excluded.has(row.log.id) ? row.timeS : undefined,
        })),
      },
    };
  };

  const record = (row: TrainingRep, athleteId: string, forecast: Forecast, kind: TeamForecast["filter"], filter: AthleteFilter, pBreakBy?: number) => {
    out.set(row.log.id, { ...forecast, athleteId, filter: kind, formDelta: filter.recentFormDelta(), pBreakBy });
  };

  for (const day of [...days].sort((a, b) => a - b)) {
    for (const [athleteId, byDay] of repDays) {
      const today = byDay.get(day);
      if (!today) continue;
      const fresh = !filters.has(athleteId);
      const filter = ensure(athleteId, day);
      if (!fresh) filter.advance(day, loadsBetween(athleteId, filter.day!, day), true, gammaPrior(filter, day));
      const prior = priorFor(filter, day);
      const zScores: number[] = [];
      const learnable = hooks.select ? hooks.select(athleteId, day, today, filter, prior) : null;
      const learns = (row: TrainingRep) => !excluded.has(row.log.id) && !isPlanned(row) && (!learnable || learnable.has(row.log.id));
      if (!options.fatigueGrid) {
        if (horizon.kind === "day") for (const row of today) record(row, athleteId, filter.forecast(row, prior, known), "day", filter);
        for (const row of today) {
          filter.newSession(`${row.workoutId}`);
          if (horizon.kind === "rep") record(row, athleteId, filter.forecast(row, prior, known), "rep", filter);
          if (learns(row)) zScores.push(filter.update(row, prior, known));
        }
      } else {
        const profile = fatigueFor(athleteId);
        profile.drift(day);
        const sets = setsOf(today);
        for (const set of sets) if (!isPlanned(set[0])) noteBefore(athleteId, set[0].loadBeforeM);
        if (horizon.kind === "day") {
          // Before the day: every set from today's state, no rep of today seen.
          for (const set of sets) {
            const { plan } = planOf(filter, set, prior, known);
            const fc = profile.forecast(plan);
            set.forEach((row, i) => record(row, athleteId, filter.forecast(row, prior, known, { offset: fc.meanPenalty[i], variance: fc.varPenalty[i] }), "day", filter, fc.pBreakBy[i]));
          }
        }
        for (const set of sets) {
          filter.newSession(`${set[0].workoutId}`);
          if (horizon.kind === "rep") {
            // Rep by rep: the reserve path uses the times already swum in this set, the profile is the one from before the set.
            for (let k = 0; k < set.length; k += 1) {
              const { plan } = planOf(filter, set.slice(0, k + 1), prior, known, k - 1);
              const fc = profile.forecast(plan);
              const extra = { offset: fc.meanPenalty[k], variance: fc.varPenalty[k] };
              record(set[k], athleteId, filter.forecast(set[k], prior, known, extra), "rep", filter, fc.pBreakBy[k]);
              if (learns(set[k])) zScores.push(filter.update(set[k], prior, known, extra));
            }
            const seen = set.filter(learns);
            if (seen.length >= 2) {
              const { plan, levels } = planOf(filter, seen, prior, known, seen.length - 1);
              profile.update(plan, seen.map((row) => Math.log(row.timeS)), levels, team.planned?.get(plannedKey(seen[0].workoutId, seen[0].blockId, seen[0].segmentIndex)) ?? seen.length);
            }
            continue;
          }
          // The set's shape teaches the fatigue profile; the level, corrected by it, teaches the filter.
          const seen = set.filter(learns);
          if (!seen.length) continue;
          const { plan, levels } = planOf(filter, seen, prior, known, seen.length - 1);
          if (seen.length >= 2) profile.update(plan, seen.map((row) => Math.log(row.timeS)), levels, team.planned?.get(plannedKey(seen[0].workoutId, seen[0].blockId, seen[0].segmentIndex)) ?? seen.length);
          const fc = profile.forecast(plan);
          seen.forEach((row, i) => zScores.push(filter.update(row, prior, known, { offset: fc.meanPenalty[i], variance: fc.varPenalty[i] })));
        }
      }
      filter.closeDay();
      filter.logForm();
      hooks.onDay?.(athleteId, day, filter, zScores);
      if (options.fatigueGrid) hooks.onFatigue?.(athleteId, day, fatigueFor(athleteId));
    }
    pool.refresh([...filters.values()], engineRef);

    const targets = lead ? targetsByOrigin.get(day) : undefined;
    if (lead && targets) {
      for (const [athleteId, rows] of targets) {
        const base = filters.get(athleteId) ?? ensure(athleteId, day);
        const clone = base.clone();
        const profile = options.fatigueGrid ? fatigueFor(athleteId).clone() : null;
        const leadSets = new Map<string, { offset: number; variance: number; pBreakBy: number }>();
        const sorted = [...rows].sort((a, b) => dayNumber(a.date) - dayNumber(b.date));
        const teamBreaks = [...filters.values()].flatMap((filter) => filter.breaks);
        for (const row of sorted) {
          const target = dayNumber(row.date);
          if (clone.day != null && target > clone.day && !lead.planKnown && options.seasonal) {
            // No plan yet: foresee the usual summer break(s) between now and the target.
            const firstYear = Number(isoOfDay(clone.day).slice(0, 4));
            const lastYear = Number(isoOfDay(target).slice(0, 4));
            for (let year = firstYear; year <= lastYear; year += 1) {
              const expected = expectedSummerBreak(clone.breaks, teamBreaks, year);
              if (expected.start <= clone.day! || expected.start + expected.length >= target) continue;
              clone.advance(expected.start, null, false, gammaPrior(clone, day));
              clone.advance(expected.start + expected.length, [], false, gammaPrior(clone, day));
              clone.applyBreak(expected.length, gammaPrior(clone, day));
            }
          }
          if (clone.day != null && target > clone.day) {
            clone.advance(target, lead.planKnown ? loadsBetween(athleteId, clone.day, target) : null, lead.planKnown, gammaPrior(clone, day));
          }
          if (!lead.planKnown && (options.seasonalAnchor > 0 || options.seasonalAnchorYear > 0)) {
            // Same time last year: a year ahead, last year's form plus the growth expected for the age;
            // a few weeks ahead, today's form plus last year's change between the same two weeks.
            const yearAgo = base.formNear(target - 364);
            if (yearAgo != null) {
              const anchor =
                target - day >= 300
                  ? yearAgo + developmentPerDay(base.meta, target - 364) * 364
                  : (() => {
                      const originYearAgo = base.formNear(day - 364);
                      return originYearAgo == null ? null : base.form() + (yearAgo - originYearAgo);
                    })();
              if (anchor != null) clone.nudgeForm(anchor, target - day >= 300 ? options.seasonalAnchorYear : options.seasonalAnchor);
            }
          }
          clone.newSession(`${row.workoutId}`);
          if (profile && !leadSets.has(row.log.id)) {
            // The whole set of this target, from the state at the origin.
            profile.drift(target);
            const set = rows.filter((other) => setIdOf(other) === setIdOf(row)).sort((a, b) => a.log.repNumber - b.log.repNumber);
            const { plan } = planOf(clone, set, priorFor(clone, day), ahead, -1, lead.planKnown ? set[0].loadBeforeM : usualBeforeOf(athleteId));
            const fc = profile.forecast(plan);
            set.forEach((other, i) => leadSets.set(other.log.id, { offset: fc.meanPenalty[i], variance: fc.varPenalty[i], pBreakBy: fc.pBreakBy[i] }));
          }
          const extra = leadSets.get(row.log.id);
          record(row, athleteId, clone.forecast(row, priorFor(clone, day), ahead, extra), "lead", clone, extra?.pBreakBy);
        }
      }
    }
  }
  return out;
}

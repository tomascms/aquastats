import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TrainingRep } from "../training-context";
import { dayNumber, HORIZONS, isPlanned, teamData, type Dataset, type TeamData } from "./backtest";
import { FatigueProfile, NO_VOLUME_GRID, simulateSet, type SetPlan } from "./fatigue";
import { runStateModel } from "./forecaster";
import { clearPipelineCache } from "./pipeline";
import { statePredictions } from "./production";
import { teamSuspects } from "./quality";
import { createRng } from "./rng";
import { generateDataset } from "./synthetic";
import { V1_OPTIONS } from "./v1";

/*
 * Properties v1.0 must keep whatever the data (docs/ml/README.md, "Robustez"): monotonicity in rest
 * and in the number of reps, invariance to the order data arrives in, sane answers with missing data
 * and typing errors, determinism, and the counterfactual probes of the feasibility frontier.
 */

const team = teamData(generateDataset("tipico", 8) as unknown as Dataset);
const isoAfter = (iso: string, days: number) => new Date((dayNumber(iso) + days) * 86_400_000).toISOString().slice(0, 10);

/** A planned future set copied from the athlete's last hard set, with this many reps and this send-off. */
function plannedSet(source: TeamData, reps: number, sendOff: number): { team: TeamData; ids: string[] } {
  const [athleteId, rows] = [...source.rows][0];
  const hard = rows.filter((row) => !isPlanned(row) && row.intensity === "PA" && row.segmentReps >= 4);
  const template = hard[hard.length - 1];
  const date = isoAfter(rows[rows.length - 1].date, 1);
  const planned: TrainingRep[] = Array.from({ length: reps }, (_, i) => ({
    ...template,
    log: { ...template.log, id: `plan:probe:${i + 1}`, repNumber: i + 1 },
    timeS: Number.NaN,
    date,
    workoutId: "probe",
    repInSegment: i + 1,
    segmentReps: reps,
    restSeconds: sendOff,
  }));
  return { team: { ...source, rows: new Map([...source.rows].map(([id, list]) => [id, id === athleteId ? [...list, ...planned] : list])) }, ids: planned.map((row) => row.log.id) };
}

const forecastsOf = (data: TeamData) => runStateModel(data, HORIZONS.day, V1_OPTIONS, new Set(teamSuspects(data.rows).keys()));

describe("v1.0 properties", () => {
  it("more rest never makes a planned set slower", () => {
    let previous: number[] | null = null;
    for (const sendOff of [40, 45, 50, 60, 75, 90]) {
      const { team: withPlan, ids } = plannedSet(team, 6, sendOff);
      const forecasts = forecastsOf(withPlan);
      const means = ids.map((id) => forecasts.get(id)!.meanS);
      if (previous) means.forEach((mean, i) => assert.ok(mean <= previous![i] + 1e-9, `rep ${i + 1}: ${mean} after ${previous![i]} with more rest`));
      previous = means;
    }
  });

  it("fewer reps never make a set harder: the first reps are forecast the same, the chance of breaking is lower", () => {
    const short = plannedSet(team, 4, 50);
    const long = plannedSet(team, 8, 50);
    const a = forecastsOf(short.team);
    const b = forecastsOf(long.team);
    short.ids.forEach((id, i) => assert.ok(Math.abs(a.get(id)!.meanS - b.get(long.ids[i])!.meanS) < 1e-9));
    assert.ok(a.get(short.ids[3])!.pBreakBy! <= b.get(long.ids[7])!.pBreakBy! + 1e-12);
  });

  it("does not depend on the order athletes or reps arrive in", () => {
    const reversed: TeamData = { ...team, rows: new Map([...team.rows].reverse()), athletes: new Map([...team.athletes].reverse()) };
    const a = forecastsOf(team);
    const b = forecastsOf(reversed);
    assert.equal(a.size, b.size);
    for (const [id, forecast] of a) assert.ok(Math.abs(forecast.logMean - b.get(id)!.logMean) < 1e-9, `${id} depends on the order`);
  });

  it("is deterministic", () => {
    const a = forecastsOf(team);
    const b = forecastsOf(team);
    for (const [id, forecast] of a) assert.equal(b.get(id)!.logMean, forecast.logMean);
  });

  it("answers every rep with a finite estimate even with most times missing, never NaN", () => {
    clearPipelineCache();
    const rng = createRng(3);
    const sparse: TeamData = { ...team, rows: new Map([...team.rows].map(([id, rows]) => [id, rows.filter(() => rng.chance(0.3))])) };
    const { team: withPlan, ids } = plannedSet(sparse, 6, 50);
    const out = statePredictions(withPlan);
    for (const id of ids) {
      const prediction = out.get(id);
      assert.ok(prediction, `no estimate for ${id}`);
      assert.ok(Number.isFinite(prediction.mean) && prediction.mean > 0);
      if (prediction.lo != null) assert.ok(Number.isFinite(prediction.lo) && Number.isFinite(prediction.hi!));
    }
  });

  it("a typing error (+1 minute) is flagged and barely moves what follows", () => {
    const [athleteId, rows] = [...team.rows][0];
    const index = rows.findIndex((row, i) => i > rows.length / 2 && !isPlanned(row) && row.intensity === "A2");
    const typo: TeamData = { ...team, rows: new Map(team.rows) };
    typo.rows.set(athleteId, rows.map((row, i) => (i === index ? { ...row, timeS: row.timeS + 60 } : row)));
    const suspects = teamSuspects(typo.rows);
    assert.equal(suspects.get(rows[index].log.id)?.reason, "minute");
    const clean = forecastsOf(team);
    const dirty = forecastsOf(typo);
    const later = rows.filter((row) => dayNumber(row.date) > dayNumber(rows[index].date)).slice(0, 40);
    for (const row of later) assert.ok(Math.abs(dirty.get(row.log.id)!.logMean - clean.get(row.log.id)!.logMean) < 0.002, `${row.log.id} moved with the typo`);
  });

  it("counterfactual probe: fails 4×50@50 today; two months later completes 6×50@50 but still fails 4×50@45", () => {
    // True athlete: W′ grows from 9 to 18 m with training, recovery τ = 40 s, 50s at 29 s (critical speed 1.45 m/s).
    const set = (reps: number, sendOff: number): SetPlan => ({ cs: 1.45, metersBefore: 1000, reps: Array.from({ length: reps }, () => ({ distanceM: 50, intendedS: 29, sendOffS: sendOff })) });
    const swims = (profile: FatigueProfile, reps: number, sendOff: number, wPrime: number) => {
      const plan = set(reps, sendOff);
      const { penalty } = simulateSet(plan, wPrime, 40, 0.15);
      const levels = plan.reps.map((rep) => Math.log(rep.intendedS));
      profile.update(plan, levels.map((level, i) => level + penalty[i] + (((i * 7) % 3) - 1) * 0.002), levels, reps);
    };
    // The truth itself satisfies the probe.
    assert.notEqual(simulateSet(set(4, 50), 9, 40, 0.15).cliffAt, null);
    assert.equal(simulateSet(set(6, 50), 18, 40, 0.15).cliffAt, null);
    assert.notEqual(simulateSet(set(4, 45), 18, 40, 0.15).cliffAt, null);

    const profile = new FatigueProfile(null, NO_VOLUME_GRID);
    const breaks = (reps: number, sendOff: number) => profile.forecast(set(reps, sendOff)).pBreakBy[reps - 1];
    for (let session = 0, day = 0; session < 8; session += 1, day += 3) {
      profile.drift(day);
      swims(profile, 4, 50, 9);
    }
    assert.ok(breaks(4, 50) > 0.8, `today 4×50@50 should fail: ${breaks(4, 50)}`);
    for (let session = 0, day = 60; session < 8; session += 1, day += 3) {
      profile.drift(day);
      swims(profile, 6, 50, 18);
    }
    assert.ok(breaks(6, 50) < 0.2, `in two months 6×50@50 should be completed: ${breaks(6, 50)}`);
    assert.ok(breaks(4, 45) > 0.8, `in two months 4×50@45 should still fail: ${breaks(4, 45)}`);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BREAK_PENALTY, FatigueProfile, simulateSet, W_GRID, type SetPlan } from "./fatigue";

const set = (reps: number, distanceM: number, intendedS: number, sendOffS: number, metersBefore = 1000): SetPlan => ({
  cs: 1.45,
  metersBefore,
  reps: Array.from({ length: reps }, () => ({ distanceM, intendedS, sendOffS })),
});

const lastPenalty = (plan: SetPlan, w = 18, tau = 80, vol = 0.15) => {
  const { penalty } = simulateSet(plan, w, tau, vol);
  return penalty[penalty.length - 1];
};

describe("individual fatigue (W′ with a cliff)", () => {
  it("is monotonic: more rest, fewer reps, less volume before or a bigger, faster-recovering reserve never make a set harder", () => {
    for (const sendOff of [40, 45, 50, 60]) {
      assert.ok(lastPenalty(set(6, 50, 31, sendOff + 5)) <= lastPenalty(set(6, 50, 31, sendOff)) + 1e-12);
    }
    for (const reps of [2, 4, 6, 8]) {
      assert.ok(Math.max(...simulateSet(set(reps, 50, 31, 45), 18, 80, 0.15).penalty) <= Math.max(...simulateSet(set(reps + 2, 50, 31, 45), 18, 80, 0.15).penalty) + 1e-12);
    }
    assert.ok(lastPenalty(set(6, 50, 31, 45, 3000)) >= lastPenalty(set(6, 50, 31, 45, 500)) - 1e-12);
    // A bigger reserve or faster recovery never makes it harder.
    assert.ok(lastPenalty(set(8, 50, 31, 45), 25) <= lastPenalty(set(8, 50, 31, 45), 13) + 1e-12);
    assert.ok(lastPenalty(set(8, 50, 31, 45), 18, 40) <= lastPenalty(set(8, 50, 31, 45), 18, 160) + 1e-12);
  });

  it("falls off the curve only when the reserve runs out (the probe: fails 4×50@50 with a small W′, not with a large one)", () => {
    const probe = set(4, 50, 29, 50);
    assert.notEqual(simulateSet(probe, 6, 160, 0.15).cliffAt, null);
    assert.equal(simulateSet(probe, 48, 40, 0.15).cliffAt, null);
    // An easy set below critical speed never breaks.
    assert.equal(simulateSet(set(10, 100, 75, 120), 6, 250, 0.35).cliffAt, null);
  });

  it("learns the athlete's reserve from the shape of the sets", () => {
    const trueW = 9;
    const profile = new FatigueProfile();
    const before = profile.summary().wPrime;
    for (let k = 0; k < 25; k += 1) {
      const plan = set(6, 50, 30 + (k % 3), 45 + (k % 4) * 5);
      const { penalty } = simulateSet(plan, trueW, 80, 0.15);
      const levels = plan.reps.map((rep) => Math.log(rep.intendedS));
      profile.update(plan, levels.map((level, i) => level + penalty[i]), levels, plan.reps.length);
    }
    const after = profile.summary().wPrime;
    assert.ok(Math.abs(Math.log(after / trueW)) < Math.abs(Math.log(before / trueW)) / 2, `W′ ${before.toFixed(1)} → ${after.toFixed(1)} (true ${trueW})`);
    assert.ok(profile.forecast(set(6, 50, 30, 45)).pBreakBy[5] > new FatigueProfile().forecast(set(6, 50, 30, 45)).pBreakBy[5]);
  });

  it("reads a set that stops right after a slow rep as a possible break (censoring)", () => {
    const plan = set(3, 50, 30, 45);
    const levels = plan.reps.map((rep) => Math.log(rep.intendedS));
    const observed = levels.map((level, i) => level + (i === 2 ? BREAK_PENALTY + 0.02 : 0));
    const complete = new FatigueProfile();
    complete.update(plan, observed, levels, 3);
    const stopped = new FatigueProfile();
    stopped.update(plan, observed, levels, 6);
    assert.ok(stopped.summary().wPrime <= complete.summary().wPrime + 1e-9);
  });

  it("drifts each dimension at its own speed and keeps a valid distribution", () => {
    const profile = new FatigueProfile();
    profile.post.fill(0);
    profile.post[0] = 1;
    profile.drift(100);
    profile.drift(160);
    const total = profile.post.reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
    assert.ok(profile.post[0] < 1);
    assert.equal(W_GRID.length * 6 * 4, profile.post.length);
  });
});

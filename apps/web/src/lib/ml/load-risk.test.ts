import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays } from "../dates";
import type { Athlete } from "../types";
import { acwrBand, ewmaAcwr, taperOptions } from "./load-risk";
import { appTeam, timingSuggestions } from "./production";
import { DEFAULT_VARIANT, generateDataset } from "./synthetic";

const steady = (days: number, load = 5, from = "2026-01-05") => new Map(Array.from({ length: days }, (_, i) => [addDays(from, i), load] as [string, number]));

describe("acute:chronic load (EWMA)", () => {
  it("stays near 1 with steady training and says nothing in the first four weeks", () => {
    const daily = steady(70);
    const out = ewmaAcwr(daily, addDays("2026-01-05", 69));
    assert.equal(out.get(addDays("2026-01-05", 20))!.ratio, null);
    assert.ok(Math.abs(out.get(addDays("2026-01-05", 69))!.ratio! - 1) < 0.05);
  });

  it("flags a sudden spike and a drop", () => {
    const daily = steady(60);
    for (let i = 60; i < 67; i += 1) daily.set(addDays("2026-01-05", i), 12);
    const spike = ewmaAcwr(daily, addDays("2026-01-05", 66)).get(addDays("2026-01-05", 66))!.ratio!;
    assert.ok(["acima", "pico"].includes(acwrBand(spike)), `ratio ${spike}`);
    const rest = steady(60);
    const drop = ewmaAcwr(rest, addDays("2026-01-05", 70)).get(addDays("2026-01-05", 70))!.ratio!;
    assert.equal(acwrBand(drop), "abaixo");
  });
});

describe("taper simulation", () => {
  it("prefers a taper to no taper, and not the longest, heaviest one blindly", () => {
    const daily = steady(120);
    const today = addDays("2026-01-05", 119);
    const options = taperOptions(daily, today, addDays(today, 28));
    const none = options[0];
    assert.equal(none.weeks, 0);
    const best = options.slice(1).sort((a, b) => b.freshness - a.freshness)[0];
    assert.ok(best.freshness > none.freshness);
    assert.ok(best.weeks >= 1 && best.weeks <= 3);
  });

  it("has nothing to say without training or after the meet", () => {
    assert.deepEqual(taperOptions(new Map(), "2026-03-01", "2026-03-20"), []);
    assert.deepEqual(taperOptions(steady(40), "2026-03-01", "2026-02-20"), []);
  });
});

describe("what to time", () => {
  it("ranks a session's planned sets, never-timed kinds first among equals", () => {
    const dataset = generateDataset("esparso", 6, DEFAULT_VARIANT);
    const athletes: Athlete[] = dataset.athletes.map((athlete) => ({
      id: athlete.id,
      name: athlete.name,
      isPlaceholder: true,
      teamId: "syn",
      primaryStroke: athlete.primaryStroke,
      dateOfBirth: athlete.dateOfBirth,
      gender: athlete.gender,
      groupName: athlete.group,
      wellness: athlete.wellness,
    }));
    const last = [...dataset.workouts].sort((a, b) => a.date.localeCompare(b.date)).slice(-3);
    const ids = new Set(last.map((workout) => workout.id));
    const { team, planned } = appTeam(athletes, dataset.workouts, dataset.timeLogs.filter((log) => !ids.has(log.workoutId)), last);
    const hints = timingSuggestions(team, planned);
    assert.ok(hints.length > 0);
    for (let i = 1; i < hints.length; i += 1) assert.ok(hints[i - 1].score >= hints[i].score);
    for (const hint of hints) assert.ok(hint.uncertaintyPct > 0 && hint.reps > 0);
  });
});

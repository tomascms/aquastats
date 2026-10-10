import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlausibleRep, type TrainingRep } from "../training-context";
import type { Athlete, TimeLog } from "../types";
import { attribute } from "./attribution";
import { checkCausality, dayNumber, HORIZONS, isPlanned, teamData, type TeamData } from "./backtest";
import { runStateModel } from "./forecaster";
import { ledgerItems, promotionReport, reconcile, reconstructedOutcomes, trackRecord, type LedgerEntry, type Outcome } from "./ledger";
import { weeklyReport } from "./monitoring";
import { appTeam, legacyPredictions, statePredictions } from "./production";
import { PREDICTORS } from "./registry";
import { DEFAULT_OPTIONS, IX } from "./state-model";
import { DEFAULT_VARIANT, generateDataset } from "./synthetic";

const dataset = generateDataset("tipico", 7, { ...DEFAULT_VARIANT, data: "completos" });
const team = teamData(dataset);
const [athleteId, rows] = [...team.rows.entries()].sort((a, b) => b[1].length - a[1].length)[0];
const dates = [...new Set(rows.map((row) => row.date))].sort();
const middle = dates[Math.floor(dates.length / 2)];

const withRows = (base: TeamData, edit: (list: TrainingRep[]) => TrainingRep[]): TeamData => {
  const copy = new Map(base.rows);
  copy.set(athleteId, edit(rows));
  return { ...base, rows: copy };
};
const forecastsAfter = (data: TeamData, from: string, excluded = new Set<string>()) => {
  const out = runStateModel(data, HORIZONS.day, DEFAULT_OPTIONS, excluded);
  return rows.filter((row) => row.date > from && isPlausibleRep(row)).map((row) => out.get(row.log.id)!.meanS);
};
const maxRelChange = (a: number[], b: number[]) => Math.max(...a.map((value, i) => Math.abs(b[i] / value - 1)));

describe("online learning: robustness", () => {
  it("a +1 minute typo barely moves later predictions, even before the quality filter removes it", () => {
    const target = rows.find((row) => row.date === middle && row.distanceM <= 100 && isPlausibleRep(row))!;
    const typo = withRows(team, (list) => list.map((row) => (row === target ? { ...row, timeS: row.timeS + 60 } : row)));
    const clean = forecastsAfter(team, middle);
    assert.ok(maxRelChange(clean, forecastsAfter(typo, middle)) < 0.01, "Huber weights keep a gross error from contaminating the state");
    const skipped = new Set([target.log.id]);
    assert.ok(maxRelChange(forecastsAfter(team, middle, skipped), forecastsAfter(typo, middle, skipped)) < 1e-9, "a suspect time is not learned from at all");
  });

  it("one strange day does not make the model overfit to it", () => {
    const strange = withRows(team, (list) => list.map((row) => (row.date === middle ? { ...row, timeS: row.timeS * 1.04 } : row)));
    const next = rows.find((row) => row.date > middle && isPlausibleRep(row))!;
    const base = runStateModel(team, HORIZONS.day).get(next.log.id)!.meanS;
    const after = runStateModel(strange, HORIZONS.day).get(next.log.id)!.meanS;
    assert.ok(after / base - 1 < 0.02, `next day moved ${((after / base - 1) * 100).toFixed(2)} % after a +4 % day`);
    assert.ok(after > base, "but it does notice");
  });
});

describe("online learning: regime change", () => {
  it("learns a real, lasting change quickly", () => {
    const shifted = withRows(team, (list) => list.map((row) => (row.date >= middle ? { ...row, timeS: row.timeS * 0.96 } : row)));
    const out = runStateModel(shifted, HORIZONS.day);
    const laterDays = dates.filter((date) => date >= middle);
    // Hard reps show form fully (the model's physiology: easy aerobic reps are paced and show it less).
    const hard = new Set(["PA", "MAX", "P50", "P100", "P200", "P400"]);
    const bias = (from: number, to: number) => {
      const list = rows.filter((row) => hard.has(row.intensity) && dayNumber(row.date) - dayNumber(middle) >= from && dayNumber(row.date) - dayNumber(middle) < to);
      return list.reduce((sum, row) => sum + out.get(row.log.id)!.meanS / (row.timeS * 0.96) - 1, 0) / list.length;
    };
    assert.ok(laterDays.length > 10);
    const first = bias(0, 3);
    const twoWeeksIn = bias(14, 28);
    assert.ok(first > 0.02, `at first the new level is a surprise (${(first * 100).toFixed(2)} %)`);
    assert.ok(twoWeeksIn < 0.01, `two weeks later the bias is ${(twoWeeksIn * 100).toFixed(2)} %`);
  });
});

describe("online learning: no catastrophic forgetting", () => {
  it("keeps what it learned about a factor through a long break", () => {
    let before: number | null = null;
    let after: number | null = null;
    const breakStart = dayNumber(middle);
    const gapped = withRows(team, (list) => list.filter((row) => dayNumber(row.date) < breakStart || dayNumber(row.date) > breakStart + 42));
    runStateModel(gapped, HORIZONS.day, DEFAULT_OPTIONS, new Set(), {
      onDay: (id, day, filter) => {
        if (id !== athleteId || !filter.active[IX.gear.legs]) return;
        if (day < breakStart) before = filter.z[IX.gear.legs];
        else if (after == null) after = filter.z[IX.gear.legs];
      },
    });
    assert.ok(before != null && after != null);
    assert.ok(Math.abs(after! - before!) < 0.02, `kick factor moved ${(after! - before!).toFixed(4)} across a 6-week break`);
  });
});

describe("causality of the new models", () => {
  const small = teamData(generateDataset("esparso", 4));
  for (const name of ["modelo de estado", "modelo de estado + qualidade + conformal"]) {
    it(`${name}: no prediction moves when the future changes, in every horizon`, () => {
      const predictor = PREDICTORS.find((item) => item.name === name)!;
      for (const horizon of [HORIZONS.rep, HORIZONS.day, HORIZONS.semana, HORIZONS.mes]) assert.deepEqual(checkCausality(predictor, small, horizon), [], horizon.name);
    });
  }
});

/* ---------- App side: planned reps, ledger, attribution, monitoring ---------- */

const appAthletes: Athlete[] = dataset.athletes.map((athlete) => ({
  id: athlete.id,
  name: athlete.name,
  isPlaceholder: true,
  teamId: "syn-team",
  primaryStroke: athlete.primaryStroke,
  dateOfBirth: athlete.dateOfBirth,
  gender: athlete.gender,
  groupName: athlete.group,
  wellness: athlete.wellness,
}));
// The last three training days' sessions as if they had not been swum yet.
const lastDates = new Set([...new Set(dataset.workouts.map((workout) => workout.date))].sort().slice(-3));
const lastWorkouts = dataset.workouts.filter((workout) => lastDates.has(workout.date));
const plannedIds = new Set(lastWorkouts.map((workout) => workout.id));
const logsBefore = dataset.timeLogs.filter((log) => !plannedIds.has(log.workoutId));

describe("app: predicting a session before it is swum", () => {
  const { team: app, planned } = appTeam(appAthletes, dataset.workouts, logsBefore, lastWorkouts);
  const state = statePredictions(app);
  const legacy = legacyPredictions(app);

  it("creates planned reps with no time and predicts every one of them", () => {
    assert.ok(planned.length > 10);
    for (const row of planned) {
      assert.ok(isPlanned(row));
      const prediction = state.get(row.log.id);
      assert.ok(prediction && prediction.mean > 0 && prediction.lo! < prediction.mean && prediction.hi! > prediction.mean, row.log.id);
    }
    assert.ok(planned.filter((row) => legacy.has(row.log.id)).length > planned.length * 0.3, "the current model also predicts planned reps it has history for");
  });

  it("explains each prediction with at most three factors", () => {
    for (const row of planned) assert.ok(state.get(row.log.id)!.factors.length <= 3);
  });

  it("records only planned reps, and reconciles them with the times entered later (corrections re-pair)", () => {
    const items = ledgerItems(state, planned);
    assert.equal(items.length, planned.filter((row) => state.has(row.log.id)).length);
    const entries: LedgerEntry[] = items.map((item, i) => ({ ...item, id: `e${i}`, model: "estado", modelVersion: "2.0", role: "challenger", horizon: "day", predictedAt: "" }));
    const realLogs = dataset.timeLogs.filter((log) => plannedIds.has(log.workoutId));
    const outcomes = reconcile(entries, realLogs);
    assert.ok(outcomes.length > 0 && outcomes.length <= entries.length);
    const corrected: TimeLog[] = realLogs.map((log) => ({ ...log, ss: Math.min(59, log.ss + 1) }));
    const again = reconcile(entries, corrected);
    assert.notEqual(again[0].actualS, outcomes[0].actualS);
    const record = trackRecord(outcomes);
    assert.ok(record.mapePct > 0 && record.mapePct < 10 && record.n === outcomes.length);
  });
});

describe("champion / challenger on real data", () => {
  const outcome = (model: string, key: number, error: number, week: number): Outcome => ({
    id: `${model}${key}`,
    athleteId: "a",
    model,
    date: new Date(Date.UTC(2026, 0, 5 + week * 7)).toISOString().slice(0, 10),
    repKey: `k${key}`,
    meanS: 30 * (1 + error),
    loS: 30 * (1 + error) - 0.6,
    hiS: 30 * (1 + error) + 0.6,
    sdS: 0.47,
    actualS: 30,
    errorPct: error * 100,
    inside: Math.abs(error) * 30 <= 0.6,
    crpsPct: null,
    logId: `l${key}`,
  });

  it("is not ready without enough evidence, ready when clearly better over enough weeks", () => {
    const few = [outcome("atual", 1, 0.02, 0), outcome("estado", 1, 0.01, 0)];
    assert.equal(promotionReport(few, "atual", "estado").ready, false);
    const many: Outcome[] = [];
    for (let k = 0; k < 300; k += 1) {
      const week = k % 10;
      const noise = ((k * 37) % 11) / 1000;
      many.push(outcome("atual", k, 0.018 + noise, week), outcome("estado", k, 0.008 + noise, week));
    }
    const report = promotionReport(many, "atual", "estado");
    assert.equal(report.paired, 300);
    assert.ok(report.dMape.hi < 0);
    assert.ok(!report.missing.includes("reps") && !report.missing.includes("weeks") && !report.missing.includes("mape"));
  });
});

describe("error attribution", () => {
  const { team: app } = appTeam(appAthletes, dataset.workouts, dataset.timeLogs);
  const outcomes = reconstructedOutcomes(statePredictions(app), app.rows.get(athleteId)!);

  it("blames a typing error on the data, and a whole day off on the day", () => {
    const one = outcomes[outcomes.length - 1];
    const typo = { ...one, actualS: one.actualS + 60, errorPct: -50, inside: false };
    const result = attribute([{ outcome: typo, suspect: { reason: "minute", suggestedS: one.actualS, referenceS: one.actualS, gapPct: 50 } }]);
    assert.equal(result.get(typo.id)!.cause, "dado-errado");

    const day = outcomes.filter((item) => item.date === outcomes[outcomes.length - 1].date);
    const offDay = day.map((item) => ({ ...item, actualS: item.meanS * 1.05, inside: false, errorPct: -4.8 }));
    const causes = attribute(offDay.map((item) => ({ outcome: item })));
    if (offDay.length >= 3) assert.ok([...causes.values()].every((item) => item.cause === "dia-anormal"));
  });

  it("calls a first-ever kind of rep missing data", () => {
    const miss = { ...outcomes[0], actualS: outcomes[0].meanS * 1.06, inside: false };
    assert.equal(attribute([{ outcome: miss, newKind: true }]).get(miss.id)!.cause, "dado-em-falta");
  });
});

describe("weekly learning report", () => {
  it("says what changed in a week", () => {
    const { team: app } = appTeam(appAthletes, dataset.workouts, dataset.timeLogs);
    const outcomes = reconstructedOutcomes(statePredictions(app), app.rows.get(athleteId)!);
    const week = outcomes[Math.floor(outcomes.length * 0.7)].date;
    const monday = new Date(Date.UTC(Number(week.slice(0, 4)), Number(week.slice(5, 7)) - 1, Number(week.slice(8, 10))));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const report = weeklyReport(app, athleteId, monday.toISOString().slice(0, 10), outcomes, new Map());
    assert.ok(report.items.some((item) => item.kind === "accuracy"));
  });
});

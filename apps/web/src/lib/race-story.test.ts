import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays } from "./dates";
import { bestBefore, laps50, leadIn, leadInTags, paceCheck, raceProfileLines, readSplits, resultLine, vsBest } from "./race-story";
import type { RaceRecord } from "./rankings";
import type { TrainingRep } from "./training-context";
import type { Workout } from "./types";

const record = (id: string, date: string, timeS: number, extra: Partial<RaceRecord> = {}): RaceRecord =>
  ({ id, entryId: id, athleteId: "a", competitionId: "c", date, dayPart: "am", course: "lcm", stroke: "free", distanceM: 100, timeS, venue: "", meetTitle: "", ...extra }) as RaceRecord;
const split = (atM: number, s: number) => ({ atM, mm: Math.floor(s / 60), ss: Math.floor(s % 60), cc: Math.round((s % 1) * 100) });
/** One workout a day (except `skip`), `meters` before `taperFrom` days to the race and half of it after. */
const workouts = (race: string, meters: number, taperFrom: number, skip: (d: number) => boolean = () => false): Workout[] =>
  Array.from({ length: 60 }, (_, i) => i + 1)
    .filter((d) => !skip(d))
    .map((d) => ({ id: `w${d}`, date: addDays(race, -d), athleteIds: ["a"], blocks: [{ rounds: 1, segments: [{ reps: 1, distanceM: d <= taperFrom ? meters / 2 : meters, intensity: "A1" }] }] }) as unknown as Workout);

describe("prova: resultado, preparação e parciais", () => {
  it("resultado face ao recorde: verde, cinzento perto, laranja longe, sem recorde", () => {
    const pb = record("pb", "2026-03-01", 60);
    assert.equal(resultLine("100 Livres", 59.2, pb).tone, "faster");
    assert.equal(resultLine("100 Livres", 60.4, pb).tone, "normal");
    assert.equal(resultLine("100 Livres", 62, pb).tone, "slower");
    assert.equal(resultLine("100 Livres", 62, null).msg.key, "{event} em {time}: primeira vez nesta prova.");
    assert.equal(bestBefore([pb, record("x", "2026-05-01", 58)], "free", 100, "lcm", "2026-04-01", "now")?.id, "pb");
  });

  it("taper, sono e paragens nas semanas antes", () => {
    const race = "2026-06-01";
    const li = leadIn(race, "a", workouts(race, 4000, 14), [{ date: addDays(race, -1), sleepHours: 8.5, gym: null }, { date: addDays(race, -2), sleepHours: 8, gym: null }]);
    assert.ok(li.changePct! < -40 && li.taperWeeks === 2 && li.breakDays === null);
    const tags = leadInTags(li, "faster");
    assert.deepEqual(tags.map((tag) => [tag.key, tag.tone]), [["volume", "faster"], ["sleep", "faster"], ["break", "faster"], ["form", "faster"]]);
    const broken = leadIn(race, "a", workouts(race, 4000, 0, (d) => d >= 3 && d <= 14), []);
    assert.equal(broken.breakDays, 13);
    assert.equal(leadInTags(broken, null).find((tag) => tag.key === "sleep")!.msg.key, "Sono não registado nos dias antes");
    assert.deepEqual(vsBest(broken, li).map((d) => d.label), ["Volume na semana antes", "Paragem nas 3 semanas antes"]);
  });

  it("ritmo de prova no treino contra a prova; sem séries comparáveis diz isso", () => {
    const rep = (d: number, timeS: number, intensity = "P100") => ({ date: addDays("2026-06-01", -d), stroke: "free", course: "lcm", distanceM: 50, intensity, timeS }) as TrainingRep;
    const reps = [rep(3, 31.5), rep(5, 31.4), rep(8, 31.6)];
    const check = paceCheck(reps, "2026-06-01", "free", "lcm", 100, 62.9);
    assert.equal(check.kind, "race-pace");
    assert.equal(check.tone, "normal");
    assert.equal(paceCheck(reps, "2026-06-01", "free", "lcm", 100, 60).tone, "faster");
    assert.equal(paceCheck(reps, "2026-06-01", "back", "lcm", 100, 60).kind, null);
  });

  it("parciais de 50 contra o recorde: onde ganhou e onde perdeu", () => {
    assert.deepEqual(laps50([split(50, 29)], 100, 61), [29, 32]);
    assert.equal(laps50([], 50, 27), null);
    const pb = record("pb", "2026-03-01", 60.5, { splits: [split(50, 29.5)] });
    const read = readSplits([28.7, 32.6], pb, 100)!;
    assert.deepEqual(read.tones, ["faster", "slower"]);
    assert.equal(read.refKind, "pb");
    assert.match(JSON.stringify(read.msg), /perdeu nos últimos 50/);
    assert.equal(readSplits([28.7, 32.6], record("pb", "2026-03-01", 60.5), 100)!.refKind, "plan");
  });

  it("perfil de provas só com 6 ou mais da mesma distância", () => {
    const li = (changePct: number) => ({ weekKm: 20, lastTwoKm: 20, baseKm: 30, changePct, taperWeeks: 1, sleepH: null, breakDays: null });
    const races = [60, 60.3, 60.6, 61.5, 61.8, 62].map((timeS, i) => ({ record: record(`r${i}`, `2026-0${i + 1}-10`, timeS), leadIn: li(i < 3 ? -35 : 0) }));
    assert.equal(raceProfileLines(races.slice(0, 5)).length, 0);
    assert.equal(raceProfileLines(races)[0].key, "As melhores provas de {d} m costumam coincidir com 2 semanas de volume mais baixo antes.");
  });
});

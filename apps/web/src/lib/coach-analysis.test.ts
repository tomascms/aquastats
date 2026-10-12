import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeRace, expectedTimes, loadConclusion, targetFromBest, taperVerdict, type LoadWeek } from "./coach-analysis";
import { raceReport } from "./race-report";
import type { TrainingRep } from "./training-context";
import type { RaceSession, Workout } from "./types";

let n = 0;
const rep = (date: string, workoutId: string, timeS: number, extra: Partial<TrainingRep> = {}): TrainingRep =>
  ({
    log: { id: `l${n++}` },
    timeS,
    workoutId,
    date,
    course: "lcm",
    stroke: "free",
    distanceM: 100,
    intensity: "A2",
    gear: [],
    restBucket: "10-20",
    restSeconds: 15,
    restVsSet: "same",
    blockId: "b",
    segmentIndex: 0,
    round: 1,
    repInSegment: 1,
    trainedEarlierToday: false,
    sleepHours: 8,
    ...extra,
  }) as TrainingRep;

/** Three earlier sessions of 4×100 A2 around 70 s: target 70 s, noise floor 0.35 s. */
const history = () => ["2026-09-01", "2026-09-03", "2026-09-05"].flatMap((d, i) => [69.9, 70, 70.1].map((t, k) => rep(d, `h${i}`, t, { repInSegment: k + 1 })));
const set = (times: number[], extra: Partial<TrainingRep> = {}) => times.map((t, i) => rep("2026-09-10", "today", t, { repInSegment: i + 1, ...extra }));

describe("tempo que devia fazer", () => {
  it("é a mediana das reps anteriores da mesma distância, zona e material — nunca um ritmo /100 m", () => {
    const rows = [...history(), ...set([70.5])];
    const exp = expectedTimes(rows).get(rows.at(-1)!.log.id)!;
    assert.equal(exp.targetS, 70);
    assert.equal(exp.basis, "treino");
    assert.equal(exp.n, 9);
    // A 50 at the same zone has no history: no target is invented from the 100s.
    const fifty = rep("2026-09-10", "today", 33, { distanceM: 50 });
    assert.equal(expectedTimes([...history(), fifty]).get(fifty.log.id), undefined);
  });

  it("sem histórico, vem do melhor tempo nessa distância, com correção de partida e % da zona", () => {
    const fifty = rep("2026-09-10", "today", 33, { distanceM: 50 });
    const exp = expectedTimes([fifty], new Map([["free|50", 27.2]])).get(fifty.log.id)!;
    assert.equal(exp.basis, "prova");
    assert.ok(Math.abs(exp.targetS - targetFromBest(27.2, "A2")) < 1e-9);
    assert.ok(Math.abs(exp.targetS - 28 / 0.85) < 1e-9);
  });

  it("material diferente não se mistura", () => {
    const fins = rep("2026-09-10", "today", 62, { gear: ["fins"] });
    assert.equal(expectedTimes([...history(), fins]).get(fins.log.id), undefined);
  });

});

describe("carga e prova", () => {
  const week = (km: number, vsDuePct: number | null): LoadWeek => ({ week: "", km, vsDuePct, rpe: null, sleep: null, recovery: null });

  it("lê como o atleta reage a subidas de carga", () => {
    const weeks = [week(30, 0), week(30, 0), week(30, 0), week(40, 0.2), week(30, 1.5), week(30, 0.3), week(30, 0), week(40, 0), week(30, 1.2), week(30, 0.2)];
    const msg = loadConclusion(weeks);
    assert.equal(msg.key, "Quando a carga sobe mais de 20 %, os tempos pioram {pct} % na semana seguinte e recuperam na 2.ª ({n} vezes).");
    assert.equal(msg.vars?.n, 2);
    assert.equal(loadConclusion(weeks.slice(0, 4)).key, "Ainda não houve subidas de carga suficientes para ver como este atleta reage.");
  });

  it("menos trabalho rápido só conta se a proporção cair para menos de metade", () => {
    const w = (date: string, a1: number, pa: number): Workout =>
      ({ id: date, title: "", date, shift: "afternoon", athleteIds: ["a"], blocks: [{ id: "x", type: "main", rounds: 1, segments: [{ reps: 1, distanceM: a1, intensity: "A1", details: [] }, { reps: 1, distanceM: pa, intensity: "PA", details: [] }] }] }) as unknown as Workout;
    const race = { id: "r", athleteId: "a", date: "2026-10-12", course: "lcm", distanceM: 100, stroke: "free", reactionS: 0, flightS: 0, officialTimeS: 60, laps: [] } as unknown as RaceSession;
    const block = [w("2026-09-01", 4800, 1200), w("2026-09-08", 4800, 1200), w("2026-09-15", 4800, 1200), w("2026-09-22", 4800, 1200)];
    const kept = analyzeRace(race, [race], [...block, w("2026-10-05", 2000, 500)], [], [], new Map());
    assert.equal(kept.taper?.lowSpeed, false);
    const dropped = analyzeRace(race, [race], [...block, w("2026-10-05", 2400, 100)], [], [], new Map());
    assert.equal(dropped.taper?.lowSpeed, true);
  });

  it("veredito do polimento", () => {
    assert.equal(taperVerdict(20), "pouca");
    assert.equal(taperVerdict(50), "adequada");
    assert.equal(taperVerdict(80), "demasiada");
  });

  it("polimento excessivo aparece em 'a melhorar' do treinador, e não na versão do atleta", () => {
    const w = (date: string, m: number): Workout =>
      ({ id: date, title: "", date, shift: "afternoon", athleteIds: ["a"], blocks: [{ id: "x", type: "main", rounds: 1, segments: [{ reps: 1, distanceM: m, intensity: "A1", details: [] }] }] }) as unknown as Workout;
    const workouts = [w("2026-09-01", 6000), w("2026-09-08", 6000), w("2026-09-15", 6000), w("2026-09-22", 6000), w("2026-10-05", 1000)];
    const race = { id: "r", athleteId: "a", date: "2026-10-12", course: "lcm", distanceM: 100, stroke: "free", reactionS: 0, flightS: 0, officialTimeS: 60, laps: [] } as unknown as RaceSession;
    const out = analyzeRace(race, [race], workouts, [], [], new Map());
    assert.equal(out.taper?.verdict, "demasiada");
    const mark = { id: "r", date: "2026-10-12", timeS: 60, meetTitle: "" };
    const coach = raceReport(mark, [mark], race, [race], workouts, [], [], new Map());
    assert.ok(coach.points.some((p) => p.tone === "improve" && p.what.key === "Polimento excessivo: o volume desceu {pct} % nas 2 semanas antes."));
    const athlete = raceReport(mark, [mark], race, [race], workouts, [], [], new Map(), "athlete");
    assert.ok(!athlete.points.some((p) => p.what.key.startsWith("Polimento")));
  });

  it("prova contra o MP: parciais com diferença, ritmo de prova e foco na passagem", () => {
    const split = (atM: number, s: number) => ({ atM, mm: Math.floor(s / 60), ss: Math.floor(s % 60), cc: Math.round((s % 1) * 100) });
    const pbMark = { id: "pb", date: "2026-06-01", timeS: 61.0, meetTitle: "Nacionais", splits: [split(50, 29.5)] };
    const mark = { id: "now", date: "2026-10-12", timeS: 61.6, meetTitle: "Torneio", splits: [split(50, 29.0)] };
    const race = { id: "now", athleteId: "a", date: "2026-10-12", course: "lcm", distanceM: 100, stroke: "free", reactionS: 0, flightS: 0, officialTimeS: 61.6, laps: [] } as unknown as RaceSession;
    const r = raceReport(mark, [mark, pbMark], race, [race], [], [], [], new Map());
    assert.equal(r.pb, false);
    assert.equal(r.deltaS, 0.6);
    assert.deepEqual(r.splits.map((s) => [s.thisS, s.refS]), [[29, 29.5], [32.6, 31.5]]);
    const pace = r.points.find((p) => p.tone === "improve")!;
    assert.equal(pace.what.vars?.a, 0.5);
    assert.equal(pace.next?.vars?.t, "0:29,50");
  });

  it("reação contra a do MP: só conta a partir de 0,1 s", () => {
    const race = { id: "now", athleteId: "a", date: "2026-10-12", course: "lcm", distanceM: 100, stroke: "free", reactionS: 0, flightS: 0, officialTimeS: 61.6, laps: [] } as unknown as RaceSession;
    const pbMark = { id: "pb", date: "2026-06-01", timeS: 61.0, meetTitle: "", reactionS: 0.65 };
    const slow = raceReport({ id: "now", date: "2026-10-12", timeS: 61.6, meetTitle: "", reactionS: 0.8 }, [pbMark], race, [race], [], [], [], new Map());
    assert.deepEqual(slow.reaction, { now: 0.8, ref: 0.65 });
    assert.equal(slow.points.find((p) => p.tone === "improve")?.what.vars?.s, 0.15);
    const same = raceReport({ id: "now", date: "2026-10-12", timeS: 61.6, meetTitle: "", reactionS: 0.7 }, [pbMark], race, [race], [], [], [], new Map());
    assert.ok(!same.points.some((p) => p.what.key.startsWith("Reação")));
  });
});

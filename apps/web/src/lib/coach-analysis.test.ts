import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeRace, analyzeSession, expectedTimes, loadConclusion, targetFromBest, taperVerdict, verdictOf, type LoadWeek } from "./coach-analysis";
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
const ctx = { workouts: [] as Workout[], wellness: [], athleteId: "a" };

describe("tempo que devia fazer", () => {
  it("é a mediana das reps anteriores da mesma distância, zona e material — nunca um ritmo /100 m", () => {
    const rows = [...history(), ...set([70.5])];
    const exp = expectedTimes(rows).get(rows.at(-1)!.log.id)!;
    assert.equal(exp.targetS, 70);
    assert.equal(exp.basis, "treino");
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

  it("cor: dentro do ruído é alvo", () => {
    const e = { targetS: 70, noiseS: 0.35, basis: "treino" as const };
    assert.equal(verdictOf(70.3, e), "alvo");
    assert.equal(verdictOf(71, e), "lento");
    assert.equal(verdictOf(69, e), "rapido");
  });
});

describe("frases da análise do treino", () => {
  const notesOf = (today: TrainingRep[], extra = ctx) => {
    const rows = [...history(), ...today];
    return analyzeSession(today, expectedTimes(rows), extra);
  };

  it("queda no fim com saída curta: aponta a rep, o ritmo de queda, a causa e a prevenção", () => {
    const notes = notesOf(set([70.2, 70, 70.1, 70, 70.2, 71.2, 72, 72.8], { restSeconds: 3 }));
    assert.equal(notes.length, 1);
    assert.equal(notes[0].what.key, "O rendimento caiu a partir da rep {n} nos {dist} {zone} (+{s} s/rep)");
    assert.equal(notes[0].what.vars?.n, 6);
    assert.equal(notes[0].why[0].key, "a saída deu só {s} s de descanso");
    assert.equal(notes[0].fix?.vars?.k, 5);
  });

  it("aceleração com mais descanso que o habitual", () => {
    const notes = notesOf(set([71, 71, 71, 69, 69, 69], { restVsSet: "more", restSeconds: 25 }));
    assert.equal(notes[0].what.key, "Acelerou da rep {a} à {b} nos {dist} {zone}");
    assert.ok(notes[0].why.some((w) => w.key === "a saída deu {s} s de descanso, mais que o habitual"));
  });

  it("sono mau explica um treino lento; sem causa nos dados, não inventa", () => {
    const slow = notesOf(set([71.5, 71.4, 71.6], { sleepHours: 5 }));
    assert.equal(slow[0].what.key, "Esteve {s} s mais lento que o devido nos {dist} {zone}");
    assert.deepEqual(slow[0].why, [{ key: "dormiu {h} h", vars: { h: 5 } }]);
    assert.deepEqual(notesOf(set([71.5, 71.4, 71.6]))[0].why, []);
  });

  it("nada abaixo do ruído", () => {
    assert.deepEqual(notesOf(set([70.2, 69.9, 70.1, 70])), []);
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

  it("veredito do polimento", () => {
    assert.equal(taperVerdict(20), "pouca");
    assert.equal(taperVerdict(50), "adequada");
    assert.equal(taperVerdict(80), "demasiada");
  });

  it("polimento excessivo aparece no resumo da prova", () => {
    const w = (date: string, m: number): Workout =>
      ({ id: date, title: "", date, shift: "afternoon", athleteIds: ["a"], blocks: [{ id: "x", type: "main", rounds: 1, segments: [{ reps: 1, distanceM: m, intensity: "A1", details: [] }] }] }) as unknown as Workout;
    const workouts = [w("2026-09-01", 6000), w("2026-09-08", 6000), w("2026-09-15", 6000), w("2026-09-22", 6000), w("2026-10-05", 1000)];
    const race = { id: "r", athleteId: "a", date: "2026-10-12", course: "lcm", distanceM: 100, stroke: "free", reactionS: 0, flightS: 0, officialTimeS: 60, laps: [] } as unknown as RaceSession;
    const out = analyzeRace(race, [race], workouts, [], [], new Map());
    assert.equal(out.taper?.verdict, "demasiada");
    assert.ok(out.summary.some((m) => m.key === "Polimento excessivo: o volume desceu {pct} % face ao bloco anterior."));
  });
});

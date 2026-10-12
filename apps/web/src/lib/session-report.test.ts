import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expectedTimes } from "./coach-analysis";
import { sessionReport, summariseSets, type SessionContext } from "./session-report";
import type { TrainingRep } from "./training-context";
import type { WellnessEntry } from "./types";

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
    gearLabel: "",
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

/** Six earlier sessions of 4×100 A2 around 70 s (spread ~0.5 s): target 70 s, TE = floor 0.56 s. */
const history = () =>
  ["2026-08-20", "2026-08-24", "2026-08-28", "2026-09-01", "2026-09-03", "2026-09-05"].flatMap((d, i) => [69.8, 70, 70.2, 70].map((t, k) => rep(d, `h${i}`, t, { repInSegment: k + 1 })));
const set = (times: number[], extra: Partial<TrainingRep> = {}) => times.map((t, i) => rep("2026-09-10", "today", t, { repInSegment: i + 1, ...extra }));
const ctx = (wellness: WellnessEntry[] = []): SessionContext => ({ workouts: [], wellness, athleteId: "a" });
const read = (today: TrainingRep[], c = ctx(), audience: "coach" | "athlete" = "coach") => sessionReport(today, expectedTimes([...history(), ...today]), c, audience);

describe("relatório do treino", () => {
  it("queda no fim com saída curta: rep, ritmo de queda, coincidência e opção para a próxima", () => {
    const r = read(set([70.2, 70, 70.1, 70, 70.2, 71.4, 72.2, 73], { restSeconds: 3 }));
    assert.equal(r.headline.key, "Treino com quebra no fim dos {reps}×{dist} {zone}.");
    const p = r.points.find((x) => x.tone === "improve")!;
    assert.equal(p.what.key, "Quebrou a partir da rep {n} nos {reps}×{dist} {zone}: +{s} s por rep até ao fim.");
    assert.equal(p.what.vars?.n, 6);
    assert.equal(p.why?.[0].key, "saída com só {s} s de descanso");
    assert.equal(p.next?.vars?.k, 5);
  });

  it("mais rápido com certeza: ponto forte primeiro, e o treinador pode apertar o tempo", () => {
    const r = read(set([68.6, 68.5, 68.7, 68.4]));
    assert.equal(r.tone, "good");
    assert.equal(r.points[0].tone, "good");
    assert.equal(r.points[0].what.key, "Mais rápido que o habitual nos {reps}×{dist} {zone}: −{s} s por rep ({c}).");
    assert.deepEqual(r.points[0].what.vars?.c, { key: "quase de certeza" });
  });

  it("sono mau coincide com um treino lento, face ao habitual do próprio; sem causa, diz que não há", () => {
    const wellness = ["2026-09-01", "2026-09-03", "2026-09-05", "2026-09-07"].map((date) => ({ date, sleepHours: 8, gym: null, recovery: 4 }));
    const slow = read(set([71.6, 71.5, 71.7, 71.6], { sleepHours: 5 }), ctx(wellness));
    const p = slow.points.find((x) => x.tone === "improve")!;
    assert.deepEqual(p.why, [{ key: "dormiu {h} h (costuma {u} h)", vars: { h: 5, u: 8 } }]);
    assert.equal(p.next?.key, "Uma sessão não é tendência: ver a próxima antes de mudar o plano.");
    assert.deepEqual(read(set([71.6, 71.5, 71.7, 71.6])).points.find((x) => x.tone === "improve")?.why, [{ key: "sem causa clara nos dados" }]);
  });

  it("uma série lenta em três não faz um treino 'misto' nem 'abaixo'", () => {
    const other = (d: string, w: string, dist: number, base: number, seg: number) => [base, base + 0.1, base - 0.1, base].map((t, k) => rep(d, w, t, { distanceM: dist, segmentIndex: seg, repInSegment: k + 1 }));
    const days = ["2026-08-20", "2026-08-24", "2026-08-28", "2026-09-01"];
    const hist = [...history(), ...days.flatMap((d, i) => [...other(d, `h${i}`, 50, 35, 1), ...other(d, `h${i}`, 200, 150, 2)])];
    const today = [...set([71.6, 71.5, 71.7, 71.6]), ...other("2026-09-10", "today", 50, 35, 1), ...other("2026-09-10", "today", 200, 150, 2)];
    const r = sessionReport(today, expectedTimes([...hist, ...today]), ctx());
    assert.equal(r.headline.key, "Quase tudo ao nível habitual: {k} de {m} séries abaixo.");
    assert.equal(r.headline.vars?.m, 3);
  });

  it("numa série longa, a quebra das últimas reps não se dilui na média de metades", () => {
    const times = [...Array(15).fill(73), ...Array(8).fill(73.8)];
    const [summary] = summariseSets(set(times), new Map());
    assert.ok(summary.endDeltaS! > 0.7, `fim ${summary.endDeltaS}`);
  });

  it("nada abaixo do ruído: treino ao nível habitual", () => {
    const r = read(set([70.1, 69.9, 70.1, 70]));
    assert.equal(r.headline.key, "Treino ao nível habitual: {m} séries no tempo devido.");
    assert.equal(r.points.filter((p) => p.tone === "improve").length, 0);
  });

  it("série nova sem histórico: ainda não dá para dizer", () => {
    const r = sessionReport(set([33, 33.2], { distanceM: 50 }), expectedTimes(set([33, 33.2], { distanceM: 50 })), ctx());
    assert.equal(r.tone, "unclear");
  });

  it("o atleta vê no máximo um ponto forte e um foco, na 2.ª pessoa", () => {
    const r = read(set([70.2, 70, 70.1, 70, 70.2, 71.4, 72.2, 73], { restSeconds: 3 }), ctx(), "athlete");
    assert.ok(r.points.length <= 2);
    assert.equal(r.points.find((p) => p.tone === "improve")?.next?.key, "Foco para a próxima: manter o ritmo das primeiras reps até ao fim.");
  });
});

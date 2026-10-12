import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SplitTime, TimeLog } from "../types";
import { cssOf } from "../indicators";
import { annotateTrainingReps } from "../training-context";
import { cssSpeed, dayOf, generateDataset, KEY_EVENT, LEVEL_POINTS, LEVELS, PEAK_GAIN, maxTime, SCENARIOS, structuralTime, waPoints } from "./synthetic";

/*
 * Invariants of generator 4.0 (docs/natacao/gerador.md, G1–G8; pre-registered in docs/ml/protocolo.md).
 * Development seeds 6101–6115; three of them here to keep CI fast.
 */

const SEEDS = [6101, 6102, 6103];
const config = { ...SCENARIOS.tipico, athletes: 18 };
const data = SEEDS.map((seed) => generateDataset(config, seed));
const seconds = (t: { mm: number; ss: number; cc: number }) => t.mm * 60 + t.ss + t.cc / 100;
const INTENSITY_ORDER = ["SUAVE", "A1", "A2", "A3", "PA", "MAX"];

describe("gerador 4.0 — invariantes", () => {
  it("G1: todas as reps de todos os atletas presentes têm tempo; faltas registadas à parte", () => {
    for (const d of data) {
      const logs = new Set(d.timeLogs.map((t) => `${t.workoutId}|${t.blockId}|${t.athleteId}|${t.repNumber}`));
      const roll = new Map(d.attendance.map((a) => [a.workoutId, a]));
      for (const w of d.workouts) {
        const call = roll.get(w.id);
        assert.ok(call, `sem chamada em ${w.id}`);
        assert.deepEqual([...w.athleteIds].sort(), [...call.present].sort());
        for (const absent of call.absent) assert.ok(!w.athleteIds.includes(absent));
        for (const block of w.blocks) {
          const reps = block.rounds * block.segments.reduce((sum, s) => sum + s.reps, 0);
          for (const athleteId of w.athleteIds)
            for (let r = 1; r <= reps; r += 1) assert.ok(logs.has(`${w.id}|${block.id}|${athleteId}|${r}`), `falta ${w.id} ${block.id} ${athleteId} rep ${r}`);
        }
      }
    }
  });

  it("G2: o ritmo fica mais rápido com a intensidade, para cada atleta", () => {
    for (const d of data) {
      const blocks = new Map(d.workouts.flatMap((w) => w.blocks.map((b) => [`${w.id}|${b.id}`, { b, course: w.course }])));
      const paces = new Map<string, number[]>();
      for (const t of d.timeLogs) {
        const found = blocks.get(`${t.workoutId}|${t.blockId}`);
        if (!found || found.b.segments.length !== 1) continue;
        const seg = found.b.segments[0];
        if (seg.gear.length || t.stroke !== "free" || seg.distanceM < 50 || seg.distanceM > 200 || found.course !== "scm") continue;
        const key = `${t.athleteId}|${seg.distanceM}|${seg.intensity}`;
        paces.set(key, [...(paces.get(key) ?? []), (seconds(t) / seg.distanceM) * 100]);
      }
      const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
      for (const a of d.athletes)
        for (const m of [50, 100, 200]) {
          const ordered = INTENSITY_ORDER.map((i) => paces.get(`${a.id}|${m}|${i}`)).filter((xs): xs is number[] => !!xs && xs.length >= 5).map(median);
          for (let i = 1; i < ordered.length; i += 1) assert.ok(ordered[i] < ordered[i - 1], `${a.id} ${m} m: ${ordered.map((x) => x.toFixed(1))}`);
        }
    }
  });

  it("G3: a prova principal no pico (taper e fato) cai na banda de pontos do nível; nada passa os 1000 pontos", () => {
    for (const d of data) {
      const end = dayOf(d.dataEnd);
      for (const a of d.athletes) {
        const p = a.profile;
        const dive = (m: number) => structuralTime(p, { distanceM: m, intensity: "MAX", fromBlock: true, gear: [], stroke: "free" }, "lcm", end).timeS;
        const points = waPoints(dive(KEY_EVENT[a.group]), p.sex, KEY_EVENT[a.group]);
        const [lo, hi] = LEVEL_POINTS[p.level];
        const peak = waPoints(dive(KEY_EVENT[a.group]) / (1 + PEAK_GAIN), p.sex, KEY_EVENT[a.group]);
        assert.ok(peak >= lo - 5 && peak <= hi + 5, `${a.id} ${p.level} ${peak.toFixed(0)} pts`);
        for (const m of [50, 100, 200, 400, 800, 1500]) assert.ok(waPoints(dive(m), p.sex, m) < 1000, `${a.id} ${m} m`);
      }
      for (const r of d.races) {
        const a = d.athletes.find((x) => x.id === r.athleteId)!;
        if (r.course === "lcm" && r.stroke === "free") assert.ok(waPoints(r.timeS, a.profile.sex, r.distanceM) < 1000, `prova ${r.athleteId} ${r.distanceM} ${r.timeS}`);
      }
    }
  });

  it("G4: razões 50/100/200/400 e 25 m/50 m dentro dos limites das referências", () => {
    const d = data[0];
    const end = dayOf(d.dataEnd);
    for (const a of d.athletes) {
      const p = a.profile;
      const t = (m: number) => maxTime(p, m, end);
      assert.ok(t(50) / t(100) > 0.43 && t(50) / t(100) < 0.48);
      assert.ok(t(200) / t(100) > 2.1 && t(200) / t(100) < 2.32);
      assert.ok(t(400) / t(200) > 2.04 && t(400) / t(200) < 2.23);
      for (const stroke of ["free", "back", "breast", "fly"] as const) {
        const rep = { distanceM: 100, intensity: "MAX" as const, fromBlock: true, gear: [], stroke };
        const ratio = structuralTime(p, rep, "lcm", end).timeS / structuralTime(p, rep, "scm", end).timeS;
        assert.ok(ratio > 1.005 && ratio < 1.08, `${a.id} ${stroke} ${ratio.toFixed(3)}`);
      }
    }
  });

  it("G5: a soma dos parciais é o tempo final", () => {
    const last = (splits: SplitTime[]) => seconds(splits[splits.length - 1]);
    for (const d of data) {
      for (const t of d.timeLogs as TimeLog[]) if (t.splits.length) assert.ok(Math.abs(last(t.splits) - seconds(t)) < 0.011);
      for (const r of d.races) if (r.splits.length) assert.ok(Math.abs(last(r.splits) - r.timeS) < 0.011);
    }
  });

  it("G6: sem saltos dia a dia (mesma série, sessões até 3 dias de distância)", () => {
    for (const d of data) {
      const sig = new Map(d.workouts.flatMap((w) => w.blocks.map((b) => [`${w.id}|${b.id}`, { day: dayOf(w.date), key: `${w.course}|${JSON.stringify(b.segments.map((s) => [s.distanceM, s.intensity, s.gear, s.stroke]))}` }])));
      const sessions = new Map<string, { day: number; times: number[] }>();
      for (const t of d.timeLogs) {
        const s = sig.get(`${t.workoutId}|${t.blockId}`)!;
        const key = `${t.athleteId}|${t.stroke}|${s.key}|${s.day}`;
        const entry = sessions.get(key) ?? { day: s.day, times: [] };
        entry.times.push(seconds(t));
        sessions.set(key, entry);
      }
      const byKey = new Map<string, { day: number; mean: number }[]>();
      for (const [key, v] of sessions) {
        const base = key.slice(0, key.lastIndexOf("|"));
        byKey.set(base, [...(byKey.get(base) ?? []), { day: v.day, mean: v.times.reduce((a, b) => a + b, 0) / v.times.length }]);
      }
      const jumps: number[] = [];
      for (const list of byKey.values()) {
        list.sort((a, b) => a.day - b.day);
        for (let i = 1; i < list.length; i += 1) if (list[i].day - list[i - 1].day <= 3) jumps.push(Math.abs(list[i].mean / list[i - 1].mean - 1));
      }
      jumps.sort((a, b) => a - b);
      assert.ok(jumps.length > 50);
      assert.ok(jumps[Math.floor(jumps.length * 0.95)] < 0.05, `p95 ${jumps[Math.floor(jumps.length * 0.95)]}`);
      assert.ok(jumps[jumps.length - 1] < 0.15, `máx ${jumps[jumps.length - 1]}`);
    }
  });

  it("G7: a mesma semente dá os mesmos dados", () => {
    const again = generateDataset(config, SEEDS[0]);
    assert.deepEqual(JSON.stringify([again.timeLogs, again.races, again.attendance]), JSON.stringify([data[0].timeLogs, data[0].races, data[0].attendance]));
  });

  it("G9: o teste CSS em treino mede a CSS fresca com o erro de um teste real (mediana < 4 %, p90 < 8 %)", () => {
    // A test in a heavy training week reads slower than fresh capacity: that is the state the zones should follow.
    const errors: number[] = [];
    for (const d of data)
      for (const a of d.athletes) {
        const est = cssOf(annotateTrainingReps(d.workouts, d.timeLogs, a.id), [], d.dataEnd);
        if (est?.date) errors.push(Math.abs(est.value / (100 / cssSpeed(a.profile, dayOf(est.date))) - 1));
      }
    errors.sort((x, y) => x - y);
    assert.ok(errors.length >= 20, `${errors.length} testes`);
    assert.ok(errors[errors.length >> 1] < 0.04, `mediana ${errors[errors.length >> 1]}`);
    // One test can be off by the day's noise: T400 − T200 roughly doubles an error in either swim.
    assert.ok(errors[Math.floor(errors.length * 0.9)] < 0.08, `p90 ${errors[Math.floor(errors.length * 0.9)]}`);
  });

  it("G8: todos os níveis e os dois sexos estão representados", () => {
    for (const d of data) {
      const levels = new Set(d.athletes.map((a) => a.profile.level));
      assert.equal(levels.size, LEVELS.length);
      assert.equal(new Set(d.athletes.map((a) => a.profile.sex)).size, 2);
    }
  });
});

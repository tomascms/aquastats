import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays } from "./dates";
import { breakdown, formDays, loadSlope, setCurve, setsOf, type ExplainedRep } from "./explained-times";
import type { TrainingRep } from "./training-context";
import { explainTrainingTargets, predictTrainingTargets } from "./training-prediction";

let n = 0;
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.6;

/** 70 days, one 4 × 100 free A2 set a day; mornings 1 s slower, short sleep on Fridays, 2 rare explosive-gym days. */
const rows: TrainingRep[] = Array.from({ length: 70 }, (_, d) => {
  const date = addDays("2026-07-01", d);
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const morning = d % 3 === 0;
  return [1, 2, 3, 4].map(
    (k) =>
      ({
        log: { id: `l${n++}` },
        workoutId: `w${date}`,
        blockId: "b",
        segmentIndex: 0,
        round: 1,
        date,
        weekday,
        shift: morning ? "morning" : "afternoon",
        trainedEarlierToday: false,
        segmentReps: 4,
        repInSegment: k,
        restSeconds: 20,
        fromBlock: false,
        loadBeforeM: 1000 + k * 100,
        weeklyLoadM: 8000 + (d % 7) * 4000,
        sleepHours: weekday === 4 ? 6 : null,
        gymType: d === 20 || d === 40 ? "explosive" : null,
        course: "lcm",
        stroke: "free",
        distanceM: 100,
        intensity: "A2",
        gear: [],
        gearLabel: "",
        timeS: 70 + (morning ? 1 : 0) + k * 0.2 + noise(),
      }) as unknown as TrainingRep,
  );
}).flat();

const explained = explainTrainingTargets(rows);
const list: ExplainedRep[] = rows.filter((row) => explained.has(row.log.id)).map((row) => ({ ...explained.get(row.log.id)!, row }));
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

describe("tempos explicados: decomposição", () => {
  it("nível + pesos = esperado, igual ao alvo do modelo; + resto = real", () => {
    const targets = predictTrainingTargets(rows);
    assert.ok(list.length > 200);
    for (const rep of list) {
      const sum = rep.levelS + rep.factors.reduce((s, f) => s + f.seconds, 0);
      close(sum, rep.expectedS);
      close(rep.expectedS, targets.get(rep.row.log.id)!.targetS);
      close(sum + (rep.actualS - rep.expectedS), rep.row.timeS);
    }
  });

  it("treino e semana: a soma dos pesos mais o resto bate com o real", () => {
    for (const slice of [list.filter((r) => r.row.date === "2026-08-20"), list.filter((r) => r.row.date >= "2026-08-17" && r.row.date <= "2026-08-23")]) {
      const b = breakdown(slice)!;
      close(b.levelS + b.factors.reduce((s, f) => s + f.seconds, 0) + b.unexplainedS, b.actualS);
      close(b.actualS, slice.reduce((s, r) => s + r.row.timeS, 0));
    }
  });

  it("um fator com menos de 8 reps nunca aparece com nome", () => {
    for (const rep of list) {
      for (const f of rep.factors) if (f.key !== "few-data" && f.key !== "trend") assert.ok(f.support >= 8, `${f.key} ${f.support}`);
      if (rep.row.gymType === "explosive") assert.ok(!rep.factors.some((f) => f.key === "gymExplosive"));
    }
  });

  it("manhã associa-se a tempos mais lentos; desvios < 1 % são ruído", () => {
    const late = list.filter((r) => r.row.date > "2026-08-20" && r.row.shift === "morning");
    assert.ok(late.every((r) => (r.factors.find((f) => f.key === "morning")?.pct ?? 0) > 0.5));
    const flat = breakdown(list.filter((r) => Math.abs(r.actualS / r.levelS - 1) < 0.005))!;
    assert.equal(flat.noise, true);
  });
});

describe("tempos explicados: época, série e carga", () => {
  it("forma diária com média de 7 dias", () => {
    const days = formDays(list);
    assert.ok(days.length > 50);
    const last = days.at(-1)!;
    const window = list.filter((r) => r.row.date > addDays(last.date, -7));
    close(last.rollingPct, (window.reduce((s, r) => s + r.actualS / r.levelS - 1, 0) / window.length) * 100);
  });

  it("curva da série contra séries iguais anteriores", () => {
    const sets = setsOf(list);
    const curve = setCurve(sets.at(-1)!, sets);
    assert.equal(curve.times.length, 4);
    assert.ok(curve.usualN > 30);
    assert.ok(curve.usual.every((v) => v != null && v > 69));
    assert.ok(curve.usualFadePct! > 0);
  });

  it("declive da carga: precisa de 6 semanas", () => {
    assert.equal(loadSlope([1, 2, 3].map((i) => ({ week: `w${i}`, km: i * 10, devPct: i, n: 5, phase: null }))), null);
    const s = loadSlope([10, 20, 30, 40, 50, 60].map((km, i) => ({ week: `w${i}`, km, devPct: km / 10 + (i % 2) * 0.1, n: 5, phase: null })))!;
    assert.ok(Math.abs(s.per10Pct - 1) < 0.05 && s.marginPct > 0 && s.n === 6);
  });
});

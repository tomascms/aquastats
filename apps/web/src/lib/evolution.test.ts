import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evolution } from "./evolution";
import type { TrainingRep } from "./training-context";

let n = 0;
const rep = (date: string, timeS: number, extra: Partial<TrainingRep> = {}): TrainingRep =>
  ({ log: { id: `l${n++}` }, workoutId: `w${date}`, date, timeS, course: "lcm", stroke: "free", distanceM: 100, intensity: "A2", gear: [], gearLabel: "", ...extra }) as TrainingRep;
const session = (date: string, times: number[], extra: Partial<TrainingRep> = {}) => times.map((t) => rep(date, t, extra));
const today = "2026-10-12";

describe("evolução por tipo de série", () => {
  const base = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"].flatMap((d, i) => session(d, [70 + (i % 2) * 0.2, 70.1, 69.9]));

  it("mais rápido nas últimas 2 semanas face às 6 anteriores", () => {
    const out = evolution([...base, ...session("2026-10-01", [68.8, 68.9]), ...session("2026-10-08", [68.7, 68.9])], today);
    assert.equal(out.kinds[0].verdict.dir, "faster");
    assert.equal(out.kinds[0].newBest, true);
    assert.equal(out.headline.key, "A melhorar: mais rápido em {k} de {m} tipos de série nas últimas 2 semanas.");
  });

  it("nunca mistura distâncias nem zonas, e ignora o SUAVE", () => {
    const out = evolution([...base, ...session("2026-10-01", [33], { distanceM: 50 }), ...session("2026-10-02", [90], { intensity: "SUAVE" })], today);
    assert.equal(out.kinds.length, 1);
    assert.equal(out.kinds[0].distanceM, 100);
  });

  it("sem sessões recentes: ainda não dá para dizer", () => {
    const out = evolution(base, today);
    assert.equal(out.kinds[0].verdict.dir, "unclear");
    assert.equal(out.headline.key, "Ainda não dá para dizer: poucas séries repetidas nas últimas semanas.");
  });
});

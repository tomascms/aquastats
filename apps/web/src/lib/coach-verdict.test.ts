import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareTimes, repPosition, typicalError, vsUsual } from "./coach-verdict";

describe("veredito para um nadador", () => {
  // Junior 100 A2 around 70 s, typical spread 0.7 s (1 %).
  const te = 0.7;

  it("uma diferença grande face a muitas reps é 'quase de certeza'", () => {
    assert.deepEqual(compareTimes(68.5, 4, 70, 12, te), { dir: "faster", certainty: "quase" });
  });

  it("uma diferença moderada é 'provavelmente'", () => {
    assert.deepEqual(compareTimes(70.85, 4, 70, 12, te), { dir: "slower", certainty: "provavel" });
  });

  it("dentro do ruído é 'igual ao habitual'", () => {
    assert.deepEqual(compareTimes(70.2, 4, 70, 12, te), { dir: "same" });
  });

  it("com menos de 3 reps de histórico não se diz nada", () => {
    assert.deepEqual(compareTimes(65, 4, 70, 2, te), { dir: "unclear", reason: "poucos-dados" });
  });

  it("entre o ruído e o 'provavelmente' fica 'ainda não dá para dizer'", () => {
    assert.equal(compareTimes(70.6, 1, 70, 3, te).dir, "unclear");
  });

  it("uma série de 8 reps não conta como 8 provas independentes", () => {
    // Same difference: 8 reps must not be more certain than 4.
    assert.deepEqual(compareTimes(70.85, 8, 70, 12, te), compareTimes(70.85, 4, 70, 12, te));
  });

  it("o erro típico tem um mínimo, e com pouco histórico usa o prior", () => {
    assert.equal(typicalError([70, 70, 70, 70, 70, 70], 70), 0.008 * 70);
    assert.equal(typicalError([70, 70.1], 70), 0.015 * 70);
  });

  it("rep isolada: dentro da faixa é 'no tempo'", () => {
    assert.equal(repPosition(70.5, 70, te), "same");
    assert.equal(repPosition(71, 70, te), "slower");
    assert.equal(repPosition(69, 70, te), "faster");
  });

  it("carga e sono: acima/abaixo do habitual do próprio", () => {
    assert.equal(vsUsual(45, [30, 32, 31, 29]), "muito-acima");
    assert.equal(vsUsual(31, [30, 32, 31, 29]), "habitual");
    assert.equal(vsUsual(31, [30, 32]), null);
  });
});

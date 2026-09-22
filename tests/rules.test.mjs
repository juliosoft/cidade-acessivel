import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePhase } from "../lib/rules.js";
const phase = (extra = {}) => ({
  level: 1,
  choices: [1, 2],
  collectibles: [0, 1],
  elapsedMs: 60000,
  ...extra,
});
test("Pontua escolhas e bônus proporcional ao tempo", () => {
  const p = calculatePhase(phase());
  assert.equal(p.score, 280);
  assert.equal(p.bonus, 60);
});
test("Ignorar todas as ações é permitido e não dá bônus de corrida", () => {
  const p = calculatePhase(phase({ choices: [null, null] }));
  assert.equal(p.score, 20);
  assert.equal(p.skipped, 2);
  assert.equal(p.bonus, 0);
});
test("Escolha parcial tem pontos próprios e não corrige barreira", () => {
  const p = calculatePhase(phase({ choices: [2, 2] }));
  assert.equal(p.score, 175);
  assert.equal(p.corrected, 1);
});
test("Tempo de fase e escolhas inválidas não entram no ranking", () => {
  for (const extra of [
    { elapsedMs: 1 },
    { level: 4 },
    { choices: [3, null] },
    { collectibles: [0, 0] },
    { collectibles: [10] },
    { choices: [null] },
  ])
    assert.throws(() => calculatePhase(phase(extra)));
});
test("Bônus não fica negativo em fases lentas", () =>
  assert.equal(calculatePhase(phase({ elapsedMs: 180000 })).bonus, 0));

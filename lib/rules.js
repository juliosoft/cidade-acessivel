export const choiceScores = [
  [10, 100, 25],
  [0, 0, 100],
  [100, 10, 0],
  [0, 100, 0],
  [0, 0, 100],
  [100, 0, 0],
];
export function calculatePhase(input) {
  const { level, choices, collectibles, elapsedMs } = input;
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 3 ||
    !Array.isArray(choices) ||
    choices.length !== 2 ||
    choices.some(
      (v) => v !== null && (!Number.isInteger(v) || v < 0 || v > 2),
    ) ||
    !Array.isArray(collectibles) ||
    new Set(collectibles).size !== collectibles.length ||
    collectibles.some((v) => !Number.isInteger(v) || v < 0 || v > 9) ||
    !Number.isInteger(elapsedMs) ||
    elapsedMs < 8000 ||
    elapsedMs > 86400000
  )
    throw new Error("Resultado de fase inválido.");
  const actionPoints = choices.map((v, i) =>
    v === null ? 0 : choiceScores[(level - 1) * 2 + i][v],
  );
  const corrected = actionPoints.filter((v) => v === 100).length;
  const bonus = Math.floor(
    (Math.max(0, 120 - elapsedMs / 1000) * corrected) / 2,
  );
  return {
    level,
    choices,
    collectibles,
    elapsed_ms: elapsedMs,
    action_points: actionPoints,
    corrected,
    skipped: choices.filter((v) => v === null).length,
    bonus,
    score:
      actionPoints.reduce((a, b) => a + b, 0) +
      collectibles.length * 10 +
      bonus,
  };
}

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { calculatePhase } from "./rules.js";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function playerFrom(value) {
  if (typeof value !== "string") fail(400, "Informe seu nickname.");
  const nickname = value.normalize("NFKC").trim();
  if (!/^[\p{L}\p{N}_-]{3,12}$/u.test(nickname))
    fail(400, "Use de 3 a 12 letras, números, hífen ou sublinhado.");
  return { nickname, key: hash(nickname.toLowerCase()) };
}
function runPath(player, id, level) {
  return `partidas/${player.key}/${id}/${level}.json`;
}
function visible(run) {
  const { tokenHash, ...publicRun } = run;
  return publicRun;
}
export function compareRuns(a, b) {
  return (
    b.score - a.score ||
    a.total_ms - b.total_ms ||
    a.finished_at.localeCompare(b.finished_at) ||
    a.id.localeCompare(b.id)
  );
}
async function mapLimit(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
export function createGameService(store, clock = () => Date.now()) {
  let rankCache = null;
  return {
    async start(nickname) {
      const player = playerFrom(nickname),
        id = randomUUID(),
        runToken = randomBytes(24).toString("hex"),
        now = new Date(clock()).toISOString();
      const run = {
        id,
        nickname: player.nickname,
        status: "playing",
        phases: [],
        score: 0,
        total_ms: 0,
        started_at: now,
        phase_started_at: now,
        finished_at: null,
        tokenHash: hash(runToken),
      };
      await store.create(runPath(player, id, 0), run);
      return { runId: id, runToken };
    },
    async phase(body) {
      const player = playerFrom(body.nickname),
        id = body.runId;
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id || "",
        )
      )
        fail(400, "Partida inválida.");
      let result;
      try {
        result = calculatePhase(body);
      } catch (e) {
        fail(400, e.message);
      }
      const base = await store.get(runPath(player, id, 0));
      if (!base) fail(404, "Partida não encontrada.");
      if (
        typeof body.runToken !== "string" ||
        hash(body.runToken) !== base.tokenHash
      )
        fail(
          403,
          "Esta aba não possui a identificação da partida. Inicie outra partida.",
        );
      const path = runPath(player, id, result.level);
      function replay(existing) {
        if (
          JSON.stringify(existing.phases[result.level - 1]) !==
          JSON.stringify(result)
        )
          fail(409, "Esta fase já foi salva com outra resposta.");
        return { run: visible(existing), phase: result };
      }
      const existing = await store.get(path);
      if (existing) return replay(existing);
      const previous =
        result.level === 1
          ? base
          : await store.get(runPath(player, id, result.level - 1));
      if (!previous || previous.phases.length !== result.level - 1)
        fail(409, "Conclua as fases na ordem.");
      if (
        result.elapsed_ms >
        clock() - Date.parse(previous.phase_started_at) + 1500
      )
        fail(400, "Tempo incompatível com a partida.");
      const now = new Date(clock()).toISOString();
      const run = {
        ...previous,
        phases: [...previous.phases, result],
        score: previous.score + result.score,
        total_ms: previous.total_ms + result.elapsed_ms,
        phase_started_at: now,
        status: result.level === 3 ? "completed" : "playing",
        finished_at: result.level === 3 ? now : null,
      };
      const created = await store.create(path, run);
      if (!created) {
        const winner = await store.get(path);
        if (!winner) fail(503, "A fase está sendo salva. Tente novamente.");
        return replay(winner);
      }
      rankCache = null;
      return { run: visible(run), phase: result };
    },
    async ranking() {
      if (rankCache && rankCache.until > clock()) return rankCache.rows;
      const keys = (await store.list("partidas/")).filter((k) =>
        k.endsWith("/3.json"),
      );
      const rows = (await mapLimit(keys, (k) => store.get(k)))
        .filter(Boolean)
        .map(visible)
        .sort(compareRuns)
        .slice(0, 10);
      rankCache = { rows, until: clock() + 30000 };
      return rows;
    },
    async history(nickname) {
      const player = playerFrom(nickname),
        keys = await store.list(`partidas/${player.key}/`),
        latest = new Map();
      for (const key of keys) {
        const match = key.match(/\/([0-3])\.json$/);
        if (!match) continue;
        const group = key.slice(0, -6),
          level = Number(match[1]);
        if (!latest.has(group) || latest.get(group).level < level)
          latest.set(group, { key, level });
      }
      return (await mapLimit([...latest.values()], (v) => store.get(v.key)))
        .filter(Boolean)
        .map(visible)
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, 50);
    },
  };
}

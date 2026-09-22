import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLocalStorage,
  storageMode,
  createBlobStorage,
} from "../lib/storage.js";
import { createGameService, playerFrom } from "../lib/game-service.js";
async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), "cidade-test-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  let now = 1000000;
  const store = createLocalStorage(folder),
    service = createGameService(store, () => now);
  return { store, service, advance: () => (now += 20000) };
}
function result(run, level = 1, extra = {}) {
  return {
    ...run,
    nickname: "Aluno",
    level,
    choices: [null, null],
    collectibles: [],
    elapsedMs: 10000,
    ...extra,
  };
}
test("Configuração local automática e bloqueio de disco efêmero na Vercel", () => {
  assert.equal(storageMode({}), "local");
  assert.equal(storageMode({ VERCEL: "1" }), "blob");
  assert.throws(() => storageMode({ VERCEL: "1", STORAGE_MODE: "local" }));
});
test("Nickname normalizado, sem senha", () => {
  assert.equal(playerFrom("Aluno").key, playerFrom("aluno").key);
  assert.throws(() => playerFrom("../a"));
  assert.throws(() => playerFrom("a b"));
});
test("Três fases salvas, ranking e histórico persistem após recriar serviço", async (t) => {
  const { store, service, advance } = await fixture(t),
    run = await service.start("Aluno");
  for (let i = 1; i <= 3; i++) {
    advance();
    await service.phase(result(run, i));
  }
  const other = createGameService(store);
  const ranks = await other.ranking(),
    history = await other.history("ALUNO");
  assert.equal(ranks.length, 1);
  assert.equal(history[0].phases.length, 3);
  assert.equal(ranks[0].total_ms, 30000);
  assert(!("tokenHash" in ranks[0]));
  assert.equal(history[0].status, "completed");
});
test("Respostas concorrentes diferentes: uma vence e a outra não sobrescreve", async (t) => {
  const { service, advance } = await fixture(t),
    run = await service.start("Aluno");
  advance();
  const results = await Promise.allSettled([
    service.phase(result(run)),
    service.phase(result(run, 1, { choices: [1, 2] })),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.status, 409);
});
test("Reenvios concorrentes idênticos não duplicam pontos", async (t) => {
  const { service, advance } = await fixture(t),
    run = await service.start("Aluno");
  advance();
  const b = result(run, 1, { choices: [1, 2] });
  const rows = await Promise.all([service.phase(b), service.phase(b)]);
  assert.equal(rows[0].run.score, rows[1].run.score);
  assert.equal((await service.history("Aluno"))[0].phases.length, 1);
});
test("Token de outra aba e ordem de fase inválida são rejeitados", async (t) => {
  const { service, advance } = await fixture(t),
    run = await service.start("Aluno");
  advance();
  await assert.rejects(service.phase(result(run, 1, { runToken: "wrong" })), {
    status: 403,
  });
  await assert.rejects(service.phase(result(run, 2)), { status: 409 });
});
test("Mesmo nickname em dispositivos distintos não mistura partidas", async (t) => {
  const { service, advance } = await fixture(t),
    a = await service.start("Aluno"),
    b = await service.start("Aluno");
  advance();
  await Promise.all([service.phase(result(a)), service.phase(result(b))]);
  assert.equal((await service.history("Aluno")).length, 2);
});
test("Ranking considera pontos e desempata pelo menor tempo", async (t) => {
  const { service, advance } = await fixture(t);
  for (const ms of [12000, 10000]) {
    const run = await service.start("Aluno");
    for (let i = 1; i <= 3; i++) {
      advance();
      await service.phase(result(run, i, { elapsedMs: ms }));
    }
  }
  const rows = await service.ranking();
  assert.equal(rows[0].total_ms, 30000);
  assert.equal(rows[1].total_ms, 36000);
});
test("Adaptador Blob usa JSON privado, pagina listas e reconhece reenvio", async () => {
  const records = new Map();
  let pages = 0;
  const sdk = {
    async put(k, v, opts) {
      assert.equal(opts.access, "private");
      assert.equal(opts.allowOverwrite, false);
      if (records.has(k)) throw new Error("Blob already exists");
      records.set(k, v);
    },
    async get(k, opts) {
      assert.equal(opts.useCache, false);
      if (!records.has(k)) return null;
      return { statusCode: 200, stream: new Response(records.get(k)).body };
    },
    async list(opts) {
      pages++;
      return opts.cursor
        ? { blobs: [{ pathname: "test/b.json" }], hasMore: false }
        : {
            blobs: [{ pathname: "test/a.json" }],
            hasMore: true,
            cursor: "next",
          };
    },
  };
  const store = createBlobStorage(sdk, "test/");
  assert.equal(await store.create("a.json", { score: 4 }), true);
  assert.equal(await store.create("a.json", { score: 8 }), false);
  assert.deepEqual(await store.get("a.json"), { score: 4 });
  assert.deepEqual(await store.list(""), ["a.json", "b.json"]);
  assert.equal(pages, 2);
});

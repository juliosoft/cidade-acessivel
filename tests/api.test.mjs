import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/game.js";
async function call(
  action,
  body,
  method = body === undefined ? "GET" : "POST",
  origin,
) {
  let code = 200,
    data;
  const req = {
    url: "/api/game?action=" + action,
    method,
    headers: { host: "localhost:3000", origin },
    body,
  };
  const res = {
    setHeader() {},
    status(n) {
      code = n;
      return this;
    },
    json(d) {
      data = d;
      return this;
    },
  };
  await handler(req, res);
  return { code, data };
}
test("Nickname funciona sem senha e sem banco configurado", async () => {
  const r = await call("identify", { nickname: "Aluno" });
  assert.equal(r.code, 200);
  assert.equal(r.data.player.nickname, "Aluno");
});
test("Método incorreto, origem externa e JSON inválido são rejeitados", async () => {
  assert.equal((await call("start", undefined, "GET")).code, 405);
  assert.equal(
    (await call("start", {}, "POST", "https://elsewhere.test")).code,
    403,
  );
  assert.equal((await call("identify", "invalid")).code, 400);
});

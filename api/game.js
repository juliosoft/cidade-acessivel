import { getStorage, storageMode } from "../lib/storage.js";
import { createGameService, playerFrom } from "../lib/game-service.js";
let service;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const send = (code, data) => res.status(code).json(data);
  try {
    const url = new URL(req.url, "http://localhost"),
      action = url.searchParams.get("action");
    const expected = {
      info: "GET",
      ranking: "GET",
      history: "GET",
      identify: "POST",
      start: "POST",
      phase: "POST",
    }[action];
    if (!expected) return send(404, { error: "Operação inexistente." });
    if (req.method !== expected)
      return send(405, { error: "Método não permitido." });
    if (
      req.method === "POST" &&
      req.headers.origin &&
      new URL(req.headers.origin).host !== req.headers.host
    )
      return send(403, { error: "Origem não permitida." });
    let body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return send(400, { error: "JSON inválido." });
      }
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return send(400, { error: "Dados inválidos." });
    if (JSON.stringify(body).length > 8192)
      return send(413, { error: "Dados excedem o limite." });
    const mode = storageMode();
    if (action === "info") return send(200, { mode });
    if (action === "identify") {
      const player = playerFrom(body.nickname);
      return send(200, { player: { nickname: player.nickname }, mode });
    }
    service ??= createGameService(await getStorage());
    if (action === "start")
      return send(200, await service.start(body.nickname));
    if (action === "phase") return send(200, await service.phase(body));
    if (action === "ranking")
      return send(200, { rows: await service.ranking(), mode });
    if (action === "history")
      return send(200, {
        rows: await service.history(url.searchParams.get("nickname")),
        mode,
      });
  } catch (e) {
    console.error("Game API:", e.message);
    return send(e.status || 503, {
      error: e.status
        ? e.message
        : "Não foi possível acessar os resultados. Confira o armazenamento e tente novamente.",
    });
  }
}

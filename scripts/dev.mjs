import http from "node:http";
import { readFile } from "node:fs/promises";
import handler from "../api/game.js";
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/game")) {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 8192) {
          res.writeHead(413);
          res.end();
          return;
        }
      }
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      res.status = (n) => {
        res.statusCode = n;
        return res;
      };
      res.json = (d) => res.end(JSON.stringify(d));
      await handler(req, res);
      return;
    }
    const path = new URL(req.url, "http://localhost").pathname;
    const files = {
      "/": "index.html",
      "/index.html": "index.html",
      "/game.js": "game.js",
      "/style.css": "style.css",
    };
    if (!files[path]) {
      res.writeHead(404);
      res.end();
      return;
    }
    const mime = path.endsWith(".js")
      ? "text/javascript"
      : path.endsWith(".css")
        ? "text/css"
        : "text/html";
    res.setHeader("Content-Type", mime + "; charset=utf-8");
    res.end(
      await readFile(new URL("../public/" + files[path], import.meta.url)),
    );
  } catch {
    res.writeHead(500);
    res.end("Erro ao servir aplicação.");
  }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () =>
  console.log(
    "Cidade Acessível: http://localhost:" +
      port +
      " — no celular use o IP deste PC na mesma rede Wi-Fi.",
  ),
);
server.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? "Porta em uso. Feche a outra instância ou altere PORT."
      : e.message,
  );
  process.exit(1);
});

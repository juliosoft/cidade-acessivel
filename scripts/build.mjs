import { access } from "node:fs/promises";
for (const f of [
  "public/index.html",
  "public/game.js",
  "public/style.css",
  "api/game.js",
])
  await access(f);
console.log("Aplicação pronta: public/ + API Node.js.");

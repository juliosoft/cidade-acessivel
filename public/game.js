"use strict";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const palette = ["#bce875", "#70ceef", "#ffb477"];
const choiceScores = [
  [10, 100, 25],
  [0, 0, 100],
  [100, 10, 0],
  [0, 100, 0],
  [0, 0, 100],
  [100, 0, 0],
];
let currentPlayer = null,
  runId = null,
  runToken = null,
  phaseResults = [],
  phaseElapsed = 0,
  selectedChoice = null,
  pendingPhase = null,
  portrait = false;
async function api(action, data) {
  const r = await fetch("/api/game?action=" + action, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(18000),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "Falha na conexão.");
  return result;
}
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  return (
    Math.floor(seconds / 60) +
    ":" +
    String(seconds % 60).padStart(2, "0") +
    "." +
    String(Math.floor((ms % 1000) / 10)).padStart(2, "0")
  );
}
const levels = [
  {
    title: "A rua comercial",
    theme: "01 / Acessibilidade física",
    sky: "#b9ddd2",
    buildings: ["#ecc789", "#c0cbdc", "#e1a387"],
    objects: [
      {
        x: 700,
        title: "Um degrau entre a pessoa e a farmácia",
        desc: "Uma pessoa em cadeira de rodas não consegue acessar a entrada principal. Qual mudança garante acesso com autonomia?",
        choices: [
          "Colocar um aviso na porta",
          "Construir Rampa de Acesso Acessível",
          "Criar entrada pelos fundos",
        ],
        answer: 1,
        explain:
          "Uma rota acessível deve integrar a entrada principal. A rampa precisa de inclinação adequada, patamares, largura e proteção.",
        kind: "ramp",
      },
      {
        x: 1500,
        title: "A praça também é para quem tem mobilidade reduzida",
        desc: "Um idoso encontra uma escadaria no acesso à praça. Como oferecer uma alternativa acessível?",
        choices: [
          "Pedir que outra pessoa o carregue",
          "Colocar mais degraus",
          "Instalar Elevador Acessível",
        ],
        answer: 2,
        explain:
          "O elevador oferece uma alternativa à escada, com acesso seguro, sinalização e manutenção.",
        kind: "lift",
      },
    ],
  },
  {
    title: "A avenida movimentada",
    theme: "02 / Acessibilidade sensorial",
    sky: "#c2deeb",
    buildings: ["#a2bacb", "#e4ba87", "#a8c3b4"],
    objects: [
      {
        x: 800,
        title: "Uma travessia que pode ser percebida",
        desc: "Uma pessoa com deficiência visual aguarda no cruzamento. Como tornar a indicação de travessia acessível?",
        choices: [
          "Instalar Semáforo Sonoro",
          "Pintar o semáforo de uma cor mais forte",
          "Aumentar a velocidade dos carros",
        ],
        answer: 0,
        explain:
          "O sinal sonoro complementa o visual. Aqui o bipe tem também indicação visual e pode ser desativado.",
        kind: "signal",
      },
      {
        x: 1600,
        title: "O caminho tátil foi interrompido",
        desc: "Uma parte do piso tátil está ausente. Qual ação recupera a orientação ao longo da calçada?",
        choices: [
          "Cobrir tudo com um tapete",
          "Reparar Piso Tátil Direcional",
          "Deixar um cone sobre a passagem",
        ],
        answer: 1,
        explain:
          "Uma rota tátil contínua ajuda na orientação. O piso direcional e o de alerta têm funções diferentes.",
        kind: "tactile",
      },
    ],
  },
  {
    title: "A escola inclusiva",
    theme: "03 / Inclusão neurodivergente e comunicação",
    sky: "#e4ddbb",
    buildings: ["#dca791", "#a8c9bd", "#d8bd79"],
    objects: [
      {
        x: 900,
        title: "Um pátio com menos sobrecarga",
        desc: "Caixas de som no volume máximo tornam o pátio desconfortável para alunos com sensibilidade sensorial.",
        choices: [
          "Aumentar o volume para todos ouvirem",
          "Impedir esses alunos de usar o pátio",
          "Ajustar Ruído e Criar Sala de Calmaria",
        ],
        answer: 2,
        explain:
          "Reduzir ruído e oferecer um espaço tranquilo amplia as opções de participação, sem isolar ou obrigar ninguém a usá-lo.",
        kind: "quiet",
      },
      {
        x: 1700,
        title: "A informação precisa chegar a todos",
        desc: "Na sala de aula, avisos são dados apenas pela fala. Como ampliar o acesso à comunicação para alunos surdos?",
        choices: [
          "Ativar Painel de Comunicação em Libras/Legendas",
          "Repetir o aviso em voz mais alta",
          "Apagar os avisos da turma",
        ],
        answer: 0,
        explain:
          "Libras e legendas ampliam o acesso à informação. As necessidades individuais variam; o painel complementa os demais apoios.",
        kind: "panel",
      },
    ],
  },
];
let state = "login",
  nickname = "",
  avatar = 0,
  levelIndex = 0,
  player,
  camera = 0,
  objects = [],
  coins = [],
  platforms = [],
  elapsed = 0,
  totalCoins = 0,
  barriers = 0,
  score = 0,
  modal = null,
  activeObject = null,
  last = 0,
  near = null,
  finishWarn = false;
let audio = null,
  sound = false,
  contrast = false,
  beepClock = 0;
const input = { left: new Set(), right: new Set() };
const canvas = $("#game"),
  ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
function say(t) {
  $("#live").textContent = t;
}
function showScreen(name) {
  state = name;
  document.body.classList.toggle("playing", name === "game");
  $$(".screen").forEach((e) => (e.hidden = e.id !== "screen-" + name));
}
function clearInput() {
  input.left.clear();
  input.right.clear();
  $$(".held").forEach((e) => e.classList.remove("held"));
}
function openDialog(id) {
  clearInput();
  modal = $(id);
  modal.showModal();
}
function closeDialog() {
  if (modal) {
    modal.close();
    modal = null;
  }
  clearInput();
  if (state === "game") canvas.focus({ preventScroll: true });
}
function tone(freq, duration = 0.12, type = "sine", volume = 0.04) {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duration);
  } catch {
    sound = false;
    $("#sound").textContent = "♪ Indisponível";
  }
}
$("#sound").onclick = () => {
  sound = !sound;
  $("#sound").setAttribute("aria-pressed", sound);
  $("#sound").textContent = sound ? "♪ Som on" : "♪ Som off";
  $("#sound").title = sound ? "Desativar som" : "Ativar som";
  tone(440);
};
$("#contrast").onclick = () => {
  contrast = !contrast;
  document.body.classList.toggle("contrast", contrast);
  $("#contrast").setAttribute("aria-pressed", contrast);
};
async function identify() {
  const b = $("#btn-start");
  b.disabled = true;
  $("#login-error").textContent = "";
  try {
    const r = await api("identify", { nickname: $("#player-nickname").value });
    currentPlayer = r.player;
    nickname = r.player.nickname;
    try {
      localStorage.setItem("cidade_acessivel_nickname", nickname);
    } catch {}
    showScreen("avatar");
    $("#account-status").textContent = "Jogando como " + nickname;
    $(".avatar").focus();
  } catch (e) {
    $("#login-error").textContent = e.message;
  } finally {
    b.disabled = false;
  }
}
$("#login-form").onsubmit = (e) => {
  e.preventDefault();
  identify();
};
$("#logout").onclick = () => {
  currentPlayer = null;
  try {
    localStorage.removeItem("cidade_acessivel_nickname");
  } catch {}
  showScreen("login");
  $("#player-nickname").focus();
};
$$(".avatar").forEach(
  (b) =>
    (b.onclick = () => {
      avatar = Number(b.dataset.avatar);
      $$(".avatar").forEach((a) => a.setAttribute("aria-pressed", a === b));
    }),
);
$("#play").onclick = start;
$("#replay").onclick = start;
$("#home").onclick = () => {
  showScreen("avatar");
  $("#play").focus();
};
async function start() {
  const b = state === "final" ? $("#replay") : $("#play");
  b.disabled = true;
  try {
    const r = await api("start", { nickname });
    runId = r.runId;
    runToken = r.runToken;
    phaseResults = [];
    elapsed = 0;
    totalCoins = 0;
    barriers = 0;
    score = 0;
    levelIndex = 0;
    showScreen("game");
    $("#hud-name").textContent = nickname;
    loadLevel();
    canvas.focus();
  } catch (e) {
    (state === "final" ? $("#save-status") : $("#account-status")).textContent =
      e.message;
  } finally {
    b.disabled = false;
  }
}
function loadLevel() {
  phaseElapsed = 0;
  pendingPhase = null;
  const l = levels[levelIndex];
  objects = l.objects.map((o) => ({
    ...o,
    solved: false,
    attempted: false,
    choice: null,
    points: 0,
    anim: 0,
  }));
  coins = Array.from({ length: 10 }, (_, i) => ({
    x: 180 + i * 205,
    y: i % 3 === 1 ? 288 : 350,
    taken: false,
  }));
  platforms = [
    { x: 360, y: 330, w: 95, h: 18 },
    { x: 980, y: 328, w: 100, h: 18 },
    { x: 1810, y: 330, w: 110, h: 18 },
  ];
  player = {
    x: 50,
    y: 350,
    w: 26,
    h: 40,
    vx: 0,
    vy: 0,
    ground: false,
    face: 1,
    walk: 0,
  };
  camera = 0;
  near = null;
  finishWarn = false;
  beepClock = 0;
  $("#phase-title").textContent = l.title;
  $("#phase-theme").textContent = l.theme;
  $("#hud-level").textContent = levelIndex + 1 + "/3";
  say(
    "Fase " +
      (levelIndex + 1) +
      ". " +
      l.title +
      ". Escolha suas ações e alcance a chegada. Ações ignoradas valem zero.",
  );
  updateHUD();
}
function updateHUD() {
  $("#hud-score").textContent = score;
  $("#progress").textContent =
    objects.filter((o) => o.attempted).length +
    "/2 ações respondidas · " +
    coins.filter((c) => c.taken).length +
    "/10 itens";
  $("#hud-time").textContent = formatTime(Math.floor(phaseElapsed * 1000));
  $("#distance").textContent =
    Math.min(100, Math.floor((player.x / 2200) * 100)) + "% do caminho";
}
function jump() {
  if (state !== "game" || modal || portrait) return;
  if (player.ground) {
    player.vy = -520;
    player.ground = false;
    tone(320, 0.13, "triangle");
  }
}
function interact() {
  if (state !== "game" || modal || portrait) return;
  const o = objects.find(
    (o) => !o.attempted && Math.abs(player.x + 13 - o.x) < 50 && player.y > 285,
  );
  if (!o) {
    say("Aproxime-se de uma ação ainda não respondida.");
    return;
  }
  activeObject = o;
  selectedChoice = null;
  $("#challenge-title").textContent = o.title;
  $("#challenge-desc").textContent =
    o.desc + " Você tem uma tentativa. Escolha e confirme.";
  $("#feedback").textContent = "";
  $("#confirm-choice").hidden = false;
  $("#confirm-choice").disabled = true;
  $("#options").replaceChildren();
  o.choices.forEach((choice, i) => {
    const label = document.createElement("label");
    label.className = "choice";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "challenge-choice";
    radio.value = i;
    radio.checked = false;
    radio.onchange = () => {
      selectedChoice = i;
      $("#confirm-choice").disabled = false;
    };
    label.append(radio, document.createTextNode(choice));
    $("#options").append(label);
  });
  openDialog("#challenge");
  $("#challenge-close").focus();
}
$("#confirm-choice").onclick = () => {
  if (selectedChoice !== null) answer(selectedChoice);
};
function answer(i) {
  const o = activeObject;
  if (o.attempted || !Number.isInteger(i) || i < 0 || i > 2) return;
  o.attempted = true;
  o.choice = i;
  o.points = choiceScores[levelIndex * 2 + objects.indexOf(o)][i];
  o.solved = i === o.answer;
  if (o.solved) barriers++;
  score += o.points;
  $("#feedback").textContent =
    "Resposta registrada: +" +
    o.points +
    " pontos. " +
    (o.solved ? "" : "Solução recomendada: " + o.choices[o.answer] + ". ") +
    o.explain;
  $$("#options input").forEach((b) => (b.disabled = true));
  $("#confirm-choice").disabled = true;
  $("#challenge-close").focus();
  tone(o.solved ? 660 : 200, 0.2, "triangle");
  say(
    "Resposta registrada. " +
      o.points +
      " pontos. Sem nova tentativa nesta partida.",
  );
  updateHUD();
}
$("#challenge-close").onclick = closeDialog;
$("#pause").onclick = () => {
  if (!modal) openDialog("#pause-dialog");
};
$("#resume").onclick = closeDialog;
$$("dialog").forEach((d) =>
  d.addEventListener("cancel", (e) => {
    e.preventDefault();
    if (d.id !== "transition" && d.id !== "rotate") closeDialog();
  }),
);
$("#next-level").onclick = async () => {
  const b = $("#next-level");
  b.disabled = true;
  $("#phase-save-status").textContent = "Registrando fase…";
  try {
    const data = await api("phase", pendingPhase);
    phaseResults = data.run.phases;
    score = data.run.score;
    $("#phase-save-status").textContent = "";
    closeDialog();
    if (levelIndex === 2) finish(data.run);
    else {
      levelIndex++;
      loadLevel();
    }
  } catch (e) {
    $("#phase-save-status").textContent =
      e.message + " Seu resultado foi preservado. Tente registrar novamente.";
  } finally {
    b.disabled = false;
  }
};
async function renderRank(target) {
  const root = $(target);
  root.textContent = "Carregando ranking global…";
  try {
    const { rows } = await api("ranking");
    root.replaceChildren();
    if (!rows.length) {
      root.textContent = "Nenhuma partida concluída ainda.";
      return;
    }
    const table = document.createElement("table");
    const thead = document.createElement("thead"),
      head = document.createElement("tr");
    ["#", "Jogador", "Pontos", "Tempo"].forEach((t) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = t;
      head.append(th);
    });
    thead.append(head);
    table.append(thead);
    const body = document.createElement("tbody");
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      [i + 1, r.nickname, r.score, formatTime(r.total_ms)].forEach((t) => {
        const td = document.createElement("td");
        td.textContent = t;
        tr.append(td);
      });
      tr.title = r.phases
        .map((p) => "Fase " + p.level + ": " + formatTime(p.elapsed_ms))
        .join(" / ");
      body.append(tr);
      const detail = document.createElement("tr"),
        cell = document.createElement("td");
      cell.colSpan = 4;
      cell.style.fontSize = "12px";
      cell.style.textAlign = "left";
      cell.textContent = r.phases
        .map((p) => "Fase " + p.level + ": " + formatTime(p.elapsed_ms))
        .join(" · ");
      detail.append(cell);
      body.append(detail);
    });
    table.append(body);
    root.append(table);
  } catch (e) {
    root.textContent = e.message;
  }
}
$("#btn-ranking").onclick = () => {
  renderRank("#ranking-table");
  openDialog("#ranking");
};
$("#ranking-close").onclick = closeDialog;
function phaseDescription(p) {
  return (
    "Fase " +
    p.level +
    " · " +
    p.score +
    " pts · " +
    formatTime(p.elapsed_ms) +
    " · Ações: " +
    p.action_points.join(" + ") +
    " pts · " +
    p.skipped +
    " ignorada(s) · " +
    p.collectibles.length +
    "/10 itens · Bônus: " +
    p.bonus
  );
}
async function showHistory() {
  openDialog("#history-dialog");
  const root = $("#history-list");
  root.textContent = "Carregando…";
  try {
    const { rows } = await api(
      "history&nickname=" + encodeURIComponent(nickname),
    );
    root.replaceChildren();
    if (!rows.length) root.textContent = "Você ainda não iniciou uma partida.";
    for (const r of rows) {
      const d = document.createElement("details"),
        s = document.createElement("summary");
      s.textContent =
        new Date(r.started_at).toLocaleString("pt-BR") +
        " · " +
        r.score +
        " pts · " +
        (r.status === "completed" ? "Concluída" : "Não concluída");
      d.append(s);
      const total = document.createElement("p");
      total.textContent = "Tempo registrado: " + formatTime(r.total_ms);
      d.append(total);
      r.phases.forEach((p) => {
        const el = document.createElement("p");
        el.textContent = phaseDescription(p);
        d.append(el);
      });
      root.append(d);
    }
  } catch (e) {
    root.textContent = e.message;
  }
}
$("#history-button").onclick = showHistory;
$("#final-history").onclick = showHistory;
$("#history-close").onclick = closeDialog;
function finish(run) {
  showScreen("final");
  clearInput();
  score = run.score;
  $("#final-message").textContent =
    nickname +
    ", sua partida foi registrada! " +
    barriers +
    " de 6 barreiras corrigidas.";
  $("#metrics").replaceChildren();
  [
    ["Pontos totais", score],
    ["Barreiras", barriers + "/6"],
    ["Coletáveis", totalCoins + "/30"],
    ["Tempo", formatTime(run.total_ms)],
  ].forEach(([label, value]) => {
    const el = document.createElement("div");
    el.className = "metric";
    const strong = document.createElement("strong");
    strong.textContent = value;
    el.append(strong, document.createTextNode(label));
    $("#metrics").append(el);
  });
  $("#score-formula").textContent =
    "Pontos das escolhas + itens × 10 + bônus por fase. O bônus de tempo é proporcional às barreiras corrigidas. Empates: menor tempo total.";
  $("#save-status").textContent =
    "Histórico salvo para este nickname e ranking atualizado.";
  $("#phase-summary").replaceChildren();
  run.phases.forEach((p) => {
    const el = document.createElement("p");
    el.className = "phase-result";
    el.textContent = phaseDescription(p);
    $("#phase-summary").append(el);
  });
  renderRank("#final-ranking");
  $("#replay").focus();
}
function update(dt) {
  const direction = Number(input.right.size > 0) - Number(input.left.size > 0);
  player.vx = direction * 230;
  if (direction) player.face = direction;
  const prevBottom = player.y + player.h;
  player.x = Math.max(0, Math.min(2260, player.x + player.vx * dt));
  player.vy += 1450 * dt;
  player.y += player.vy * dt;
  player.ground = false;
  for (const p of [...platforms, { x: 0, y: 390, w: 2400, h: 60 }]) {
    if (
      player.x + player.w > p.x &&
      player.x < p.x + p.w &&
      player.y + player.h >= p.y &&
      prevBottom <= p.y + 1 &&
      player.vy >= 0
    ) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.ground = true;
    }
  }
  player.walk += Math.abs(player.vx) * dt;
  camera = Math.max(0, Math.min(1600, player.x - 300));
  for (const c of coins) {
    if (
      !c.taken &&
      player.x < c.x + 15 &&
      player.x + player.w > c.x - 15 &&
      player.y < c.y + 15 &&
      player.y + player.h > c.y - 15
    ) {
      c.taken = true;
      totalCoins++;
      score += 10;
      tone(880, 0.09, "sine");
      say(
        "Item coletado. " +
          coins.filter((c) => c.taken).length +
          " de 10 nesta fase.",
      );
    }
  }
  for (const o of objects)
    if (o.solved) o.anim = Math.min(1, o.anim + dt * 0.55);
  beepClock += dt;
  if (
    levelIndex === 1 &&
    objects[0].solved &&
    Math.abs(player.x - 800) < 220 &&
    beepClock > 1.2
  ) {
    tone(620, 0.09, "sine", 0.025);
    beepClock = 0;
  }
  const next = objects.find(
    (o) => !o.attempted && Math.abs(player.x + 13 - o.x) < 50 && player.y > 285,
  );
  if (next !== near) {
    near = next;
    $("#objective").textContent = near
      ? "Pressione AÇÃO: " + near.title
      : "Explore, colete os ícones e corrija as barreiras marcadas com !";
    if (near)
      say("Barreira próxima. Pressione E, Enter ou AÇÃO. " + near.title);
  }
  if (player.x >= 2200) {
    pendingPhase = {
      runId,
      runToken,
      nickname,
      level: levelIndex + 1,
      choices: objects.map((o) => o.choice),
      collectibles: coins
        .map((c, i) => (c.taken ? i : null))
        .filter((i) => i !== null),
      elapsedMs: Math.max(8000, Math.round(phaseElapsed * 1000)),
    };
    $("#transition-title").textContent =
      levels[levelIndex].title + " concluída!";
    $("#transition-text").textContent =
      objects.filter((o) => o.attempted).length +
      " ações respondidas, " +
      objects.filter((o) => !o.attempted).length +
      " ignoradas (0 ponto). Tempo: " +
      formatTime(pendingPhase.elapsedMs) +
      ".";
    $("#next-level").textContent =
      levelIndex === 2
        ? "Salvar e ver resultado"
        : "Registrar e ir à próxima fase →";
    openDialog("#transition");
  }
  updateHUD();
}
const keyMap = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};
addEventListener("keydown", (e) => {
  if (state !== "game" || modal || portrait) return;
  if (e.code === "Escape") {
    e.preventDefault();
    openDialog("#pause-dialog");
    return;
  }
  if (e.target instanceof HTMLButtonElement) return;
  if (keyMap[e.code]) {
    e.preventDefault();
    input[keyMap[e.code]].add(e.code);
  } else if (["Space", "KeyW", "ArrowUp"].includes(e.code)) {
    e.preventDefault();
    if (!e.repeat) jump();
  } else if (["KeyE", "Enter"].includes(e.code)) {
    e.preventDefault();
    if (!e.repeat) interact();
  }
});
addEventListener("keyup", (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]].delete(e.code);
});
function bindControl(id, dir, fn) {
  const b = $(id);
  const down = (e) => {
    if (e.cancelable) e.preventDefault();
    if (state !== "game" || modal || portrait) return;
    b.classList.add("held");
    if (dir) input[dir].add(id);
    else fn();
  };
  const up = (e) => {
    if (e.cancelable) e.preventDefault();
    b.classList.remove("held");
    if (dir) input[dir].delete(id);
  };
  b.addEventListener("touchstart", down, { passive: false });
  b.addEventListener("touchend", up, { passive: false });
  b.addEventListener("touchcancel", up, { passive: false });
  b.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    b.setPointerCapture(e.pointerId);
    down(e);
  });
  b.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") up(e);
  });
  b.addEventListener("pointercancel", up);
  b.addEventListener("lostpointercapture", up);
  b.addEventListener("keydown", (e) => {
    if (["Space", "Enter"].includes(e.code)) {
      e.stopPropagation();
      if (!e.repeat) down(e);
    }
  });
  b.addEventListener("keyup", (e) => {
    if (["Space", "Enter"].includes(e.code)) up(e);
  });
  b.addEventListener("contextmenu", (e) => e.preventDefault());
}
bindControl("#left", "left");
bindControl("#right", "right");
bindControl("#jump", null, jump);
bindControl("#action", null, interact);
function autoPause() {
  clearInput();
  if (state === "game" && !modal) openDialog("#pause-dialog");
}
addEventListener("blur", autoPause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) autoPause();
});
function rect(c, x, y, w, h, col) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}
function text(c, t, x, y, size = 12, col = "#183a40", align = "left") {
  c.fillStyle = col;
  c.font = "bold " + size + "px monospace";
  c.textAlign = align;
  c.fillText(t, x, y);
  c.textAlign = "left";
}
function line(c, x, y, xx, yy, col, width = 3) {
  c.strokeStyle = col;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(xx, yy);
  c.stroke();
}
function person(c, x, y, color, skin = "#ad7050", walk = 0, face = 1) {
  x = Math.round(x);
  y = Math.round(y);
  rect(c, x + 5, y, 17, 7, "#25383b");
  rect(c, x + 5, y + 7, 17, 13, skin);
  rect(c, x + (face > 0 ? 17 : 7), y + 10, 3, 3, "#132b31");
  rect(c, x + 3, y + 20, 21, 14, color);
  rect(c, x, y + 22, 4, 13, skin);
  rect(c, x + 24, y + 22, 4, 13, skin);
  const stride = walk ? Math.sin(walk / 14) * 3 : 0;
  rect(c, x + 4, y + 34, 7, 6 + stride, "#243a50");
  rect(c, x + 17, y + 34, 7, 6 - stride, "#243a50");
  rect(c, x + 2, y + 39 + stride, 10, 4, "#142d31");
  rect(c, x + 17, y + 39 - stride, 11, 4, "#142d31");
}
function wheel(c, x, y, col = "#173a45") {
  c.strokeStyle = col;
  c.lineWidth = 3;
  c.beginPath();
  c.arc(x, y, 10, 0, Math.PI * 2);
  c.stroke();
  line(c, x - 7, y, x + 7, y, col, 2);
  line(c, x, y - 7, x, y + 7, col, 2);
}
function wheelchair(c, x, y) {
  wheel(c, x + 7, y + 30);
  rect(c, x + 3, y, 10, 10, "#b57a58");
  rect(c, x + 1, y - 3, 12, 5, "#243841");
  rect(c, x + 2, y + 11, 10, 14, "#6ca7e5");
  line(c, x + 4, y + 24, x + 19, y + 24, "#163c48", 4);
  line(c, x + 19, y + 24, x + 24, y + 34, "#163c48", 4);
  line(c, x - 2, y + 12, x - 2, y + 28, "#173a45", 3);
}
function tree(c, x, y) {
  rect(c, x - 5, y, 10, 65, "#80694b");
  rect(c, x - 30, y - 28, 60, 43, "#37685d");
  rect(c, x - 21, y - 44, 42, 25, "#548c6c");
  rect(c, x - 18, y - 28, 32, 18, "#689b73");
}
function icon(c, x, y, type) {
  rect(c, x - 14, y - 14, 28, 28, contrast ? "#000" : "#f8e5a5");
  c.strokeStyle = contrast ? "#fff" : "#7b602d";
  c.lineWidth = 2;
  c.strokeRect(x - 14, y - 14, 28, 28);
  const ink = contrast ? "#fff" : "#214b50";
  if (type === 0) {
    c.strokeStyle = ink;
    c.beginPath();
    c.arc(x - 3, y + 4, 6, 0, Math.PI * 1.75);
    c.stroke();
    rect(c, x - 3, y - 10, 5, 5, ink);
    line(c, x - 2, y - 4, x - 2, y + 2, ink, 3);
    line(c, x - 2, y + 2, x + 6, y + 2, ink, 3);
    line(c, x + 6, y + 2, x + 9, y + 9, ink, 3);
  } else if (type === 1) {
    for (let i = 0; i < 6; i++) {
      rect(c, x - 7 + (i % 2) * 9, y - 9 + Math.floor(i / 2) * 7, 4, 4, ink);
    }
  } else {
    c.strokeStyle = ink;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x - 17, y - 18, x - 17, y + 18, x, y);
    c.bezierCurveTo(x + 17, y - 18, x + 17, y + 18, x, y);
    c.stroke();
  }
}
function building(c, x, y, w, h, color, name) {
  rect(c, x + 5, y + 5, w, h, "#6c969052");
  rect(c, x, y, w, h, color);
  rect(c, x - 4, y, w + 8, 10, "#35595e");
  for (let a = 14; a < w - 25; a += 42) {
    rect(c, x + a, y + 26, 26, 33, "#edf1d7");
    rect(c, x + a + 3, y + 29, 20, 27, "#527c83");
    rect(c, x + a + 13, y + 29, 3, 27, "#d0e6d9");
  }
  rect(c, x + 14, y + h - 68, w - 28, 24, "#234b50");
  text(c, name, x + w / 2, y + h - 51, 12, "#fff5d4", "center");
  rect(c, x + w / 2 - 20, y + h - 42, 40, 42, "#426971");
  rect(c, x + w / 2 - 15, y + h - 36, 29, 27, "#b7d4cf");
}
function draw() {
  const l = levels[levelIndex];
  rect(ctx, 0, 0, 800, 450, contrast ? "#070707" : l.sky);
  if (!contrast) {
    rect(ctx, 635, 75, 43, 43, "#fff0b8");
    for (let i = 0; i < 9; i++) {
      const x = i * 140 - ((camera * 0.18) % 140);
      rect(ctx, x, 160, 65, 165, "#6d9c9a35");
      rect(ctx, x + 9, 135, 46, 30, "#6d9c9a35");
    }
    for (let i = 0; i < 5; i++) {
      const x = i * 220 - ((camera * 0.08) % 220);
      rect(ctx, x + 20, 91 + (i % 2) * 24, 74, 12, "#ffffff75");
      rect(ctx, x + 35, 81 + (i % 2) * 24, 32, 13, "#ffffff75");
    }
  }
  ctx.save();
  ctx.translate(-Math.round(camera), 0);
  for (let i = 0; i < 9; i++) {
    const names =
      levelIndex === 0
        ? [
            "CAFÉ",
            "LIVRARIA",
            "FARMÁCIA",
            "MERCADO",
            "PRAÇA",
            "CULTURA",
            "PADARIA",
            "BIBLIOTECA",
            "CHEGADA",
          ]
        : levelIndex === 1
          ? [
              "CENTRO",
              "ESTAÇÃO",
              "AVENIDA",
              "TRAVESSIA",
              "CINEMA",
              "SERVIÇOS",
              "BIBLIOTECA",
              "CIDADE",
              "CHEGADA",
            ]
          : [
              "ESCOLA",
              "APRENDER",
              "ESCOLA",
              "PÁTIO",
              "CONVIVER",
              "CRIAR",
              "SALA DE AULA",
              "APRENDER",
              "CHEGADA",
            ];
    building(
      ctx,
      70 + i * 260,
      195 - (i % 3) * 17,
      190,
      175 + (i % 3) * 17,
      contrast ? "#242424" : l.buildings[i % 3],
      names[i],
    );
  }
  rect(ctx, 0, 370, 2400, 20, contrast ? "#eee" : "#d9ddc4");
  rect(ctx, 0, 390, 2400, 60, contrast ? "#111" : "#687b79");
  rect(ctx, 0, 390, 2400, 5, contrast ? "#fff" : "#354f50");
  for (let i = 0; i < 35; i++) rect(ctx, i * 75, 426, 40, 5, "#dfe8c3");
  for (const x of [30, 550, 1180, 2030, 2310]) tree(ctx, x, 300);
  for (const p of platforms) {
    rect(ctx, p.x, p.y, p.w, p.h, contrast ? "#fff" : "#335b58");
    rect(ctx, p.x, p.y, p.w, 5, contrast ? "#ff0" : "#b9d887");
    rect(ctx, p.x + 10, p.y + p.h, 7, 390 - p.y - p.h, "#365955");
    rect(ctx, p.x + p.w - 17, p.y + p.h, 7, 390 - p.y - p.h, "#365955");
  }
  for (const o of objects) drawObject(o);
  for (const c of coins)
    if (!c.taken)
      icon(
        ctx,
        c.x,
        c.y + (reduced ? 0 : Math.sin(elapsed * 2 + c.x) * 2),
        levelIndex,
      );
  rect(ctx, 2205, 228, 5, 162, "#23464d");
  for (let r = 0; r < 4; r++)
    for (let col = 0; col < 5; col++)
      rect(
        ctx,
        2210 + col * 10,
        228 + r * 10,
        10,
        10,
        (r + col) % 2 ? "#f7efd1" : "#21434a",
      );
  text(ctx, "CHEGADA", 2207, 215, 12, contrast ? "#fff" : "#173a40", "center");
  person(
    ctx,
    player.x,
    player.y,
    palette[avatar],
    avatar === 1 ? "#865338" : avatar === 2 ? "#d8a17d" : "#b57b55",
    player.ground && player.vx && !reduced ? player.walk : 0,
    player.face,
  );
  if (near) {
    rect(ctx, near.x - 65, 260, 130, 27, "#102b31");
    text(ctx, "E / AÇÃO", near.x, 279, 14, "#dcf58b", "center");
  }
  ctx.restore();
}
function drawObject(o) {
  const x = o.x,
    done = o.solved,
    t = o.anim;
  const ink = contrast ? "#fff" : "#244c51";
  if (o.kind === "ramp") {
    rect(ctx, x + 20, 355, 105, 35, "#536a69");
    if (done) {
      ctx.fillStyle = "#dce8aa";
      ctx.beginPath();
      ctx.moveTo(x - 30, 390);
      ctx.lineTo(x + 40, 355);
      ctx.lineTo(x + 40, 390);
      ctx.fill();
      line(ctx, x - 30, 368, x + 40, 334, ink);
      line(ctx, x - 30, 368, x - 30, 390, ink);
      line(ctx, x + 40, 334, x + 40, 355, ink);
    }
    if (t < 1) wheelchair(ctx, x - 20 + t * 93, 350 - t * 34);
    else text(ctx, "ACESSO LIVRE", x + 35, 343, 10, ink, "center");
  }
  if (o.kind === "lift") {
    for (let i = 0; i < 4; i++)
      rect(ctx, x + 20 + i * 19, 380 - i * 12, 20, 10 + i * 12, "#6b7972");
    rect(ctx, x - 60, 285, 42, 105, done ? "#316e64" : "#6f7270");
    rect(ctx, x - 55, 290, 32, 95, "#b7d5cb");
    const yy = done ? 350 - t * 61 : 350;
    rect(ctx, x - 55, yy + 39, 32, 4, ink);
    person(ctx, done ? x - 53 : x - 16, yy, "#e7bf73", "#b88864");
    if (!done) line(ctx, x + 15, 365, x + 20, 390, ink, 3);
    text(ctx, done ? "ELEVADOR" : "ESCADAS", x - 12, 275, 11, ink, "center");
  }
  if (o.kind === "signal") {
    rect(ctx, x - 15, 287, 6, 103, ink);
    rect(ctx, x - 27, 280, 30, 54, "#1b343a");
    rect(ctx, x - 20, 287, 16, 16, done ? "#64827d" : "#efb078");
    rect(ctx, x - 20, 311, 16, 16, done ? "#c7f492" : "#64827d");
    for (let i = 0; i < 6; i++)
      rect(ctx, x + 20 + i * 14, 397, 9, 45, "#e5eadc");
    person(ctx, x + 10 + t * 105, 346, "#89a8d6", "#9b674b");
    line(ctx, x + 35 + t * 105, 368, x + 49 + t * 105, 388, ink, 2);
    if (done) {
      rect(ctx, x - 70, 246, 112, 25, "#173b43");
      text(ctx, "♪ ATRAVESSE", x - 14, 263, 12, "#e3f4b0", "center");
    }
  }
  if (o.kind === "tactile") {
    for (let i = -70; i < 100; i += 12) {
      if (!done && i > -23 && i < 46) continue;
      rect(ctx, x + i, 380, 10, 10, "#f5d779");
      line(ctx, x + i + 3, 382, x + i + 3, 388, "#806222", 1);
    }
    if (!done) {
      rect(ctx, x - 22, 379, 62, 11, "#3d5252");
      text(ctx, "ROTA INTERROMPIDA", x, 340, 10, ink, "center");
    } else text(ctx, "ROTA CONTÍNUA", x, 340, 11, ink, "center");
  }
  if (o.kind === "quiet") {
    for (const dx of [-65, 45]) {
      rect(ctx, x + dx, 323, 30, 64, "#223d45");
      wheel(ctx, x + dx + 15, 368, "#99bcb4");
      wheel(ctx, x + dx + 15, 339, "#99bcb4");
    }
    if (!done) {
      text(ctx, "♪  )))   ♪", x, 298, 22, ink, "center");
    } else {
      rect(ctx, x - 48, 299, 95, 43, "#e3edc3");
      text(ctx, "CALMARIA", x, 317, 12, "#244c51", "center");
      text(ctx, "BEM-VINDOS", x, 333, 9, "#244c51", "center");
    }
    person(ctx, x - 12, 346, done ? "#b5d98e" : "#efb679", "#8f5c41");
  }
  if (o.kind === "panel") {
    rect(ctx, x - 72, 268, 144, 66, "#254b53");
    rect(ctx, x - 66, 274, 132, 54, done ? "#dceab9" : "#586e73");
    text(
      ctx,
      done ? "LIBRAS + LEGENDAS" : "SEM SINALIZAÇÃO",
      x,
      295,
      11,
      done ? "#143b40" : "#fff",
      "center",
    );
    if (done) {
      text(ctx, "BEM-VINDOS À AULA", x, 314, 10, "#143b40", "center");
      rect(ctx, x - 50, 337, 100, 6, "#dceab9");
    }
    person(ctx, x + 20, 346, "#a8d7d8", "#c18a63");
  }
  rect(ctx, x - 10, 222, 21, 25, done ? "#dcf58b" : "#173b43");
  text(
    ctx,
    done ? "✓" : o.attempted ? "×" : "!",
    x,
    240,
    18,
    done ? "#183b42" : "#fff3c6",
    "center",
  );
}
function cover() {
  const c = $("#cover").getContext("2d");
  rect(c, 0, 0, 400, 400, "#abd9cf");
  rect(c, 305, 46, 44, 44, "#f7e9ad");
  rect(c, 25, 86, 72, 13, "#e4f0dc");
  rect(c, 47, 75, 32, 12, "#e4f0dc");
  building(c, 36, 144, 155, 180, "#ebc180", "FARMÁCIA");
  building(c, 222, 116, 144, 208, "#83b3b0", "PARA TODOS");
  rect(c, 0, 324, 400, 28, "#dfe1bf");
  rect(c, 0, 352, 400, 48, "#658782");
  for (let i = 0; i < 5; i++) rect(c, i * 90, 375, 43, 5, "#eff0cb");
  tree(c, 208, 261);
  c.fillStyle = "#f1df9c";
  c.beginPath();
  c.moveTo(54, 352);
  c.lineTo(124, 324);
  c.lineTo(124, 352);
  c.fill();
  wheelchair(c, 73, 306);
  person(c, 274, 308, palette[0]);
  icon(c, 333, 241, 2);
}
cover();
$$(".avatar canvas").forEach((c, i) => {
  const a = c.getContext("2d");
  a.scale(1.5, 1.5);
  person(
    a,
    6,
    3,
    palette[i],
    i === 1 ? "#865338" : i === 2 ? "#d8a17d" : "#b57b55",
  );
});
function checkOrientation() {
  const was = portrait;
  portrait = matchMedia(
    "(pointer: coarse) and (orientation: portrait)",
  ).matches;
  const overlay = $("#rotate");
  overlay.hidden = !portrait;
  if (portrait && !overlay.open) overlay.showModal();
  if (!portrait && overlay.open) overlay.close();
  if (portrait && !was) clearInput();
}
addEventListener("resize", checkOrientation);
addEventListener("orientationchange", checkOrientation);
checkOrientation();
try {
  $("#player-nickname").value =
    localStorage.getItem("cidade_acessivel_nickname") || "";
} catch {}
api("info")
  .then(({ mode }) => {
    $("#storage-label").textContent =
      mode === "local"
        ? "Modo local · Resultados neste servidor"
        : "Modo online · Ranking compartilhado";
  })
  .catch(() => {
    $("#storage-label").textContent =
      "Servidor indisponível. Inicie com npm run dev.";
  });
function frame(now) {
  const realDt = Math.max(0, (now - last) / 1000 || 0),
    dt = Math.min(realDt, 1 / 30);
  last = now;
  if (state === "game") {
    if (!portrait && !document.hidden && (!modal || modal.id === "challenge")) {
      elapsed += realDt;
      phaseElapsed += realDt;
    }
    if (!modal && !document.hidden && !portrait) update(dt);
    else updateHUD();
    draw();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

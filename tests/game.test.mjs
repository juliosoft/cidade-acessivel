import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
class El {
  constructor() {
    this.textContent = "";
    this.children = [];
    this.dataset = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.value = "";
  }
  append(...x) {
    this.children.push(...x);
  }
  replaceChildren() {
    this.children = [];
  }
  setAttribute() {}
  removeAttribute() {}
  focus() {}
  addEventListener() {}
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  getContext() {
    return new Proxy({}, { get: (a, k) => a[k] || (() => {}) });
  }
}
function setup() {
  const map = {},
    $ = (s) => (map[s] ??= new El());
  const avatars = [0, 1, 2].map((i) =>
    Object.assign(new El(), { dataset: { avatar: String(i) } }),
  );
  const context = {
    console,
    URL,
    AbortSignal,
    setTimeout,
    clearTimeout,
    Math,
    Date,
    JSON,
    Number,
    String,
    Array,
    Set,
    Error,
    document: {
      hidden: false,
      body: new El(),
      querySelector: $,
      querySelectorAll: (s) =>
        s === ".avatar"
          ? avatars
          : s === ".avatar canvas"
            ? [new El(), new El(), new El()]
            : s === "#options input"
              ? $("#options").children.map((l) => l.children[0])
              : [],
      createElement: () => new El(),
      createTextNode: (t) => t,
      addEventListener() {},
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame() {},
    addEventListener() {},
    HTMLButtonElement: El,
    fetch: async () => ({
      ok: false,
      json: async () => ({ error: "No session" }),
    }),
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(
    readFileSync(new URL("../public/game.js", import.meta.url), "utf8"),
    context,
  );
  return { run: (s) => vm.runInContext(s, context), map };
}
test("Challenge opens with no selected option; exactly one answer scores", () => {
  const { run, map } = setup();
  run("state='game';loadLevel();player.x=687;interact();");
  assert.equal(run("selectedChoice"), null);
  assert.equal(map["#confirm-choice"].disabled, true);
  assert(
    map["#options"].children.every((l) => l.children[0].checked === false),
  );
  run("answer(0);answer(1);");
  assert.equal(run("score"), 10);
  assert.equal(run("objects[0].solved"), false);
  assert.equal(run("objects[0].attempted"), true);
});
test("Finish permits skipped actions, preserves payload for retry", () => {
  const { run } = setup();
  run(
    "state='game';runId='r';loadLevel();player.x=2200;phaseElapsed=20;update(.016);",
  );
  assert.equal(run("pendingPhase.choices.every(x=>x===null)"), true);
  assert.equal(run("modal.id"), undefined);
  assert.equal(run("pendingPhase.elapsedMs"), 20000);
  assert.equal(run("levelIndex"), 0);
});
test("Moving and jumping land on the raised platforms", () => {
  const { run } = setup();
  run(
    "state='game';loadLevel();update(.016);input.right.add('test');update(.1);input.right.clear();",
  );
  assert(run("player.x") > 50);
  run("jump();update(.1);");
  assert(run("player.y") < 350);
  run(
    "player.x=380;player.y=260;player.vy=200;for(let i=0;i<30;i++)update(.016);",
  );
  assert.equal(run("player.y"), 290);
});

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  PLAYER_X,
  PLAYER_O,
  WIN_LINES,
  STORAGE_KEY,
  findWinningLine,
  isDraw,
  evaluateBoard,
  findRandomMoveIndex,
  findBestMoves,
  findBestMoveIndex,
  getCellAriaLabel,
  initializeApp,
  commitMove,
  handleBoardKeyDown,
  getGameState,
} = require("../app.js");

function readPngHeader(filePath) {
  const buf = fs.readFileSync(filePath);
  // PNG signature is 8 bytes, followed by IHDR chunk (4-byte length, 4-byte "IHDR", 4-byte width, 4-byte height, 1-byte bitDepth, 1-byte colorType)
  assert.equal(buf.toString("ascii", 12, 16), "IHDR");
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf.readUInt8(25),
  };
}

describe("Static Assets & Markup Structure", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("validates index.html contains valid ARIA roles, semantic controls, and mobile PWA tags", () => {
    const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");

    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /name="mobile-web-app-capable"\s+content="yes"/);
    assert.match(html, /name="apple-mobile-web-app-capable"\s+content="yes"/);
    assert.match(html, /manifest\.webmanifest/);
    assert.match(html, /id="board"[^>]*role="group"/);
    assert.doesNotMatch(html, /role="gridcell"/);

    for (let i = 0; i < 9; i++) {
      assert.match(
        html,
        new RegExp(`<button[^>]*class="cell"[^>]*data-index="${i}"`),
        `Expected cell button with data-index="${i}"`,
      );
    }

    assert.match(html, /id="difficulty-fieldset"/);
    assert.match(html, /id="theme-color-meta"/);
    assert.match(html, /id="score-x"/);
    assert.match(html, /id="score-o"/);
    assert.match(html, /id="score-ties"/);
    assert.match(html, /id="new-game-button"/);
    assert.match(html, /id="reset-scores-button"/);
  });

  it("validates manifest.webmanifest, maskable icons, and opaque iOS touch icon dimensions", () => {
    const raw = fs.readFileSync(
      path.join(rootDir, "manifest.webmanifest"),
      "utf8",
    );
    const manifest = JSON.parse(raw);

    assert.equal(manifest.name, "Tic Tac Toe");
    assert.equal(manifest.start_url, "./");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#091326");
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);
    assert.ok(
      manifest.icons.some((icon) => icon.purpose === "maskable"),
      "Expected at least one maskable icon entry",
    );

    for (const icon of manifest.icons) {
      const iconPath = path.join(rootDir, icon.src);
      assert.ok(fs.existsSync(iconPath), `Missing icon file: ${icon.src}`);
      const { width, height } = readPngHeader(iconPath);
      assert.equal(
        `${width}x${height}`,
        icon.sizes,
        `Size mismatch for ${icon.src}`,
      );
    }

    // iOS apple-touch-icon must be 180x180 and opaque RGB (colorType 2, no alpha channel) so iOS doesn't render black corners
    const touchIcon = readPngHeader(path.join(rootDir, "icon-180.png"));
    assert.equal(touchIcon.width, 180);
    assert.equal(touchIcon.height, 180);
    assert.equal(touchIcon.colorType, 2);
  });
});

describe("Core Game Engine — Win & Draw Detection", () => {
  it("detects all 8 winning lines for both X and O", () => {
    assert.equal(WIN_LINES.length, 8);

    for (const line of WIN_LINES) {
      for (const player of [PLAYER_X, PLAYER_O]) {
        const board = Array(9).fill("");
        for (const idx of line.indices) {
          board[idx] = player;
        }
        const detected = findWinningLine(board, player);
        assert.ok(
          detected,
          `Expected win for ${player} on ${line.type} ${line.index}`,
        );
        assert.deepEqual(detected.indices, line.indices);
        assert.equal(
          findWinningLine(board, player === PLAYER_X ? PLAYER_O : PLAYER_X),
          null,
        );
      }
    }
  });

  it("returns null when there is no winning line", () => {
    const empty = Array(9).fill("");
    assert.equal(findWinningLine(empty, PLAYER_X), null);
    assert.equal(findWinningLine(empty, PLAYER_O), null);

    const drawn = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    assert.equal(findWinningLine(drawn, PLAYER_X), null);
    assert.equal(findWinningLine(drawn, PLAYER_O), null);
  });

  it("accurately identifies draw (full) vs non-full boards", () => {
    const drawn = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    assert.equal(isDraw(drawn), true);

    const partial = ["X", "O", "", "X", "O", "O", "O", "X", "X"];
    assert.equal(isDraw(partial), false);
  });

  it("formats accessible ARIA labels for cells", () => {
    assert.equal(getCellAriaLabel(0, ""), "Row 1, Column 1, empty");
    assert.equal(getCellAriaLabel(4, "X"), "Row 2, Column 2, marked X");
    assert.equal(getCellAriaLabel(8, "O"), "Row 3, Column 3, marked O");
  });
});

describe("Minimax AI & Move Selection", () => {
  function assertAiUnbeatable(startingTurn) {
    const visited = new Set();
    let terminalStates = 0;

    function explore(b, turn) {
      if (findWinningLine(b, PLAYER_X)) {
        assert.fail(
          `AI lost when ${startingTurn} started! Board: ${JSON.stringify(b)}`,
        );
      }
      if (findWinningLine(b, PLAYER_O) || isDraw(b)) {
        terminalStates++;
        return;
      }

      const key = `${turn}:${b.join(",")}`;
      if (visited.has(key)) return;
      visited.add(key);

      if (turn === PLAYER_X) {
        for (let i = 0; i < 9; i++) {
          if (b[i] === "") {
            b[i] = PLAYER_X;
            explore(b, PLAYER_O);
            b[i] = "";
          }
        }
      } else {
        const bestMoves = findBestMoves(b);
        assert.ok(bestMoves.length > 0);
        assert.ok(bestMoves.includes(findBestMoveIndex(b)));
        for (const aiMove of bestMoves) {
          b[aiMove] = PLAYER_O;
          explore(b, PLAYER_X);
          b[aiMove] = "";
        }
      }
    }

    explore(Array(9).fill(""), startingTurn);
    assert.ok(
      terminalStates > 100,
      `Expected >100 terminal states, got ${terminalStates}`,
    );
  }

  it("evaluates terminal boards accurately", () => {
    const xWin = ["X", "X", "X", "O", "O", "", "", "", ""];
    const oWin = ["X", "X", "", "O", "O", "O", "X", "", ""];
    const neutral = ["X", "O", "X", "", "", "", "", "", ""];

    assert.equal(evaluateBoard(xWin), 10);
    assert.equal(evaluateBoard(oWin), -10);
    assert.equal(evaluateBoard(neutral), 0);
  });

  it("selects only empty indices in findRandomMoveIndex", () => {
    const almostFull = ["X", "O", "X", "O", "", "X", "O", "X", "O"];
    for (let i = 0; i < 10; i++) {
      assert.equal(findRandomMoveIndex(almostFull), 4);
    }

    const full = ["X", "O", "X", "O", "X", "X", "O", "X", "O"];
    assert.equal(findRandomMoveIndex(full), -1);
  });

  it("takes an immediate winning move for O when available", () => {
    const board = ["X", "X", "", "O", "O", "", "X", "", ""];
    assert.deepEqual(findBestMoves(board), [5]);
    assert.equal(findBestMoveIndex(board), 5);
  });

  it("blocks an immediate winning threat from X", () => {
    const board = ["X", "X", "", "", "O", "", "", "", ""];
    assert.deepEqual(findBestMoves(board), [2]);
    assert.equal(findBestMoveIndex(board), 2);
  });

  it("plays center (4) when X opens in a corner", () => {
    const board = ["X", "", "", "", "", "", "", "", ""];
    assert.deepEqual(findBestMoves(board), [4]);
    assert.equal(findBestMoveIndex(board), 4);
  });

  it("plays a corner (0, 2, 6, or 8) when X opens in the center", () => {
    const board = ["", "", "", "", "X", "", "", "", ""];
    assert.deepEqual(findBestMoves(board), [0, 2, 6, 8]);
    const move = findBestMoveIndex(board);
    assert.ok([0, 2, 6, 8].includes(move), `Expected corner move, got ${move}`);
  });

  it("proves AI (O) is unbeatable across every tied optimal move when X starts", () => {
    assertAiUnbeatable(PLAYER_X);
  });

  it("proves AI (O) is unbeatable across every tied optimal move when O (AI) starts", () => {
    assertAiUnbeatable(PLAYER_O);
  });
});

describe("Interactive DOM, Click Guards & Timed AI Integration", () => {
  function setupMockDom() {
    const listeners = new Map();

    function createMockElement(tag, id = "", dataset = {}) {
      const classSet = new Set();
      const attrs = new Map();
      const elListeners = {};
      const children = [];

      const el = {
        tagName: tag.toUpperCase(),
        id,
        dataset: { ...dataset },
        textContent: "",
        innerHTML: "",
        disabled: false,
        checked: false,
        value: "",
        offsetWidth: 100,
        children,
        classList: {
          add: (...cls) => cls.forEach((c) => classSet.add(c)),
          remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
          toggle: (c, force) => {
            const shouldHave = force !== undefined ? force : !classSet.has(c);
            if (shouldHave) classSet.add(c);
            else classSet.delete(c);
          },
          contains: (c) => classSet.has(c),
        },
        setAttribute: (k, v) => attrs.set(k, String(v)),
        getAttribute: (k) => attrs.get(k) ?? null,
        appendChild: (child) => {
          children.push(child);
          return child;
        },
        append: (...nodes) => children.push(...nodes),
        addEventListener: (type, fn) => {
          elListeners[type] = elListeners[type] || [];
          elListeners[type].push(fn);
        },
        trigger: (type, eventProps = {}) => {
          const handlers = elListeners[type] || [];
          for (const fn of handlers) {
            fn({
              currentTarget: el,
              target: el,
              preventDefault: () => {},
              ...eventProps,
            });
          }
        },
        focus: function () {
          global.document.activeElement = this;
        },
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 300,
          height: 300,
        }),
      };

      return el;
    }

    const elementsById = {};
    const register = (id, tag = "div", dataset = {}) => {
      const el = createMockElement(tag, id, dataset);
      elementsById[id] = el;
      return el;
    };

    register("board", "div");
    register("status", "p");
    register("status-dot", "span");
    register("new-game-button", "button");
    register("reset-scores-button", "button");
    register("sound-toggle", "button");
    register("theme-checkbox", "input");
    register("theme-color-meta", "meta");
    register("difficulty-fieldset", "fieldset");
    register("win-line-svg", "svg");
    register("win-line", "line");
    register("score-x", "output");
    register("score-o", "output");
    register("score-ties", "output");
    register("score-card-x", "div");
    register("score-card-o", "div");
    register("score-card-ties", "div");
    register("label-player-x", "span");
    register("label-player-o", "span");

    const statusBanner = createMockElement("div", "", {});
    statusBanner.classList.add("status-banner");

    const cells = Array.from({ length: 9 }, (_, idx) => {
      const c = createMockElement("button", "", { index: String(idx) });
      c.classList.add("cell");
      return c;
    });

    const onePlayerRadio = createMockElement("input");
    onePlayerRadio.value = "onePlayer";
    onePlayerRadio.checked = true;
    const twoPlayerRadio = createMockElement("input");
    twoPlayerRadio.value = "twoPlayer";

    const easyRadio = createMockElement("input");
    easyRadio.value = "easy";
    const mediumRadio = createMockElement("input");
    mediumRadio.value = "medium";
    mediumRadio.checked = true;
    const hardRadio = createMockElement("input");
    hardRadio.value = "hard";

    const storage = new Map();
    global.localStorage = {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      clear: () => storage.clear(),
    };

    global.window = {
      innerWidth: 1024,
      innerHeight: 768,
      matchMedia: () => ({ matches: false }),
      addEventListener: (type, fn) => listeners.set(type, fn),
    };

    global.document = {
      activeElement: null,
      getElementById: (id) => elementsById[id] ?? null,
      createElementNS: (_ns, tag) => createMockElement(tag),
      querySelector: (sel) => {
        if (sel === ".status-banner") return statusBanner;
        if (sel.includes('value="onePlayer"')) return onePlayerRadio;
        if (sel.includes('value="twoPlayer"')) return twoPlayerRadio;
        if (sel.includes('value="easy"')) return easyRadio;
        if (sel.includes('value="medium"')) return mediumRadio;
        if (sel.includes('value="hard"')) return hardRadio;
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel === ".cell") return cells;
        if (sel === 'input[name="gameMode"]')
          return [onePlayerRadio, twoPlayerRadio];
        if (sel === 'input[name="difficulty"]')
          return [easyRadio, mediumRadio, hardRadio];
        return [];
      },
    };

    return { elementsById, cells, onePlayerRadio, twoPlayerRadio, hardRadio };
  }

  let dom;

  beforeEach(() => {
    dom = setupMockDom();
    initializeApp();
  });

  it("plays a complete 2-player game via cell click events to an X win", () => {
    dom.twoPlayerRadio.trigger("change", { target: { value: "twoPlayer" } });

    dom.cells[0].trigger("click");
    dom.cells[3].trigger("click");
    dom.cells[1].trigger("click");
    dom.cells[4].trigger("click");
    dom.cells[2].trigger("click");

    const state = getGameState();
    assert.equal(state.gameOver, true);
    assert.equal(state.scores.X, 1);
    assert.equal(state.scores.O, 0);
    assert.equal(dom.elementsById["score-x"].textContent, "1");
    assert.equal(dom.cells[0].classList.contains("highlight"), true);
    assert.equal(dom.cells[1].classList.contains("highlight"), true);
    assert.equal(dom.cells[2].classList.contains("highlight"), true);

    const persisted = JSON.parse(global.localStorage.getItem(STORAGE_KEY));
    assert.equal(persisted.scores.X, 1);
  });

  it("preserves separate score records when switching between 1P and 2P modes", () => {
    // Win a game in 2P mode
    dom.twoPlayerRadio.trigger("change", { target: { value: "twoPlayer" } });
    [0, 3, 1, 4, 2].forEach((idx) => dom.cells[idx].trigger("click"));
    assert.equal(getGameState().scores.X, 1);
    assert.equal(dom.elementsById["score-x"].textContent, "1");

    // Switch to 1P mode -> 1P scores are 0
    dom.onePlayerRadio.trigger("change", { target: { value: "onePlayer" } });
    assert.equal(getGameState().scores.X, 0);
    assert.equal(dom.elementsById["score-x"].textContent, "0");

    // Switch back to 2P mode -> 2P score of 1 is preserved
    dom.twoPlayerRadio.trigger("change", { target: { value: "twoPlayer" } });
    assert.equal(getGameState().scores.X, 1);
    assert.equal(dom.elementsById["score-x"].textContent, "1");
  });

  it("disables the difficulty fieldset in 2-player mode and re-enables it in 1-player mode", () => {
    assert.equal(dom.elementsById["difficulty-fieldset"].disabled, false);

    dom.twoPlayerRadio.trigger("change", { target: { value: "twoPlayer" } });
    assert.equal(dom.elementsById["difficulty-fieldset"].disabled, true);

    dom.onePlayerRadio.trigger("change", { target: { value: "onePlayer" } });
    assert.equal(dom.elementsById["difficulty-fieldset"].disabled, false);
  });

  it("updates the theme-color meta tag when toggling light/dark theme", () => {
    const themeMeta = dom.elementsById["theme-color-meta"];
    const themeCheckbox = dom.elementsById["theme-checkbox"];

    assert.equal(themeMeta.getAttribute("content"), "#091326");

    themeCheckbox.checked = true;
    themeCheckbox.trigger("change");
    assert.equal(themeMeta.getAttribute("content"), "#eef5fc");
  });

  it("ignores clicks on already-occupied cells and clicks after gameOver", () => {
    dom.twoPlayerRadio.trigger("change", { target: { value: "twoPlayer" } });

    dom.cells[0].trigger("click");
    assert.equal(getGameState().board[0], PLAYER_X);
    assert.equal(getGameState().currentPlayer, PLAYER_O);

    dom.cells[0].trigger("click");
    assert.equal(getGameState().board[0], PLAYER_X);
    assert.equal(getGameState().currentPlayer, PLAYER_O);

    dom.cells[3].trigger("click");
    dom.cells[1].trigger("click");
    dom.cells[4].trigger("click");
    dom.cells[2].trigger("click");
    assert.equal(getGameState().gameOver, true);

    dom.cells[8].trigger("click");
    assert.equal(getGameState().board[8], "");
    assert.equal(getGameState().scores.X, 1);
    assert.equal(getGameState().scores.O, 0);
  });

  it("handles 1-player timed AI move and blocks clicks while AI is thinking", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    dom.hardRadio.trigger("change", { target: { value: "hard" } });

    dom.cells[0].trigger("click");
    let state = getGameState();
    assert.equal(state.board[0], PLAYER_X);
    assert.equal(state.currentPlayer, PLAYER_O);
    assert.equal(state.isComputerThinking, true);

    dom.cells[1].trigger("click");
    assert.equal(getGameState().board[1], "");

    t.mock.timers.tick(380);
    state = getGameState();
    assert.equal(state.isComputerThinking, false);
    assert.equal(state.board[4], PLAYER_O);
    assert.equal(state.currentPlayer, PLAYER_X);
  });

  it("triggers AI opening move when New Round alternates starter to O in 1-player mode", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    assert.equal(getGameState().startingPlayer, PLAYER_X);
    dom.elementsById["new-game-button"].trigger("click");

    let state = getGameState();
    assert.equal(state.startingPlayer, PLAYER_O);
    assert.equal(state.currentPlayer, PLAYER_O);
    assert.equal(state.isComputerThinking, true);
    assert.equal(
      dom.elementsById["status"].textContent,
      "AI starts this round...",
    );

    t.mock.timers.tick(380);
    state = getGameState();
    assert.equal(state.isComputerThinking, false);
    assert.equal(state.board.filter((c) => c === PLAYER_O).length, 1);
    assert.equal(state.currentPlayer, PLAYER_X);
  });

  it("records a draw game via cell clicks and increments draws counter", () => {
    dom.twoPlayerRadio.trigger("change", { target: { value: "twoPlayer" } });

    [0, 4, 1, 2, 6, 3, 5, 7, 8].forEach((idx) =>
      dom.cells[idx].trigger("click"),
    );

    const state = getGameState();
    assert.equal(state.gameOver, true);
    assert.equal(state.scores.ties, 1);
    assert.equal(dom.elementsById["score-ties"].textContent, "1");
  });

  it("navigates across the 3x3 board with keyboard arrow keys", () => {
    dom.cells[0].focus();
    assert.equal(global.document.activeElement, dom.cells[0]);

    handleBoardKeyDown({ key: "ArrowRight", preventDefault: () => {} });
    assert.equal(global.document.activeElement, dom.cells[1]);

    handleBoardKeyDown({ key: "ArrowDown", preventDefault: () => {} });
    assert.equal(global.document.activeElement, dom.cells[4]);

    handleBoardKeyDown({ key: "ArrowLeft", preventDefault: () => {} });
    assert.equal(global.document.activeElement, dom.cells[3]);

    handleBoardKeyDown({ key: "ArrowUp", preventDefault: () => {} });
    assert.equal(global.document.activeElement, dom.cells[0]);
  });

  it("restores new-format scoresByMode and gameMode from localStorage", () => {
    dom = setupMockDom();
    global.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scoresByMode: {
          onePlayer: { X: 4, O: 2, ties: 1 },
          twoPlayer: { X: 7, O: 5, ties: 3 },
        },
        gameMode: "twoPlayer",
      }),
    );
    initializeApp();

    const state = getGameState();
    assert.deepEqual(state.scoresByMode, {
      onePlayer: { X: 4, O: 2, ties: 1 },
      twoPlayer: { X: 7, O: 5, ties: 3 },
    });
    assert.deepEqual(state.scores, { X: 7, O: 5, ties: 3 });
    assert.equal(dom.elementsById["score-x"].textContent, "7");
    assert.equal(dom.elementsById["score-o"].textContent, "5");
    assert.equal(dom.elementsById["score-ties"].textContent, "3");
    assert.equal(dom.elementsById["label-player-x"].textContent, "Player X");
    assert.equal(dom.elementsById["label-player-o"].textContent, "Player O");

    dom.onePlayerRadio.trigger("change", { target: { value: "onePlayer" } });
    assert.equal(dom.elementsById["score-x"].textContent, "4");
    assert.equal(dom.elementsById["score-o"].textContent, "2");
    assert.equal(dom.elementsById["score-ties"].textContent, "1");
    assert.equal(dom.elementsById["label-player-x"].textContent, "You");
    assert.equal(dom.elementsById["label-player-o"].textContent, "AI");
  });

  it("converts old-format save with gameMode into scoresByMode for that mode", () => {
    dom = setupMockDom();
    global.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scores: { X: 3, O: 1, ties: 2 },
        gameMode: "twoPlayer",
      }),
    );
    initializeApp();

    const state = getGameState();
    assert.deepEqual(state.scoresByMode.twoPlayer, { X: 3, O: 1, ties: 2 });
    assert.deepEqual(state.scoresByMode.onePlayer, { X: 0, O: 0, ties: 0 });
  });

  it("converts old-format save without gameMode into onePlayer scores", () => {
    dom = setupMockDom();
    global.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scores: { X: 3, O: 1, ties: 2 },
      }),
    );
    initializeApp();

    const state = getGameState();
    assert.deepEqual(state.scoresByMode.onePlayer, { X: 3, O: 1, ties: 2 });
    assert.deepEqual(state.scoresByMode.twoPlayer, { X: 0, O: 0, ties: 0 });
  });

  it("saves converted old-format scores under scoresByMode on subsequent save", () => {
    dom = setupMockDom();
    global.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scores: { X: 3, O: 1, ties: 2 },
        gameMode: "twoPlayer",
      }),
    );
    initializeApp();

    dom.onePlayerRadio.trigger("change", { target: { value: "onePlayer" } });
    const persisted = JSON.parse(global.localStorage.getItem(STORAGE_KEY));
    assert.deepEqual(persisted.scoresByMode, {
      onePlayer: { X: 0, O: 0, ties: 0 },
      twoPlayer: { X: 3, O: 1, ties: 2 },
    });
  });

  it("round-trips scores for both modes and active gameMode across reload", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    // Win a game in 1-player mode
    commitMove(0);
    commitMove(3);
    commitMove(1);
    commitMove(4);
    commitMove(2);
    assert.equal(getGameState().scoresByMode.onePlayer.X, 1);

    // Switch to 2-player mode and win a game
    dom.twoPlayerRadio.trigger("change", { target: { value: "twoPlayer" } });
    [0, 3, 1, 4, 2].forEach((idx) => dom.cells[idx].trigger("click"));
    assert.equal(getGameState().scoresByMode.twoPlayer.X, 1);

    const savedJson = global.localStorage.getItem(STORAGE_KEY);
    assert.ok(savedJson);

    dom = setupMockDom();
    global.localStorage.setItem(STORAGE_KEY, savedJson);
    initializeApp();

    const restored = getGameState();
    assert.equal(restored.gameMode, "twoPlayer");
    assert.deepEqual(restored.scoresByMode.onePlayer, { X: 1, O: 0, ties: 0 });
    assert.deepEqual(restored.scoresByMode.twoPlayer, { X: 1, O: 0, ties: 0 });
    assert.deepEqual(restored.scores, { X: 1, O: 0, ties: 0 });
  });

  it("loads defaults without throwing when saved data is malformed or invalid", () => {
    // 1. Invalid JSON
    dom = setupMockDom();
    global.localStorage.setItem(STORAGE_KEY, "{not json");
    assert.doesNotThrow(() => initializeApp());
    let state = getGameState();
    assert.equal(state.gameMode, "onePlayer");
    assert.deepEqual(state.scoresByMode, {
      onePlayer: { X: 0, O: 0, ties: 0 },
      twoPlayer: { X: 0, O: 0, ties: 0 },
    });

    // 2. Non-numeric scores and null mode record
    dom = setupMockDom();
    global.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scoresByMode: { onePlayer: { X: "abc" }, twoPlayer: null },
      }),
    );
    assert.doesNotThrow(() => initializeApp());
    state = getGameState();
    assert.deepEqual(state.scoresByMode, {
      onePlayer: { X: 0, O: 0, ties: 0 },
      twoPlayer: { X: 0, O: 0, ties: 0 },
    });

    // 3. Invalid gameMode
    dom = setupMockDom();
    global.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        gameMode: "threePlayer",
      }),
    );
    assert.doesNotThrow(() => initializeApp());
    state = getGameState();
    assert.equal(state.gameMode, "onePlayer");
    assert.deepEqual(state.scores, { X: 0, O: 0, ties: 0 });
  });
});

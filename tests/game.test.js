const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  PLAYER_X,
  PLAYER_O,
  DIFFICULTY_STRENGTH,
  WIN_LINES,
  STORAGE_KEY,
  findWinningLine,
  isDraw,
  evaluateBoard,
  minimax,
  findRandomMoveIndex,
  findBestMoveIndex,
  getCellAriaLabel,
  initializeApp,
  startNewRound,
  commitMove,
  handleCellClick,
  handleBoardKeyDown,
  getGameState,
} = require("../app.js");

describe("Static Assets & Markup Structure", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("validates index.html contains required semantic controls and mobile viewport tags", () => {
    const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");

    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /apple-mobile-web-app-capable/);
    assert.match(html, /manifest\.webmanifest/);

    for (let i = 0; i < 9; i++) {
      assert.match(
        html,
        new RegExp(`<button[^>]*class="cell"[^>]*data-index="${i}"`),
        `Expected cell button with data-index="${i}"`
      );
    }

    assert.match(html, /id="score-x"/);
    assert.match(html, /id="score-o"/);
    assert.match(html, /id="score-ties"/);
    assert.match(html, /id="new-game-button"/);
    assert.match(html, /id="reset-scores-button"/);
  });

  it("validates manifest.webmanifest is valid JSON with required PWA fields", () => {
    const raw = fs.readFileSync(
      path.join(rootDir, "manifest.webmanifest"),
      "utf8"
    );
    const manifest = JSON.parse(raw);

    assert.equal(manifest.name, "Tic Tac Toe");
    assert.equal(manifest.display, "standalone");
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 1);
  });

  it("validates style.css includes modern cascade layers, dvh units, and reduced-motion rules", () => {
    const css = fs.readFileSync(path.join(rootDir, "style.css"), "utf8");

    assert.match(css, /@layer\s+reset,\s*base,\s*theme,\s*components,\s*utilities;/);
    assert.match(css, /100dvh/);
    assert.match(css, /:has\(/);
    assert.match(css, /--spring-easing:\s*linear\(/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
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
        assert.ok(detected, `Expected win for ${player} on ${line.type} ${line.index}`);
        assert.deepEqual(detected.indices, line.indices);
        assert.equal(
          findWinningLine(board, player === PLAYER_X ? PLAYER_O : PLAYER_X),
          null
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
    // O has indices 3 and 4, should play 5 to win immediately
    const board = ["X", "X", "", "O", "O", "", "X", "", ""];
    assert.equal(findBestMoveIndex(board), 5);
  });

  it("blocks an immediate winning threat from X", () => {
    // X threatens top row (0, 1 -> needs 2)
    const board = ["X", "X", "", "", "O", "", "", "", ""];
    assert.equal(findBestMoveIndex(board), 2);
  });

  it("plays center (4) when X opens in a corner", () => {
    const board = ["X", "", "", "", "", "", "", "", ""];
    assert.equal(findBestMoveIndex(board), 4);
  });

  it("plays a corner (0, 2, 6, or 8) when X opens in the center", () => {
    const board = ["", "", "", "", "X", "", "", "", ""];
    const move = findBestMoveIndex(board);
    assert.ok([0, 2, 6, 8].includes(move), `Expected corner move, got ${move}`);
  });

  it("proves AI (O) is unbeatable across all possible human (X) move sequences", () => {
    // Deterministically pick the first optimal move to exhaustively verify the minimax tree
    function getDeterministicBestMove(b) {
      let bestVal = 1000;
      let bestMove = -1;
      for (let i = 0; i < 9; i++) {
        if (b[i] === "") {
          b[i] = PLAYER_O;
          const val = minimax(b, 0, true);
          b[i] = "";
          if (val < bestVal) {
            bestVal = val;
            bestMove = i;
          }
        }
      }
      return bestMove;
    }

    let gamesSimulated = 0;

    function simulateAllHumanMoves(b, turn) {
      if (findWinningLine(b, PLAYER_X)) {
        assert.fail(`AI lost a game! Board: ${JSON.stringify(b)}`);
      }
      if (findWinningLine(b, PLAYER_O) || isDraw(b)) {
        gamesSimulated++;
        return;
      }

      if (turn === PLAYER_X) {
        for (let i = 0; i < 9; i++) {
          if (b[i] === "") {
            b[i] = PLAYER_X;
            simulateAllHumanMoves(b, PLAYER_O);
            b[i] = "";
          }
        }
      } else {
        const aiMove = getDeterministicBestMove(b);
        assert.notEqual(aiMove, -1);
        b[aiMove] = PLAYER_O;
        simulateAllHumanMoves(b, PLAYER_X);
        b[aiMove] = "";
      }
    }

    simulateAllHumanMoves(Array(9).fill(""), PLAYER_X);
    assert.ok(gamesSimulated > 500, `Expected >500 terminal states, got ${gamesSimulated}`);
  });
});

describe("Interactive DOM & State Integration", () => {
  function setupMockDom() {
    const listeners = new Map();

    function createMockElement(tag, id = "", dataset = {}) {
      const classSet = new Set();
      const attrs = new Map();
      const elListeners = {};
      const children = [];

      return {
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

      var el;
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
      matchMedia: () => ({ matches: true }),
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
        if (sel === 'input[name="gameMode"]') return [onePlayerRadio, twoPlayerRadio];
        if (sel === 'input[name="difficulty"]') return [easyRadio, mediumRadio, hardRadio];
        return [];
      },
    };

    return { elementsById, cells, twoPlayerRadio };
  }

  let dom;

  beforeEach(() => {
    dom = setupMockDom();
    initializeApp();
    // Switch to 2-player mode for deterministic turn-by-turn DOM assertions
    dom.twoPlayerRadio.trigger("change", { target: { value: "twoPlayer" } });
    dom.elementsById["reset-scores-button"].trigger("click");
  });

  it("plays a complete 2-player game to an X win and updates scoreboard + storage", () => {
    // X: 0, O: 3, X: 1, O: 4, X: 2 (top row win)
    commitMove(0);
    commitMove(3);
    commitMove(1);
    commitMove(4);
    commitMove(2);

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

  it("records a draw game and increments draws counter", () => {
    // Draw sequence: X:0, O:4, X:1, O:2, X:6, O:3, X:5, O:7, X:8
    [0, 4, 1, 2, 6, 3, 5, 7, 8].forEach((idx) => commitMove(idx));

    const state = getGameState();
    assert.equal(state.gameOver, true);
    assert.equal(state.scores.ties, 1);
    assert.equal(dom.elementsById["score-ties"].textContent, "1");
  });

  it("alternates starting player when New Round is clicked", () => {
    assert.equal(getGameState().startingPlayer, PLAYER_X);
    dom.elementsById["new-game-button"].trigger("click");
    assert.equal(getGameState().startingPlayer, PLAYER_O);
    assert.equal(getGameState().currentPlayer, PLAYER_O);
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
});

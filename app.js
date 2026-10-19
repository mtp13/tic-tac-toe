const PLAYER_X = "X";
const PLAYER_O = "O";

const DIFFICULTY_STRENGTH = {
  easy: 0.4,
  medium: 0.8,
  hard: 1.0,
};

const WIN_LINES = [
  { indices: [0, 1, 2], type: "row", index: 0 },
  { indices: [3, 4, 5], type: "row", index: 1 },
  { indices: [6, 7, 8], type: "row", index: 2 },
  { indices: [0, 3, 6], type: "col", index: 0 },
  { indices: [1, 4, 7], type: "col", index: 1 },
  { indices: [2, 5, 8], type: "col", index: 2 },
  { indices: [0, 4, 8], type: "dia", index: 0 },
  { indices: [2, 4, 6], type: "dia", index: 1 },
];

const STORAGE_KEY = "ttt_modern_state_v1";

// Game State
let board = Array(9).fill("");
let currentPlayer = PLAYER_X;
let startingPlayer = PLAYER_X;
let gameOver = false;
let isComputerThinking = false;
let computerTimeoutId = null;
let gameMode = "onePlayer";
let difficulty = "medium";
let soundEnabled = true;
let scores = { X: 0, O: 0, ties: 0 };

// DOM Elements
let boardEl = null;
let cells = [];
let statusBanner = null;
let statusText = null;
let statusDot = null;
let newGameButton = null;
let resetScoresButton = null;
let soundToggleBtn = null;
let themeCheckbox = null;
let winLineSvg = null;
let winLine = null;

let scoreXEl = null;
let scoreOEl = null;
let scoreTiesEl = null;
let scoreCardX = null;
let scoreCardO = null;
let scoreCardTies = null;
let labelPlayerX = null;
let labelPlayerO = null;
let difficultyFieldset = null;
let themeColorMeta = null;
let confettiCanvas = null;
let confettiCtx = null;

function bindDomElements() {
  boardEl = document.getElementById("board");
  cells = Array.from(document.querySelectorAll(".cell"));
  statusBanner = document.querySelector(".status-banner");
  statusText = document.getElementById("status");
  statusDot = document.getElementById("status-dot");
  newGameButton = document.getElementById("new-game-button");
  resetScoresButton = document.getElementById("reset-scores-button");
  soundToggleBtn = document.getElementById("sound-toggle");
  themeCheckbox = document.getElementById("theme-checkbox");
  winLineSvg = document.getElementById("win-line-svg");
  winLine = document.getElementById("win-line");

  scoreXEl = document.getElementById("score-x");
  scoreOEl = document.getElementById("score-o");
  scoreTiesEl = document.getElementById("score-ties");
  scoreCardX = document.getElementById("score-card-x");
  scoreCardO = document.getElementById("score-card-o");
  scoreCardTies = document.getElementById("score-card-ties");
  labelPlayerX = document.getElementById("label-player-x");
  labelPlayerO = document.getElementById("label-player-o");
  difficultyFieldset = document.getElementById("difficulty-fieldset");
  themeColorMeta = document.getElementById("theme-color-meta");
  confettiCanvas = document.getElementById("confetti-canvas");
  confettiCtx = confettiCanvas ? confettiCanvas.getContext("2d") : null;
}

// Web Audio Synthesizer for tactile, zero-dependency sound effects
let audioCtx = null;

function getAudioContext() {
  if (!soundEnabled) return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(freq, duration = 0.09, type = "sine", delay = 0, gainPeak = 0.12) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + delay;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  } catch {
    // Ignore audio errors on restricted devices
  }
}

function playSound(effect) {
  if (!soundEnabled) return;
  switch (effect) {
    case "moveX":
      playTone(520, 0.08, "triangle", 0, 0.13);
      break;
    case "moveO":
      playTone(390, 0.09, "sine", 0, 0.13);
      break;
    case "win":
      playTone(523.25, 0.12, "triangle", 0, 0.14); // C5
      playTone(659.25, 0.12, "triangle", 0.09, 0.14); // E5
      playTone(783.99, 0.14, "triangle", 0.18, 0.14); // G5
      playTone(1046.5, 0.28, "triangle", 0.27, 0.16); // C6
      break;
    case "draw":
      playTone(349.23, 0.14, "sine", 0, 0.1);
      playTone(311.13, 0.22, "sine", 0.12, 0.1);
      break;
    case "reset":
      playTone(440, 0.06, "sine", 0, 0.08);
      break;
  }
}

// Persistence
function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Default to light theme if system prefers light
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        themeCheckbox.checked = true;
      }
      return;
    }
    const saved = JSON.parse(raw);
    if (saved.scores) {
      scores.X = Number(saved.scores.X) || 0;
      scores.O = Number(saved.scores.O) || 0;
      scores.ties = Number(saved.scores.ties) || 0;
    }
    if (typeof saved.soundEnabled === "boolean") {
      soundEnabled = saved.soundEnabled;
    }
    if (typeof saved.lightTheme === "boolean") {
      themeCheckbox.checked = saved.lightTheme;
    }
    if (saved.gameMode === "onePlayer" || saved.gameMode === "twoPlayer") {
      gameMode = saved.gameMode;
      const radio = document.querySelector(`input[name="gameMode"][value="${gameMode}"]`);
      if (radio) radio.checked = true;
    }
    if (saved.difficulty && DIFFICULTY_STRENGTH[saved.difficulty] !== undefined) {
      difficulty = saved.difficulty;
      const diffRadio = document.querySelector(`input[name="difficulty"][value="${difficulty}"]`);
      if (diffRadio) diffRadio.checked = true;
    }
  } catch {
    // Ignore storage errors in private browsing
  }
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scores,
        soundEnabled,
        lightTheme: themeCheckbox.checked,
        gameMode,
        difficulty,
      })
    );
  } catch {
    // Ignore storage errors
  }
}

// SVG Mark Factory
function createMarkSVG(player) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("mark-svg", player === PLAYER_X ? "mark-x" : "mark-o");

  if (player === PLAYER_X) {
    const line1 = document.createElementNS(svgNS, "line");
    line1.setAttribute("x1", "22");
    line1.setAttribute("y1", "22");
    line1.setAttribute("x2", "78");
    line1.setAttribute("y2", "78");
    line1.setAttribute("stroke", "currentColor");
    line1.setAttribute("stroke-width", "14");
    line1.setAttribute("stroke-linecap", "round");

    const line2 = document.createElementNS(svgNS, "line");
    line2.setAttribute("x1", "78");
    line2.setAttribute("y1", "22");
    line2.setAttribute("x2", "22");
    line2.setAttribute("y2", "78");
    line2.setAttribute("stroke", "currentColor");
    line2.setAttribute("stroke-width", "14");
    line2.setAttribute("stroke-linecap", "round");

    svg.append(line1, line2);
  } else {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "50");
    circle.setAttribute("cy", "50");
    circle.setAttribute("r", "30");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "currentColor");
    circle.setAttribute("stroke-width", "14");
    circle.setAttribute("stroke-linecap", "round");
    svg.appendChild(circle);
  }

  return svg;
}

function getCellAriaLabel(index, mark) {
  const r = Math.floor(index / 3) + 1;
  const c = (index % 3) + 1;
  const state = mark ? `marked ${mark}` : "empty";
  return `Row ${r}, Column ${c}, ${state}`;
}

function updateScoreboardUI(bumpKey = null) {
  scoreXEl.textContent = String(scores.X);
  scoreOEl.textContent = String(scores.O);
  scoreTiesEl.textContent = String(scores.ties);

  if (gameMode === "onePlayer") {
    labelPlayerX.textContent = "You";
    labelPlayerO.textContent = "AI";
  } else {
    labelPlayerX.textContent = "Player X";
    labelPlayerO.textContent = "Player O";
  }

  scoreCardX.classList.toggle("active-turn", !gameOver && currentPlayer === PLAYER_X);
  scoreCardO.classList.toggle("active-turn", !gameOver && currentPlayer === PLAYER_O);

  if (bumpKey) {
    const targetCard =
      bumpKey === PLAYER_X
        ? scoreCardX
        : bumpKey === PLAYER_O
          ? scoreCardO
          : scoreCardTies;
    targetCard.classList.remove("score-bump");
    void targetCard.offsetWidth;
    targetCard.classList.add("score-bump");
    setTimeout(() => targetCard.classList.remove("score-bump"), 450);
  }
}

function updateStatus(message, { animate = false, state = "turn", dotPlayer = currentPlayer } = {}) {
  statusText.textContent = message;
  statusBanner.dataset.state = state;
  statusDot.dataset.player = dotPlayer;

  if (animate) {
    statusBanner.classList.remove("scale-up");
    void statusBanner.offsetWidth;
    statusBanner.classList.add("scale-up");
    setTimeout(() => {
      statusBanner.classList.remove("scale-up");
    }, 500);
  }
}

function syncBoardAttributes() {
  boardEl.dataset.turn = currentPlayer;
  boardEl.dataset.gameOver = String(gameOver);
}

function resetWinLine() {
  winLineSvg.classList.remove("visible");
  delete winLineSvg.dataset.winner;
}

function drawWinLine(winInfo, winner) {
  const firstCell = cells[winInfo.indices[0]];
  const lastCell = cells[winInfo.indices[2]];
  const boardRect = boardEl.getBoundingClientRect();
  const firstRect = firstCell.getBoundingClientRect();
  const lastRect = lastCell.getBoundingClientRect();

  if (boardRect.width === 0 || boardRect.height === 0) return;

  const scaleX = 300 / boardRect.width;
  const scaleY = 300 / boardRect.height;

  const x1 = (firstRect.left - boardRect.left + firstRect.width / 2) * scaleX;
  const y1 = (firstRect.top - boardRect.top + firstRect.height / 2) * scaleY;
  const x2 = (lastRect.left - boardRect.left + lastRect.width / 2) * scaleX;
  const y2 = (lastRect.top - boardRect.top + lastRect.height / 2) * scaleY;

  winLine.setAttribute("x1", x1.toFixed(1));
  winLine.setAttribute("y1", y1.toFixed(1));
  winLine.setAttribute("x2", x2.toFixed(1));
  winLine.setAttribute("y2", y2.toFixed(1));

  winLineSvg.dataset.winner = winner;
  winLineSvg.classList.add("visible");
}

function startNewRound({ alternateStarter = false, playResetSound = false } = {}) {
  if (computerTimeoutId) {
    clearTimeout(computerTimeoutId);
    computerTimeoutId = null;
  }
  isComputerThinking = false;
  gameOver = false;
  board = Array(9).fill("");

  if (alternateStarter) {
    startingPlayer = startingPlayer === PLAYER_X ? PLAYER_O : PLAYER_X;
  } else {
    startingPlayer = PLAYER_X;
  }
  currentPlayer = startingPlayer;

  delete boardEl.dataset.hasWinner;
  resetWinLine();

  cells.forEach((cell, idx) => {
    cell.innerHTML = "";
    cell.classList.remove("highlight");
    delete cell.dataset.mark;
    cell.disabled = false;
    cell.setAttribute("aria-label", getCellAriaLabel(idx, ""));
  });

  syncBoardAttributes();
  updateScoreboardUI();

  if (playResetSound) {
    playSound("reset");
  }

  if (gameMode === "onePlayer" && currentPlayer === PLAYER_O) {
    updateStatus("AI starts this round...", { animate: true, dotPlayer: PLAYER_O });
    triggerComputerMove();
  } else {
    const startMsg =
      gameMode === "onePlayer"
        ? "Your turn (X)"
        : `Player ${currentPlayer}'s turn`;
    updateStatus(startMsg, { animate: true, dotPlayer: currentPlayer });
  }
}

function handleCellClick(event) {
  const cell = event.currentTarget;
  const index = Number(cell.dataset.index);

  if (gameOver || isComputerThinking || board[index] !== "") {
    return;
  }

  commitMove(index);

  if (!gameOver && gameMode === "onePlayer" && currentPlayer === PLAYER_O) {
    triggerComputerMove();
  }
}

function commitMove(index) {
  const cell = cells[index];
  board[index] = currentPlayer;
  cell.dataset.mark = currentPlayer;
  cell.setAttribute("aria-label", getCellAriaLabel(index, currentPlayer));
  cell.appendChild(createMarkSVG(currentPlayer));

  playSound(currentPlayer === PLAYER_X ? "moveX" : "moveO");

  const winInfo = findWinningLine(board, currentPlayer);
  if (winInfo) {
    gameOver = true;
    boardEl.dataset.hasWinner = "true";
    syncBoardAttributes();

    winInfo.indices.forEach((i) => cells[i].classList.add("highlight"));
    drawWinLine(winInfo, currentPlayer);

    scores[currentPlayer] += 1;
    saveState();
    updateScoreboardUI(currentPlayer);

    const winLabel =
      gameMode === "onePlayer"
        ? currentPlayer === PLAYER_X
          ? "You win! 🎉"
          : "AI wins this round!"
        : `Player ${currentPlayer} wins! 🎉`;

    updateStatus(winLabel, {
      animate: true,
      state: currentPlayer === PLAYER_X ? "win-x" : "win-o",
      dotPlayer: currentPlayer,
    });

    playSound("win");
    if (gameMode === "twoPlayer" || currentPlayer === PLAYER_X) {
      launchConfetti(currentPlayer);
    }
    return;
  }

  if (isDraw(board)) {
    gameOver = true;
    syncBoardAttributes();
    scores.ties += 1;
    saveState();
    updateScoreboardUI("ties");
    updateStatus("It's a Cat's game! (Draw)", {
      animate: true,
      state: "draw",
      dotPlayer: "none",
    });
    playSound("draw");
    return;
  }

  currentPlayer = currentPlayer === PLAYER_X ? PLAYER_O : PLAYER_X;
  syncBoardAttributes();
  updateScoreboardUI();

  if (gameMode === "onePlayer") {
    updateStatus(
      currentPlayer === PLAYER_X ? "Your turn (X)" : "AI is thinking...",
      { dotPlayer: currentPlayer }
    );
  } else {
    updateStatus(`Player ${currentPlayer}'s turn`, { dotPlayer: currentPlayer });
  }
}

function triggerComputerMove() {
  isComputerThinking = true;
  const delay = 380;

  computerTimeoutId = setTimeout(() => {
    computerTimeoutId = null;
    if (gameOver) {
      isComputerThinking = false;
      return;
    }

    const strength = DIFFICULTY_STRENGTH[difficulty] ?? 0.8;
    const chosenIndex =
      Math.random() < strength ? findBestMoveIndex(board) : findRandomMoveIndex(board);

    isComputerThinking = false;
    if (chosenIndex !== -1) {
      commitMove(chosenIndex);
    }
  }, delay);
}

// Win / Draw / Minimax Engine
function findWinningLine(b, player) {
  for (const line of WIN_LINES) {
    const [i, j, k] = line.indices;
    if (b[i] === player && b[j] === player && b[k] === player) {
      return line;
    }
  }
  return null;
}

function isDraw(b) {
  return b.every((cell) => cell !== "");
}

function evaluateBoard(b) {
  if (findWinningLine(b, PLAYER_X)) return 10;
  if (findWinningLine(b, PLAYER_O)) return -10;
  return 0;
}

function minimax(b, depth, isMax, alpha = -Infinity, beta = Infinity) {
  const score = evaluateBoard(b);
  if (score === 10) return score - depth;
  if (score === -10) return score + depth;
  if (isDraw(b)) return 0;

  if (isMax) {
    let best = -1000;
    for (let i = 0; i < 9; i++) {
      if (b[i] === "") {
        b[i] = PLAYER_X;
        best = Math.max(best, minimax(b, depth + 1, false, alpha, beta));
        b[i] = "";
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = 1000;
    for (let i = 0; i < 9; i++) {
      if (b[i] === "") {
        b[i] = PLAYER_O;
        best = Math.min(best, minimax(b, depth + 1, true, alpha, beta));
        b[i] = "";
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

function findRandomMoveIndex(b) {
  const available = [];
  for (let i = 0; i < 9; i++) {
    if (b[i] === "") available.push(i);
  }
  if (available.length === 0) return -1;
  return available[Math.floor(Math.random() * available.length)];
}

function findBestMoves(b) {
  let bestVal = 1000;
  let bestMoves = [];

  for (let i = 0; i < 9; i++) {
    if (b[i] === "") {
      b[i] = PLAYER_O;
      const moveVal = minimax(b, 0, true);
      b[i] = "";

      if (moveVal < bestVal) {
        bestVal = moveVal;
        bestMoves = [i];
      } else if (moveVal === bestVal) {
        bestMoves.push(i);
      }
    }
  }

  return bestMoves;
}

function findBestMoveIndex(b) {
  const bestMoves = findBestMoves(b);
  if (bestMoves.length === 0) return -1;
  // Randomly pick among equally optimal moves so games feel varied
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// Keyboard Grid Navigation (Arrow keys)
function handleBoardKeyDown(event) {
  const active = document.activeElement;
  if (!active || !active.classList.contains("cell")) return;

  const idx = Number(active.dataset.index);
  let row = Math.floor(idx / 3);
  let col = idx % 3;

  switch (event.key) {
    case "ArrowUp":
      row = (row + 2) % 3;
      break;
    case "ArrowDown":
      row = (row + 1) % 3;
      break;
    case "ArrowLeft":
      col = (col + 2) % 3;
      break;
    case "ArrowRight":
      col = (col + 1) % 3;
      break;
    default:
      return;
  }

  event.preventDefault();
  cells[row * 3 + col].focus();
}

// Celebratory Confetti Effect
let confettiParticles = [];
let confettiAnimId = null;

function launchConfetti(winner) {
  if (!confettiCanvas || !confettiCtx) return;
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const palette =
    winner === PLAYER_X
      ? ["#38bdf8", "#0284c7", "#34d399", "#f8fafc", "#a855f7"]
      : ["#fbbf24", "#f97316", "#34d399", "#f8fafc", "#38bdf8"];

  confettiParticles = Array.from({ length: 55 }, () => ({
    x: confettiCanvas.width * (0.25 + Math.random() * 0.5),
    y: confettiCanvas.height * 0.45,
    vx: (Math.random() - 0.5) * 11,
    vy: -Math.random() * 11 - 4,
    size: 6 + Math.random() * 6,
    color: palette[Math.floor(Math.random() * palette.length)],
    rotation: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 0.25,
    alpha: 1,
  }));

  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  animateConfetti();
}

function animateConfetti() {
  if (!confettiCanvas || !confettiCtx) return;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  confettiParticles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.34; // gravity
    p.vx *= 0.985;
    p.rotation += p.vRot;
    p.alpha -= 0.014;

    if (p.alpha > 0) {
      confettiCtx.save();
      confettiCtx.globalAlpha = Math.max(0, p.alpha);
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rotation);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
      confettiCtx.restore();
    }
  });

  confettiParticles = confettiParticles.filter((p) => p.alpha > 0);
  if (confettiParticles.length > 0) {
    confettiAnimId = requestAnimationFrame(animateConfetti);
  } else {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiAnimId = null;
  }
}

function getGameState() {
  return {
    board: [...board],
    currentPlayer,
    startingPlayer,
    gameOver,
    isComputerThinking,
    gameMode,
    difficulty,
    soundEnabled,
    scores: { ...scores },
  };
}

function syncThemeColor() {
  if (!themeColorMeta || !themeCheckbox) return;
  themeColorMeta.setAttribute(
    "content",
    themeCheckbox.checked ? "#eef5fc" : "#091326"
  );
}

function syncModeControls() {
  if (!difficultyFieldset) return;
  difficultyFieldset.disabled = gameMode === "twoPlayer";
}

// Initialization & Event Listeners
function initializeApp() {
  if (computerTimeoutId) {
    clearTimeout(computerTimeoutId);
    computerTimeoutId = null;
  }
  board = Array(9).fill("");
  currentPlayer = PLAYER_X;
  startingPlayer = PLAYER_X;
  gameOver = false;
  isComputerThinking = false;
  gameMode = "onePlayer";
  difficulty = "medium";
  soundEnabled = true;
  scores = { X: 0, O: 0, ties: 0 };

  bindDomElements();
  if (!boardEl) return;

  loadSavedState();
  syncThemeColor();
  syncModeControls();

  soundToggleBtn.setAttribute("aria-pressed", String(soundEnabled));

  soundToggleBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundToggleBtn.setAttribute("aria-pressed", String(soundEnabled));
    saveState();
    if (soundEnabled) playSound("reset");
  });

  themeCheckbox.addEventListener("change", () => {
    syncThemeColor();
    saveState();
    playSound("reset");
  });

  document.querySelectorAll('input[name="gameMode"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      gameMode = e.target.value;
      scores = { X: 0, O: 0, ties: 0 };
      syncModeControls();
      saveState();
      startNewRound({ alternateStarter: false, playResetSound: true });
    });
  });

  document.querySelectorAll('input[name="difficulty"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      difficulty = e.target.value;
      saveState();
      playSound("reset");
    });
  });

  newGameButton.addEventListener("click", () => {
    startNewRound({ alternateStarter: true, playResetSound: true });
  });

  resetScoresButton.addEventListener("click", () => {
    scores = { X: 0, O: 0, ties: 0 };
    saveState();
    updateScoreboardUI();
    startNewRound({ alternateStarter: false, playResetSound: true });
  });

  cells.forEach((cell) => {
    cell.addEventListener("click", handleCellClick);
  });

  boardEl.addEventListener("keydown", handleBoardKeyDown);

  window.addEventListener("resize", () => {
    if (gameOver && boardEl.dataset.hasWinner === "true") {
      const winner = winLineSvg.dataset.winner;
      const winInfo = findWinningLine(board, winner);
      if (winInfo) drawWinLine(winInfo, winner);
    }
  });

  startNewRound({ alternateStarter: false, playResetSound: false });
}

if (typeof document !== "undefined") {
  initializeApp();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
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
    findBestMoves,
    findBestMoveIndex,
    getCellAriaLabel,
    initializeApp,
    startNewRound,
    commitMove,
    handleCellClick,
    handleBoardKeyDown,
    getGameState,
  };
}

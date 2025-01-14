class Move {
  constructor() {
    this.row = -1;
    this.col = -1;
  }
}

const PLAYER_X = "X";
const PLAYER_O = "O";
let currentPlayer = PLAYER_X;
const defaultBoard = [
  ["", "", ""],
  ["", "", ""],
  ["", "", ""],
];

let board = defaultBoard.map((row) => [...row]);
let gameOver = false;
let gameMode = selectedGameMode();
const cells = document.querySelectorAll(".cell");
const newGameButton = document.getElementById("new-game-button");
const strengthOfComputer = 0.8;

function initializeGame() {
  initializeGameModeButtons();
  enableGameModeSelection();
  newGameButton.addEventListener("click", newGame);
  cells.forEach((cell) => {
    cell.addEventListener("click", handleCellClick);
    cell.classList.remove("highlight");
    cell.innerText = "";
  });
  updateStatus(`Player ${currentPlayer} starts!`, true);
}

function updateStatus(message, animate) {
  const status = document.getElementById("status");
  if (animate) status.classList.add("scale-up");
  status.innerText = message;
  if (animate)
    setTimeout(() => {
      status.classList.remove("scale-up");
    }, 1000); // Scale lasts for 1 second
}

function newGame() {
  currentPlayer = PLAYER_X;
  board = defaultBoard.map((row) => [...row]);
  gameOver = false;
  initializeGame();
}

function handleCellClick(event) {
  const clickedCell = event.target;
  if (!isCellAvailable(clickedCell) || gameOver) return;
  disableGameModeSelection();
  updateBoard(board, clickedCell);
  if (gameMode === "onePlayer") {
    if (currentPlayer === PLAYER_O && !gameOver) computerMove();
  }
}

function initializeGameModeButtons() {
  const gameModeButtons = document.querySelectorAll('input[name="gameMode"]');

  gameModeButtons.forEach((button) => {
    button.addEventListener("change", () => {
      gameMode = selectedGameMode();
    });
  });
}

function disableGameModeSelection() {
  const gameModeButtons = document.querySelectorAll('input[name="gameMode"]');
  gameModeButtons.forEach((button) => {
    button.disabled = true;
  });
}

function enableGameModeSelection() {
  const gameModeButtons = document.querySelectorAll('input[name="gameMode"]');
  gameModeButtons.forEach((button) => {
    button.disabled = false;
  });
}

function selectedGameMode() {
  const selectedMode = document.querySelector('input[name="gameMode"]:checked');
  const message =
    selectedMode.value === "onePlayer"
      ? "One Player Game Mode"
      : "Two Player Game Mode";
  updateStatus(message);
  return selectedMode ? selectedMode.value : null;
}

function computerMove() {
  updateStatus("Good luck!");
  setTimeout(() => {
    let computerMove;
    if (Math.random() < strengthOfComputer) {
      computerMove = findBestMove(board);
    } else {
      computerMove = findRandomMove(board);
    }
    let index = computerMove.row * 3 + computerMove.col;
    const cell = cells[index];
    updateBoard(board, cell);
    cell.classList.add("bounce");
    setTimeout(() => {
      cell.classList.remove("bounce");
    }, 500);
  }, 500);
}

function isCellAvailable(cell) {
  return cell.innerText === "";
}

function nextPlayer(player) {
  return player === PLAYER_X ? PLAYER_O : PLAYER_X;
}

function row(cell) {
  return Math.floor(cell.dataset.index / 3);
}

function col(cell) {
  return cell.dataset.index - row(cell) * 3;
}

function updateBoard(board, cell) {
  const r = row(cell);
  const c = col(cell);
  board[r][c] = currentPlayer;
  cell.innerText = currentPlayer;
  if (isWin(board, currentPlayer)) {
    gameOver = true;
    updateStatus(`${currentPlayer} wins!`, true);
    return;
  }
  if (isDraw(board)) {
    gameOver = true;
    updateStatus("It's a CAT game!", true);
    return;
  }
  currentPlayer = nextPlayer(currentPlayer);
  if (gameMode !== "onePlayer") {
    updateStatus(`Player ${currentPlayer} turn`);
  }
}

function isDraw(board) {
  return board.flat().every((cell) => cell !== "");
}

function isWin(board, player) {
  for (let row = 0; row < 3; row++) {
    if (
      board[row][0] === player &&
      board[row][1] === player &&
      board[row][2] === player
    ) {
      showWinningCells("row", row);
      return true;
    }
  }
  for (let col = 0; col < 3; col++) {
    if (
      board[0][col] === player &&
      board[1][col] === player &&
      board[2][col] === player
    ) {
      showWinningCells("col", col);
      return true;
    }
  }
  if (
    board[0][0] === player &&
    board[1][1] === player &&
    board[2][2] === player
  ) {
    showWinningCells("dia", 0);
    return true;
  }

  if (
    board[0][2] === player &&
    board[1][1] === player &&
    board[2][0] === player
  ) {
    showWinningCells("dia", 1);
    return true;
  }
  return false;
}

function showWinningCells(direction, index) {
  let cellsToHighlight;
  if (direction === "row") {
    cellsToHighlight = rowToCells(index);
  }
  if (direction === "col") {
    cellsToHighlight = colToCells(index);
  }
  if (direction === "dia") {
    cellsToHighlight = diaToCells(index);
  }
  cells.forEach((cell) => {
    if (cellsToHighlight.includes(parseInt(cell.dataset.index))) {
      cell.classList.add("highlight");
    }
  });
}

function rowToCells(row) {
  const offset = row * 3;
  const cells = [offset, offset + 1, offset + 2];
  return cells;
}

function colToCells(col) {
  const cells = [col, col + 3, col + 6];
  return cells;
}

function diaToCells(dia) {
  if (dia === 0) {
    const cells = [0, 4, 8];
    return cells;
  }
  if (dia === 1) {
    const cells = [2, 4, 6];
    return cells;
  }
}

function evaluate(board) {
  for (let row = 0; row < 3; row++) {
    if (board[row][0] === board[row][1] && board[row][1] === board[row][2]) {
      if (board[row][0] === PLAYER_X) {
        return +10;
      } else if (board[row][0] === PLAYER_O) {
        return -10;
      }
    }
  }
  for (let col = 0; col < 3; col++) {
    if (board[0][col] === board[1][col] && board[1][col] === board[2][col]) {
      if (board[0][col] === PLAYER_X) {
        return +10;
      } else if (board[0][col] === PLAYER_O) {
        return -10;
      }
    }
  }
  if (board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
    if (board[0][0] === PLAYER_X) {
      return +10;
    } else if (board[0][0] === PLAYER_O) {
      return -10;
    }
  }
  if (board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
    if (board[0][2] === PLAYER_X) {
      return +10;
    } else if (board[0][2] === PLAYER_O) {
      return -10;
    }
  }
  return 0;
}

function minimax(board, depth, isMax) {
  let score = evaluate(board);
  if (score === 10) {
    return score - depth;
  }
  if (score === -10) {
    return score + depth;
  }
  if (isDraw(board)) {
    return 0;
  }
  if (isMax) {
    let best = -1000;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (board[row][col] === "") {
          board[row][col] = PLAYER_X;
          best = Math.max(best, minimax(board, depth + 1, false));
          board[row][col] = "";
        }
      }
    }
    return best;
  } else {
    let best = +1000;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (board[row][col] === "") {
          board[row][col] = PLAYER_O;
          best = Math.min(best, minimax(board, depth + 1, true));
          board[row][col] = "";
        }
      }
    }
    return best;
  }
}

function findRandomMove(board) {
  let randomMove = new Move();
  const availableCells = Array.from(cells).filter(
    (cell) => cell.innerText === ""
  );
  const index =
    availableCells[Math.floor(Math.random() * availableCells.length)].dataset
      .index;
  const row = Math.floor(index / 3);
  const col = index - row * 3;
  randomMove.row = row;
  randomMove.col = col;
  return randomMove;
}

function findBestMove(board) {
  let bestVal = 1000;
  let bestMove = new Move();
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (board[row][col] === "") {
        board[row][col] = PLAYER_O;
        let moveVal = minimax(board, 0, true);
        board[row][col] = "";
        if (moveVal < bestVal) {
          bestMove.row = row;
          bestMove.col = col;
          bestVal = moveVal;
        }
      }
    }
  }
  return bestMove;
}

initializeGame();

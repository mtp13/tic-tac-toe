let currentPlayer = "X";
let board = [
  ["-", "-", "-"],
  ["-", "-", "-"],
  ["-", "-", "-"],
];

function initializeGame() {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    cell.addEventListener("click", handleCellClick);
    cell.classList.remove("highlight");
  });
}

function removeListeners() {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    cell.removeEventListener("click", handleCellClick);
  });
}

function handleCellClick() {
  const clickedCell = this;
  if (isPlayed(clickedCell)) return;
  updateBoard(clickedCell);
}
function isPlayed(cell) {
  if (cell.innerText === "X" || cell.innerText === "O") {
    return true;
  } else {
    return false;
  }
}

function nextPlayer(player) {
  return player === "X" ? "O" : "X";
}

function row(cell) {
  return Math.floor(cell.dataset.index / 3);
}

function col(cell) {
  return cell.dataset.index - row(cell) * 3;
}

function updateBoard(cell) {
  const r = row(cell);
  const c = col(cell);
  board[r][c] = currentPlayer;
  cell.innerText = currentPlayer;
  if (checkWin(currentPlayer)) {
    document.getElementById(
      "status"
    ).innerText = `${currentPlayer} is the WINNER!`;
  } else {
    if (checkForDraw(board)) {
      removeListeners();
    }
  }
  currentPlayer = nextPlayer(currentPlayer);
}

function checkForDraw(board) {
  if (board.every((row) => row.every((cell) => cell !== "-"))) {
    document.getElementById("status").innerText = "Tie game!";
    return true;
  }
  return false;
}

function checkWin(player) {
  for (let row = 0; row < 3; row++) {
    if (
      board[row][0] === player &&
      board[row][1] === player &&
      board[row][2] === player
    ) {
      showWinningCells("row", row);
      removeListeners();
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
      removeListeners();
      return true;
    }
  }
  if (
    board[0][0] === player &&
    board[1][1] === player &&
    board[2][2] === player
  ) {
    showWinningCells("dia", 0);
    removeListeners();
    return true;
  }

  if (
    board[0][2] === player &&
    board[1][1] === player &&
    board[2][0] === player
  ) {
    showWinningCells("dia", 1);
    removeListeners();
    return true;
  }
  return false;
}

function showWinningCells(direction, index) {
  const cells = document.querySelectorAll(".cell");
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
    cells = [0, 4, 8];
    return cells;
  }
  if (dia === 1) {
    cells = [2, 4, 6];
    return cells;
  }
}

initializeGame();

let currentPlayer = "X";
let board = [
  ["", "", ""],
  ["", "", ""],
  ["", "", ""],
];
let gameOver = false;
let isPlaying = true;
const cells = document.querySelectorAll(".cell");
const status = document.getElementById("status");
const newGameButton = document.getElementById("new-game-button");

function initializeGame() {
  newGameButton.addEventListener("click", newGame);
  cells.forEach((cell) => {
    cell.addEventListener("click", handleCellClick);
    cell.classList.remove("highlight");
    cell.innerText = "";
  });
  status.innerText = `Player ${currentPlayer} starts!`;
}

function newGame() {
  currentPlayer = "X";
  board = [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ];
  gameOver = false;
  initializeGame();
}

function handleCellClick(event) {
  const clickedCell = event.target;
  if (!isCellAvailable(clickedCell) || gameOver) return;
  updateBoard(clickedCell);
  if (currentPlayer === "O" && !gameOver) computerMove();
}

function computerMove() {
  const availableCells = Array.from(cells).filter(
    (cell) => cell.innerText === ""
  );
  const randomCell =
    availableCells[Math.floor(Math.random() * availableCells.length)];
  updateBoard(randomCell);
}

function isCellAvailable(cell) {
  return cell.innerText === "";
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
    gameOver = true;
    status.innerText = `${currentPlayer} wins!`;
    return;
  }
  if (checkForDraw(board)) {
    gameOver = true;
    return;
  }
  currentPlayer = nextPlayer(currentPlayer);
  status.innerText = `Player ${currentPlayer} turn`;
}

function checkForDraw(board) {
  if (board.every((row) => row.every((cell) => cell !== ""))) {
    status.innerText = "It's a CAT game!";
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
      if (isPlaying) showWinningCells("row", row);
      return true;
    }
  }
  for (let col = 0; col < 3; col++) {
    if (
      board[0][col] === player &&
      board[1][col] === player &&
      board[2][col] === player
    ) {
      if (isPlaying) showWinningCells("col", col);
      return true;
    }
  }
  if (
    board[0][0] === player &&
    board[1][1] === player &&
    board[2][2] === player
  ) {
    if (isPlaying) showWinningCells("dia", 0);
    return true;
  }

  if (
    board[0][2] === player &&
    board[1][1] === player &&
    board[2][0] === player
  ) {
    if (isPlaying) showWinningCells("dia", 1);
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

initializeGame();

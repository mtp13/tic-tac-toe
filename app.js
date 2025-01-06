// @ts-nocheck
let currentPlayer = "X";
let board = [
  ["-", "-", "-"],
  ["-", "-", "-"],
  ["-", "-", "-"],
];

function initializeGame() {
  const cells = document.querySelectorAll(".cell");
  console.log(cells);
  cells.forEach((cell) => {
    cell.addEventListener("click", handleCellClick);
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
  // printBoard(board);
  cell.innerText = currentPlayer;
  if (checkWin(currentPlayer))
    document.getElementById(
      "status"
    ).innerText = `${currentPlayer} is the WINNER!`;
  currentPlayer = nextPlayer(currentPlayer);
}

function checkWin(player) {
  for (let row = 0; row < 3; row++) {
    if (
      board[row][0] === player &&
      board[row][1] === player &&
      board[row][2] === player
    )
      return true;
  }
  for (let col = 0; col < 3; col++) {
    if (
      board[0][col] === player &&
      board[1][col] === player &&
      board[2][col] === player
    )
      return true;
  }
  if (
    board[0][0] === player &&
    board[1][1] === player &&
    board[2][2] === player
  )
    return true;

  if (
    board[0][2] === player &&
    board[1][1] === player &&
    board[2][0] === player
  )
    return true;
  return false;
}

function printBoard(board) {
  for (let row = 0; row < 3; row++) {
    let line = "";
    for (let col = 0; col < 3; col++) {
      line += board[row][col] + " ";
    }
    console.log(line);
  }
  console.log("\n");
}

initializeGame();

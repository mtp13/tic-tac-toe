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
  board[row(cell)][col(cell)] = currentPlayer;
  printBoard(board);
  cell.innerText = currentPlayer;
  currentPlayer = nextPlayer(currentPlayer);
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

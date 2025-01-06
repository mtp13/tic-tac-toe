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
    cell.innerText = cell.dataset.index;
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
  if (direction === "row") {
    const cellsToHighlight = rowToCells(index);
    console.log(cellsToHighlight[0], cellsToHighlight[1], cellsToHighlight[2]);
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
      if (cellsToHighlight.includes(parseInt(cell.dataset.index))) {
        cell.classList.add("highlight");
      }
    });
  }
  if (direction === "col") {
    const cellsToHighlight = colToCells(index);
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
      if (cellsToHighlight.includes(parseInt(cell.dataset.index))) {
        cell.classList.add("highlight");
      }
    });
  }
  if (direction === "dia") {
    const cellsToHighlight = diaToCells(index);
    const cells = document.querySelectorAll(".cell");
    cells.forEach((cell) => {
      if (cellsToHighlight.includes(parseInt(cell.dataset.index))) {
        cell.classList.add("highlight");
      }
    });
  }
}

function rowToCells(row) {
  const offset = row * 3;
  const cells = [offset, offset + 1, offset + 2];
  console.log(cells);
  return cells;
}

function colToCells(col) {
  const cells = [col, col + 3, col + 6];
  console.log(cells);
  return cells;
}

function diaToCells(dia) {
  if (dia === 0) {
    cells = [0, 4, 8];
    console.log(cells);
    return cells;
  }
  if (dia === 1) {
    cells = [2, 4, 6];
    console.log(cells);
    return cells;
  }
}

initializeGame();

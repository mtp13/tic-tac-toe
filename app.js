// @ts-nocheck
function initializeGame() {
  const cells = document.querySelectorAll(".cell");
  console.log(cells);
  cells.forEach((cell) => {
    cell.addEventListener("click", handleCellClick);
  });
}

function handleCellClick() {
  this.innerText = currentPlayer;
  currentPlayer = currentPlayer === "X" ? "O" : "X";
}

initializeGame();
let currentPlayer = "X";

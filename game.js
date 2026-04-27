const screens = {
  start: document.querySelector('[data-screen="start"]'),
  instructions: document.querySelector('[data-screen="instructions"]'),
  game: document.querySelector('[data-screen="game"]'),
  win: document.querySelector('[data-screen="win"]'),
  lose: document.querySelector('[data-screen="lose"]'),
};

const mazeEl = document.getElementById("maze");
const bubbleLayer = document.getElementById("bubbleLayer");
const scoreEl = document.getElementById("score");
const tearsEl = document.getElementById("tears");
const livesEl = document.getElementById("lives");
const statusText = document.getElementById("statusText");
const muteButton = document.getElementById("muteButton");
const themeMusic = document.getElementById("themeMusic");
const winScore = document.getElementById("winScore");
const loseScore = document.getElementById("loseScore");

const mazeMap = [
  "#############",
  "#P..T..#..N.#",
  "#.###.#.#.#.#",
  "#...#.#...#.#",
  "###.#.###.#T#",
  "#T..#.....#.#",
  "#.#####.###.#",
  "#...N.#...T.#",
  "#.###.#.###.#",
  "#.#...#...#.#",
  "#.#.#####.#.#",
  "#T....S..M..#",
  "#############",
];

const enemyNames = ["The Liar", "The Thief", "The Trouble Kid", "The Heartbreaker", "The Vanisher"];
const enemyStarts = [
  { x: 11, y: 1 },
  { x: 1, y: 11 },
  { x: 11, y: 7 },
  { x: 5, y: 5 },
  { x: 9, y: 11 },
];
const powerUps = [
  { type: "shower", x: 7, y: 11, label: "Shower Power" },
  { type: "cry", x: 3, y: 7, label: "Cry Burst" },
  { type: "maximo", x: 9, y: 3, label: "Maximo Mode" },
  { type: "shield", x: 11, y: 5, label: "Loofah Shield" },
];

const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let cells = [];
let player = { x: 1, y: 1 };
let enemies = [];
let tears = new Set();
let notes = new Set();
let activePowers = new Map();
let score = 0;
let lives = 3;
let totalTears = 0;
let gameLoop = 0;
let enemyLoop = 0;
let freezeTimer = 0;
let invincibleTimer = 0;
let shielded = false;
let invincible = false;
let frozen = false;
let playing = false;
let muted = false;

document.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  if (action === "instructions") showScreen("instructions");
  if (action === "play") startGame();
});

document.addEventListener("keydown", (event) => {
  const keyMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  const direction = keyMap[event.key];
  if (!direction || !playing) return;
  event.preventDefault();
  movePlayer(direction);
});

document.querySelectorAll("[data-move]").forEach((button) => {
  button.addEventListener("pointerdown", () => movePlayer(button.dataset.move));
});

muteButton.addEventListener("click", () => {
  muted = !muted;
  themeMusic.muted = muted;
  muteButton.textContent = muted ? "Music Off" : "Music On";
});

themeMusic.addEventListener("error", () => {
  muteButton.textContent = "No Music";
});

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

function startGame() {
  stopTimers();
  score = 0;
  lives = 3;
  shielded = false;
  invincible = false;
  frozen = false;
  playing = true;
  player = { x: 1, y: 1 };
  enemies = enemyStarts.map((position, index) => ({ ...position, start: { ...position }, name: enemyNames[index] }));
  tears = new Set();
  notes = new Set();
  activePowers = new Map(powerUps.map((power) => [`${power.x},${power.y}`, power]));

  mazeMap.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "T") tears.add(`${x},${y}`);
      if (cell === "N") notes.add(`${x},${y}`);
    });
  });
  totalTears = tears.size;

  updateHud();
  statusText.textContent = "Find the tears";
  showScreen("game");
  playTheme();
  renderMaze();
  enemyLoop = setInterval(moveEnemies, 620);
  gameLoop = setInterval(checkEnemyCollisions, 120);
}

function stopTimers() {
  clearInterval(gameLoop);
  clearInterval(enemyLoop);
  clearTimeout(freezeTimer);
  clearTimeout(invincibleTimer);
}

function endGame(result) {
  playing = false;
  stopTimers();
  themeMusic.pause();
  bubbleLayer.innerHTML = "";
  if (result === "win") {
    winScore.textContent = score;
    showScreen("win");
  } else {
    loseScore.textContent = score;
    showScreen("lose");
  }
}

function playTheme() {
  themeMusic.currentTime = 0;
  themeMusic.muted = muted;
  themeMusic.play().catch(() => {
    statusText.textContent = "Music optional";
  });
}

function renderMaze() {
  mazeEl.classList.toggle("invincible", invincible);
  mazeEl.classList.toggle("shielded", shielded);
  mazeEl.classList.toggle("frozen", frozen);
  mazeEl.innerHTML = "";
  cells = [];

  mazeMap.forEach((row, y) => {
    [...row].forEach((value, x) => {
      const cell = document.createElement("div");
      cell.className = `cell ${value === "#" ? "wall" : "floor"}`;
      cell.dataset.x = x;
      cell.dataset.y = y;
      mazeEl.appendChild(cell);
      cells.push(cell);
    });
  });

  tears.forEach((key) => addEntity(key, "tear"));
  notes.forEach((key) => addEntity(key, "note"));
  activePowers.forEach((power, key) => addEntity(key, `power ${power.type}`, power.label));
  enemies.forEach((enemy) => addEntity(`${enemy.x},${enemy.y}`, "enemy", enemy.name));
  addEntity(`${player.x},${player.y}`, "player", "Reh Dogg");
}

function addEntity(key, className, label = "") {
  const [x, y] = key.split(",").map(Number);
  const cell = getCell(x, y);
  if (!cell) return;
  const entity = document.createElement("span");
  entity.className = `entity ${className}`;
  if (label) entity.dataset.name = label;
  cell.appendChild(entity);
}

function getCell(x, y) {
  return cells.find((cell) => Number(cell.dataset.x) === x && Number(cell.dataset.y) === y);
}

function movePlayer(directionName) {
  const direction = directions[directionName];
  const next = { x: player.x + direction.x, y: player.y + direction.y };
  if (isWall(next.x, next.y)) return;
  player = next;
  collectAtPlayer();
  checkEnemyCollisions();
  renderMaze();
}

function collectAtPlayer() {
  const key = `${player.x},${player.y}`;
  if (tears.delete(key)) {
    score += 25;
    statusText.textContent = "Tear collected";
    popBubbles(player.x, player.y);
  }
  if (notes.delete(key)) {
    score += 40;
    statusText.textContent = "Music note bonus";
    popBubbles(player.x, player.y);
  }
  if (activePowers.has(key)) {
    const power = activePowers.get(key);
    activePowers.delete(key);
    activatePower(power.type);
  }
  updateHud();
  if (tears.size === 0) {
    score += 100;
    updateHud();
    endGame("win");
  }
}

function activatePower(type) {
  if (type === "shower") {
    statusText.textContent = "Shower Power";
    score += 35;
    enemies = enemies.map((enemy) => {
      const distance = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
      return distance <= 4 ? { ...enemy.start, start: enemy.start, name: enemy.name } : enemy;
    });
    popBubbles(player.x, player.y);
  }
  if (type === "cry") {
    statusText.textContent = "Cry Burst";
    frozen = true;
    clearTimeout(freezeTimer);
    freezeTimer = setTimeout(() => {
      frozen = false;
      statusText.textContent = "Run through the woods";
      renderMaze();
    }, 5000);
  }
  if (type === "maximo") {
    statusText.textContent = "Maximo Mode";
    invincible = true;
    clearTimeout(invincibleTimer);
    invincibleTimer = setTimeout(() => {
      invincible = false;
      statusText.textContent = "Invincibility faded";
      renderMaze();
    }, 7000);
  }
  if (type === "shield") {
    statusText.textContent = "Loofah Shield";
    shielded = true;
  }
  updateHud();
  renderMaze();
}

function moveEnemies() {
  if (!playing || frozen) return;
  enemies = enemies.map((enemy) => {
    const options = Object.values(directions)
      .map((direction) => ({ x: enemy.x + direction.x, y: enemy.y + direction.y }))
      .filter((position) => !isWall(position.x, position.y));
    options.sort((a, b) => distance(a, player) - distance(b, player));
    const best = options[0] || enemy;
    if (Math.random() < 0.78) return { ...enemy, x: best.x, y: best.y };
    return { ...enemy, ...options[Math.floor(Math.random() * options.length)] };
  });
  checkEnemyCollisions();
  renderMaze();
}

function checkEnemyCollisions() {
  if (!playing) return;
  const hit = enemies.find((enemy) => enemy.x === player.x && enemy.y === player.y);
  if (!hit) return;
  if (invincible) {
    statusText.textContent = "Maximo blocks the drama";
    enemies = enemies.map((enemy) =>
      enemy === hit ? { ...enemy.start, start: enemy.start, name: enemy.name } : enemy
    );
    renderMaze();
    return;
  }
  if (shielded) {
    shielded = false;
    statusText.textContent = "Loofah Shield saved you";
    enemies = enemies.map((enemy) =>
      enemy === hit ? { ...enemy.start, start: enemy.start, name: enemy.name } : enemy
    );
    renderMaze();
    return;
  }
  lives -= 1;
  statusText.textContent = `${hit.name} caught you`;
  player = { x: 1, y: 1 };
  enemies = enemies.map((enemy) => ({ ...enemy.start, start: enemy.start, name: enemy.name }));
  updateHud();
  popBubbles(player.x, player.y);
  if (lives <= 0) endGame("lose");
  else renderMaze();
}

function isWall(x, y) {
  return mazeMap[y]?.[x] === "#";
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function updateHud() {
  scoreEl.textContent = score;
  tearsEl.textContent = `${totalTears - tears.size}/${totalTears}`;
  livesEl.textContent = lives;
}

function popBubbles(gridX, gridY) {
  const wrap = bubbleLayer.getBoundingClientRect();
  const size = wrap.width / 13;
  for (let i = 0; i < 5; i += 1) {
    const bubble = document.createElement("span");
    bubble.className = "bubble";
    bubble.style.left = `${gridX * size + size / 2 + random(-18, 18)}px`;
    bubble.style.top = `${gridY * size + size / 2 + random(-18, 18)}px`;
    bubbleLayer.appendChild(bubble);
    setTimeout(() => bubble.remove(), 560);
  }
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

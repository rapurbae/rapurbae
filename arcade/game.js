const SHAPES = [
  [[1, 1, 1, 1]],
  [[2, 2], [2, 2]],
  [[0, 3, 0], [3, 3, 3]],
  [[0, 4, 4], [4, 4, 0]],
  [[5, 5, 0], [0, 5, 5]],
  [[6, 0, 0], [6, 6, 6]],
  [[0, 0, 7], [7, 7, 7]],
];
const BEST_KEY = 'rapurbae-tetris-best';

function nextPiece(game) {
  if (!game.bag.length) {
    game.bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = game.bag.length - 1; i > 0; i--) {
      const j = Math.floor(game.random() * (i + 1));
      [game.bag[i], game.bag[j]] = [game.bag[j], game.bag[i]];
    }
  }
  const index = game.bag.pop();
  const matrix = SHAPES[index].map(row => [...row]);
  return { type: index + 1, matrix, x: Math.floor((10 - matrix[0].length) / 2), y: 0 };
}

export function createGame(random = Math.random) {
  const game = {
    board: Array.from({ length: 20 }, () => Array(10).fill(0)),
    piece: null, next: null, bag: [], random,
    score: 0, lines: 0, level: 1, paused: false, over: false,
  };
  game.piece = nextPiece(game);
  game.next = nextPiece(game);
  return game;
}

export function collides(game, matrix = game.piece.matrix, x = game.piece.x, y = game.piece.y) {
  return matrix.some((row, dy) => row.some((value, dx) => value && (
    x + dx < 0 || x + dx >= 10 || y + dy < 0 || y + dy >= 20 || game.board[y + dy][x + dx]
  )));
}

export function move(game, dx) {
  if (game.paused || game.over || collides(game, game.piece.matrix, game.piece.x + dx)) return false;
  game.piece.x += dx;
  return true;
}

export function rotate(game) {
  if (game.paused || game.over) return false;
  const old = game.piece.matrix;
  const matrix = old[0].map((_, x) => old.map(row => row[x]).reverse());
  // ponytail: basic horizontal wall kicks, not official SRS; add SRS for competitive play.
  for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
    if (!collides(game, matrix, game.piece.x + offset)) {
      game.piece.matrix = matrix;
      game.piece.x += offset;
      return true;
    }
  }
  return false;
}

export function clearLines(game) {
  const remaining = game.board.filter(row => row.some(value => !value));
  const count = 20 - remaining.length;
  game.board = [...Array.from({ length: count }, () => Array(10).fill(0)), ...remaining];
  game.score += [0, 100, 300, 500, 800][count] * game.level;
  game.lines += count;
  game.level = Math.floor(game.lines / 10) + 1;
  return count;
}

function lock(game) {
  game.piece.matrix.forEach((row, dy) => row.forEach((value, dx) => {
    if (value) game.board[game.piece.y + dy][game.piece.x + dx] = value;
  }));
  clearLines(game);
  game.piece = game.next;
  game.next = nextPiece(game);
  game.over = collides(game);
}

export function drop(game, soft = false) {
  if (game.paused || game.over) return false;
  if (collides(game, game.piece.matrix, game.piece.x, game.piece.y + 1)) {
    lock(game);
    return false;
  }
  game.piece.y++;
  if (soft) game.score++;
  return true;
}

export function hardDrop(game) {
  if (game.paused || game.over) return 0;
  let distance = 0;
  while (!collides(game, game.piece.matrix, game.piece.x, game.piece.y + 1)) {
    game.piece.y++;
    distance++;
  }
  game.score += distance * 2;
  lock(game);
  return distance;
}

export function readBest(storage) {
  try {
    const value = Number(storage.getItem(BEST_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeBest(storage, score) {
  try { storage.setItem(BEST_KEY, String(score)); } catch { /* Storage is optional. */ }
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('arcade');
  const $ = selector => root.querySelector(selector);
  const board = $('#board');
  const next = $('#next');
  const cells = Array.from({ length: 200 }, () => {
    const cell = document.createElement('span');
    cell.className = 'cell';
    cell.setAttribute('aria-hidden', 'true');
    board.append(cell);
    return cell;
  });
  const nextCells = Array.from({ length: 16 }, () => {
    const cell = document.createElement('span');
    cell.className = 'cell';
    cell.setAttribute('aria-hidden', 'true');
    next.append(cell);
    return cell;
  });
  let storage;
  try { storage = window.localStorage; } catch { /* Browser may block local storage. */ }
  let best = readBest(storage);
  let game = createGame();
  let started = false;
  let lastTick = 0;

  function render() {
    const frame = game.board.map(row => [...row]);
    if (started && !game.over) {
      let ghostY = game.piece.y;
      while (!collides(game, game.piece.matrix, game.piece.x, ghostY + 1)) ghostY++;
      game.piece.matrix.forEach((row, dy) => row.forEach((value, dx) => {
        if (value) frame[ghostY + dy][game.piece.x + dx] = -value;
      }));
      game.piece.matrix.forEach((row, dy) => row.forEach((value, dx) => {
        if (value) frame[game.piece.y + dy][game.piece.x + dx] = value;
      }));
    }
    cells.forEach((cell, index) => {
      const value = frame[Math.floor(index / 10)][index % 10];
      cell.dataset.color = Math.abs(value);
      cell.classList.toggle('ghost', value < 0);
    });
    const names = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const stack = game.board.map((row, index) => row.some(Boolean)
      ? `${index + 1}: ${row.map(value => value ? names[value - 1] : '.').join(' ')}` : '').filter(Boolean);
    board.setAttribute('aria-label', `Papan 10 kolom, 20 baris. Blok ${names[game.piece.type - 1]}, kolom ${game.piece.x + 1}, baris ${game.piece.y + 1}. Bentuk: ${game.piece.matrix.map(row => row.map(value => value ? '#' : '.').join('')).join('/')}. Tumpukan: ${stack.join('; ') || 'kosong'}.`);
    next.setAttribute('aria-label', `Blok berikutnya: ${names[game.next.type - 1]}`);
    nextCells.forEach(cell => { cell.dataset.color = 0; });
    game.next.matrix.forEach((row, y) => row.forEach((value, x) => {
      nextCells[y * 4 + x].dataset.color = value;
    }));
    if (game.score > best) {
      best = game.score;
      writeBest(storage, best);
    }
    $('#score').textContent = String(game.score).padStart(6, '0');
    $('#best').textContent = String(best).padStart(6, '0');
    $('#level').textContent = String(game.level).padStart(2, '0');
    $('#lines').textContent = String(game.lines).padStart(2, '0');
    const status = !started ? 'Siap bermain' : game.over ? 'Game over' : game.paused ? 'Dijeda' : 'Sedang bermain';
    if ($('#status').textContent !== status) $('#status').textContent = status;
    $('#overlay').hidden = started && !game.paused && !game.over;
    $('#overlay-title').textContent = !started ? 'READY, PLAYER?' : game.over ? 'GAME OVER' : 'PAUSED';
    $('#overlay-copy').textContent = !started ? 'Susun blok. Bersihkan baris. Pecahkan rekor.' : game.over ? `Skor akhir: ${game.score}. Coba lagi?` : 'Ambil napas. Bloknya menunggu.';
    $('#start').textContent = !started ? 'Mulai bermain' : game.over ? 'Main lagi' : 'Lanjutkan';
    $('#pause').disabled = !started || game.over;
    $('#pause').textContent = game.paused ? 'Lanjutkan' : 'Jeda';
    $('#pause').setAttribute('aria-pressed', String(game.paused));
    root.querySelectorAll('[data-action]').forEach(button => { button.disabled = !started || game.paused || game.over; });
  }

  function start() {
    if (!started || game.over) game = createGame();
    started = true;
    game.paused = false;
    lastTick = performance.now();
    render();
    board.focus();
  }

  function pause() {
    if (!started || game.over) return;
    game.paused = !game.paused;
    lastTick = performance.now();
    render();
    if (!game.paused) board.focus();
  }

  function action(name) {
    if (!started || game.paused || game.over) return;
    if (name === 'left') move(game, -1);
    if (name === 'right') move(game, 1);
    if (name === 'rotate') rotate(game);
    if (name === 'down') drop(game, true);
    if (name === 'drop') hardDrop(game);
    if (name === 'down' || name === 'drop') lastTick = performance.now();
    render();
  }

  $('#start').addEventListener('click', start);
  $('#pause').addEventListener('click', pause);
  $('#restart').addEventListener('click', () => {
    game = createGame();
    started = true;
    lastTick = performance.now();
    render();
    board.focus();
  });
  root.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      action(button.dataset.action);
      board.focus({ preventScroll: true });
    });
  });
  root.addEventListener('keydown', event => {
    if (event.target.closest('a') || event.target.tagName === 'BUTTON') return;
    const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', ' ': 'drop', x: 'rotate', X: 'rotate' };
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
      event.preventDefault();
      if (!event.repeat) pause();
    } else if (keys[event.key]) {
      event.preventDefault();
      if (!event.repeat || !['drop', 'rotate'].includes(keys[event.key])) action(keys[event.key]);
    } else if (event.key === 'Enter' && (!started || game.paused || game.over)) {
      event.preventDefault();
      start();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && started && !game.over && !game.paused) pause();
  });
  window.addEventListener('blur', () => {
    if (started && !game.over && !game.paused) pause();
  });
  window.setInterval(() => {
    if (!started || game.paused || game.over) return;
    const now = performance.now();
    if (now - lastTick >= Math.max(100, 850 - (game.level - 1) * 70)) {
      drop(game);
      lastTick = now;
      render();
    }
  }, 50);
  render();
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createGame, collides, rotate, move, drop, hardDrop, clearLines, readBest, writeBest } from './game.js';

const square = () => ({ type: 2, matrix: [[2, 2], [2, 2]], x: 4, y: 0 });

test('new board has independent rows and a playable piece', () => {
  const game = createGame(() => 0);
  assert.equal(game.board.length, 20);
  assert.equal(game.board[0].length, 10);
  assert.notEqual(game.board[0], game.board[1]);
  assert.equal(collides(game), false);
  assert.equal(game.score, 0);
});

test('walls, floor and occupied cells stop movement', () => {
  const game = createGame();
  game.piece = square();
  assert.equal(collides(game, game.piece.matrix, -1, 0), true);
  assert.equal(collides(game, game.piece.matrix, 9, 0), true);
  assert.equal(collides(game, game.piece.matrix, 4, 19), true);
  game.board[0][4] = 3;
  assert.equal(collides(game), true);
  game.board[0][4] = 0;
  game.piece.x = 0;
  assert.equal(move(game, -1), false);
  assert.equal(game.piece.x, 0);
});

test('rotation stays inside walls and cannot enter an occupied cell', () => {
  const game = createGame();
  game.piece = { type: 1, matrix: [[1], [1], [1], [1]], x: 9, y: 3 };
  assert.equal(rotate(game), true);
  assert.equal(game.piece.x, 6);
  assert.equal(game.piece.matrix[0].length, 4);
  game.board = game.board.map(row => row.map(() => 7));
  const before = structuredClone(game.piece);
  assert.equal(rotate(game), false);
  assert.deepEqual(game.piece, before);
});

test('clearing adjacent full lines keeps board dimensions and awards score', () => {
  const game = createGame();
  game.board[18].fill(1);
  game.board[19].fill(2);
  assert.equal(clearLines(game), 2);
  assert.equal(game.lines, 2);
  assert.equal(game.score, 300);
  assert.equal(game.board.length, 20);
  assert(game.board.every(row => row.every(value => value === 0)));
  game.lines = 9;
  game.board[19].fill(1);
  clearLines(game);
  assert.equal(game.level, 2);
});

test('hard drop locks piece, awards distance, and spawns next piece', () => {
  const game = createGame(() => 0);
  game.piece = square();
  assert.equal(hardDrop(game), 18);
  assert.equal(game.board[19][4], 2);
  assert.equal(game.score, 36);
  assert.equal(game.piece.y, 0);
  assert.equal(collides(game), false);
});

test('soft drop scores one point and spawn obstruction ends game', () => {
  const game = createGame(() => 0);
  game.piece = square();
  drop(game, true);
  assert.equal(game.score, 1);
  game.piece.y = 18;
  game.board[0].fill(7);
  game.board[1].fill(7);
  // Leave a gap: these rows must obstruct spawn rather than clear.
  game.board[0][0] = 0;
  game.board[1][0] = 0;
  drop(game);
  assert.equal(game.over, true);
});

test('paused and finished games ignore all movement commands', () => {
  for (const key of ['paused', 'over']) {
    const game = createGame();
    game[key] = true;
    const before = structuredClone({ ...game, random: null });
    move(game, 1);
    rotate(game);
    drop(game, true);
    hardDrop(game);
    assert.deepEqual({ ...game, random: null }, before);
  }
});

test('seven-bag gives all seven pieces before repeating', () => {
  const game = createGame(() => 0.3);
  const types = [];
  for (let i = 0; i < 7; i++) {
    types.push(game.piece.type);
    game.board.forEach(row => row.fill(0));
    hardDrop(game);
  }
  assert.equal(new Set(types).size, 7);
});

test('local best survives malformed or unavailable storage safely', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(readBest(storage), 0);
  writeBest(storage, 123);
  assert.equal(readBest(storage), 123);
  for (const invalid of ['NaN', '-3', 'Infinity', '1.5', '9007199254740992']) {
    storage.setItem('rapurbae-tetris-best', invalid);
    assert.equal(readBest(storage), 0);
  }
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(readBest(blocked), 0);
  assert.doesNotThrow(() => writeBest(blocked, 123));
});

test('DOM handlers wire keyboard, touch, restart and blocked storage', () => {
  const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8').replaceAll('export function', 'function');
  const element = () => ({
    children: [], dataset: {}, textContent: '', events: {}, attributes: {}, classList: { toggle() {} },
    setAttribute(key, value) { this.attributes[key] = value; }, append(child) { this.children.push(child); },
    addEventListener(name, fn) { this.events[name] = fn; }, focus() {},
  });
  const ids = ['board', 'next', 'score', 'best', 'level', 'lines', 'status', 'overlay', 'overlay-title', 'overlay-copy', 'start', 'pause', 'restart'];
  const els = Object.fromEntries(ids.map(id => [id, element()]));
  const buttons = ['left', 'right', 'rotate', 'down', 'drop'].map(action => Object.assign(element(), { dataset: { action } }));
  let boardFocusCount = 0;
  els.board.focus = () => { boardFocusCount++; };
  const root = element();
  root.querySelector = selector => els[selector.slice(1)];
  root.querySelectorAll = () => buttons;
  // Minimal DOM boundary only; execute production listeners rather than reimplementing them.
  runInNewContext(source, {
    document: { getElementById: () => root, createElement: element, addEventListener() {} },
    window: { get localStorage() { throw Error('blocked'); }, addEventListener() {}, setInterval() {} },
    performance: { now: () => 0 }, Math,
  });
  assert.equal(els.board.children.length, 200);
  els.start.events.click();
  assert.equal(els.status.textContent, 'Sedang bermain');
  assert.match(els.board.attributes['aria-label'], /Blok [IOTSZJL].*kolom.*baris.*Tumpukan/);
  assert.match(els.next.attributes['aria-label'], /Blok berikutnya: [IOTSZJL]/);
  const key = key => root.events.keydown({ key, target: { tagName: 'DIV', closest: () => null }, preventDefault() {} });
  key(' ');
  assert(Number(els.score.textContent) > 0);
  key('p');
  assert.equal(els.status.textContent, 'Dijeda');
  const score = els.score.textContent;
  key(' ');
  assert.equal(els.score.textContent, score);
  els.start.events.click();
  assert.equal(els.status.textContent, 'Sedang bermain');
  els.restart.events.click();
  assert.equal(els.score.textContent, '000000');
  els.pause.events.click();
  const pausedFocusCount = boardFocusCount;
  els.pause.events.click();
  assert.equal(els.status.textContent, 'Sedang bermain');
  assert.equal(boardFocusCount, pausedFocusCount + 1, 'resume returns focus to board for keyboard play');
  const beforeTouchFocus = boardFocusCount;
  buttons.find(button => button.dataset.action === 'drop').events.click();
  assert(Number(els.score.textContent) > 0);
  assert.equal(boardFocusCount, beforeTouchFocus + 1, 'touch control returns focus for keyboard play');
});

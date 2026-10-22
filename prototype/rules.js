/* Shared HTML preview rules. This is not the production Lua engine. */
(() => {
  'use strict';
  const isRed = p => !!p && p === p.toUpperCase();
  function initialBoard() {
    const board = Array(90).fill(null);
    'rneakaenr'.split('').forEach((p, x) => { board[x] = p; board[81 + x] = p.toUpperCase(); });
    board[19] = board[25] = 'c'; board[64] = board[70] = 'C';
    [0, 2, 4, 6, 8].forEach(x => { board[27 + x] = 'p'; board[54 + x] = 'P'; });
    return board;
  }
  function basicMove(board, from, to, custom = false) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 90 || to < 0 || to >= 90 || from === to) return false;
    const p = board[from], target = board[to];
    if (!p || (target && isRed(p) === isRed(target))) return false;
    const x = from % 9, y = Math.floor(from / 9), tx = to % 9, ty = Math.floor(to / 9);
    const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy), red = isRed(p), kind = p.toLowerCase();
    const palace = tx >= 3 && tx <= 5 && (red ? ty >= 7 && ty <= 9 : ty >= 0 && ty <= 2);
    const free = custom && red;
    if (kind === 'p') return (dx === 0 && dy === (red ? -1 : 1)) || (ax === 1 && dy === 0 && (red ? y <= 4 : y >= 5));
    if (kind === 'a') return (free || palace) && ax === 1 && ay === 1;
    if (kind === 'e') return ax === 2 && ay === 2 && (free || (red ? ty >= 5 : ty <= 4)) && !board[(y + dy / 2) * 9 + x + dx / 2];
    if (kind === 'n') return ax === 2 && ay === 1 ? !board[y * 9 + x + Math.sign(dx)] : ax === 1 && ay === 2 && !board[(y + Math.sign(dy)) * 9 + x];
    if (kind === 'k' && !(dx === 0 && target && target.toLowerCase() === 'k')) return palace && ax + ay === 1;
    if (dx && dy) return false;
    let count = 0; const stride = dx ? Math.sign(dx) : 9 * Math.sign(dy);
    for (let i = from + stride; i !== to; i += stride) if (board[i]) count++;
    return kind === 'c' ? count === (target ? 1 : 0) : count === 0;
  }
  function movesFor(board, side, custom = false) {
    const result = [];
    for (let from = 0; from < 90; from++) {
      if (!board[from] || isRed(board[from]) !== (side === 'red')) continue;
      for (let to = 0; to < 90; to++) if (basicMove(board, from, to, custom)) result.push({from, to});
    }
    return result;
  }
  function threatensKing(board, side, custom = false) {
    const king = board.indexOf(side === 'red' ? 'k' : 'K');
    return king >= 0 && board.some((p, from) => p && isRed(p) === (side === 'red') && basicMove(board, from, king, custom));
  }
  function waitingSeconds({count, tactical = 0, gap, instability}, mode) {
    if (mode === 1 || count === 0) return 0;
    if (count === 1) return 4;
    const clamp = x => Math.max(0, Math.min(1, x));
    const metrics = [[.35, clamp((count - 1) / 59)], [.25, clamp(tactical / count)]];
    if (Number.isFinite(gap)) metrics.push([.30, 1 - clamp(gap / 150)]);
    if (Number.isFinite(instability)) metrics.push([.10, clamp(instability)]);
    const c = metrics.reduce((s, [w, v]) => s + w * v, 0) / metrics.reduce((s, [w]) => s + w, 0);
    return Math.round(4 + 12 * c);
  }
  function formatStep(ms) {
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  class StepClock {
    constructor() { this.red = 0; this.black = 0; this.side = null; this.at = 0; }
    update(now) { if (now < this.at) return; if (this.side) this[this.side] += Math.max(0, now - this.at); this.at = now; }
    start(side, now) { this.update(now); this.side = side; this[side] = 0; }
    reset(now) { this.red = this.black = 0; this.side = 'red'; this.at = now; }
    stop(now) { this.update(now); this.side = null; }
    undo(black, now) { this.red = 0; this.black = black; this.side = 'red'; this.at = now; }
  }
  globalThis.FCChessPreview = Object.freeze({isRed, initialBoard, basicMove, movesFor, threatensKing, waitingSeconds, formatStep, StepClock});
})();

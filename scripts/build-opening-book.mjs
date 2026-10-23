// Offline format adapter for the bundled XQWLight book; no network or game collection.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const INITIAL_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';
export const UPSTREAM_COMMIT = '6221733f1f79b3acb44cce6f83dc6100443cb2c9';
const root = fileURLToPath(new URL('../', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
const pieceChars = 'KAENRCP';

export function loadUpstream() {
  const files = Object.fromEntries(['book.js', 'position.js', 'LICENSE'].map(name => [name, fs.readFileSync(root + 'third_party/xqwlight/' + name, 'utf8')]));
  const manifest = JSON.parse(fs.readFileSync(root + 'third_party/xqwlight/UPSTREAM.json', 'utf8'));
  assert.equal(manifest.commit, UPSTREAM_COMMIT);
  for (const [name, source] of Object.entries(files)) assert.equal(digest(source), manifest.sha256[name], 'Vendored source changed: ' + name);
  const context = vm.createContext({});
  vm.runInContext(files['position.js'] + '\n' + files['book.js'], context, { timeout: 5000 });
  assert.equal(context.BOOK_DAT.length, 12081);
  const groups = new Map();
  for (const [id, row] of context.BOOK_DAT.entries()) {
    const [signature, move, weight] = row;
    assert.ok(Number.isInteger(signature) && signature >= 0 && signature < 2 ** 31);
    assert.ok(Number.isInteger(move) && move > 0 && move < 65536);
    assert.ok(Number.isInteger(weight) && weight > 0 && weight <= 65535);
    const list = groups.get(signature) ?? [];
    list.push({ signature, move, weight, id }); groups.set(signature, list);
  }
  return { context, groups, files };
}

export function boardKey(squares, side, mirror = false) {
  const ranks = [];
  for (let r = 0; r < 10; r++) {
    let row = '', empty = 0;
    for (let f = 0; f < 9; f++) {
      const pc = squares[(r + 3) * 16 + (mirror ? 8 - f : f) + 3];
      if (!pc) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      const char = pieceChars[pc >= 16 ? pc - 16 : pc - 8];
      assert.ok(char, 'Unexpected source piece');
      row += pc >= 16 ? char.toLowerCase() : char;
    }
    if (empty) row += empty;
    ranks.push(row);
  }
  return ranks.join('/') + (side ? ' b' : ' w');
}

export function adaptBook({ maxPositions = 60000 } = {}) {
  const { context: c, groups, files } = loadUpstream();
  // Mirror locks are calculated with the *source* constants, only in this adapter.
  const squares = Array.from({ length: 90 }, (_, i) => (Math.floor(i / 9) + 3) * 16 + i % 9 + 3);
  const mirrorSquares = squares.map(sq => (sq & 240) + 14 - (sq & 15));
  const mirrorLock = p => {
    let lock = p.sdPlayer ? c.PreGen_zobristLockPlayer : 0;
    for (let i = 0; i < 90; i++) {
      const pc = p.squares[squares[i]];
      if (pc) lock ^= c.PreGen_zobristLockTable[pc >= 16 ? pc - 16 + 7 : pc - 8][mirrorSquares[i]];
    }
    return lock >>> 1;
  };
  const sourceRows = p => {
    const direct = groups.get(p.zobristLock >>> 1) ?? [];
    const mirror = groups.get(mirrorLock(p)) ?? [];
    return [...direct.map(row => ({ ...row, actualMove: row.move })), ...mirror.map(row => ({ ...row, actualMove: c.MIRROR_MOVE(row.move) }))];
  };
  const p = new c.Position(); p.fromFen(INITIAL_FEN);
  const queue = [{ fen: p.toFen(), depth: 0 }], seen = new Set([p.toFen()]);
  const positions = new Map(), signatureBoards = new Map();
  let inspectedMoves = 0, maxDepth = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    assert.ok(queue.length <= maxPositions, 'Recovery bound exceeded; review instead of silently truncating');
    const { fen, depth } = queue[cursor]; p.fromFen(fen); maxDepth = Math.max(maxDepth, depth);
    const directKey = boardKey(p.squares, p.sdPlayer), mirroredKey = boardKey(p.squares, p.sdPlayer, true);
    const mirrored = mirroredKey < directKey, key = mirrored ? mirroredKey : directKey;
    const rows = sourceRows(p), bookMoves = new Set();
    for (const row of rows) {
      if (!p.legalMove(row.actualMove) || !p.makeMove(row.actualMove)) continue;
      p.undoMakeMove(); bookMoves.add(row.actualMove);
      const keys = signatureBoards.get(row.signature) ?? new Set(); keys.add(key); signatureBoards.set(row.signature, keys);
      const mv = mirrored ? c.MIRROR_MOVE(row.actualMove) : row.actualMove;
      const index = sq => ((sq >> 4) - 3) * 9 + (sq & 15) - 3 + 1;
      const from = index(c.SRC(mv)), to = index(c.DST(mv));
      assert.ok(from >= 1 && from <= 90 && to >= 1 && to <= 90);
      const list = positions.get(key) ?? [];
      list.push({ from, to, weight: row.weight, sourceId: row.id, signature: row.signature }); positions.set(key, list);
    }
    // Follow existing book edges, including a missing reply between book nodes.
    // Also allow any legal player deviation whose resulting position exists in the source.
    for (const move of p.generateMoves(null)) {
      if (!p.makeMove(move)) continue;
      inspectedMoves++;
      if (bookMoves.has(move) || groups.has(p.zobristLock >>> 1) || groups.has(mirrorLock(p))) {
        const nextFen = p.toFen();
        if (!seen.has(nextFen)) { seen.add(nextFen); queue.push({ fen: nextFen, depth: depth + 1 }); }
      }
      p.undoMakeMove();
    }
  }
  const ambiguous = new Set([...signatureBoards].filter(([, boards]) => boards.size > 1).map(([signature]) => signature));
  const used = new Set(), entries = [];
  for (const [key, rows] of positions) {
    const moves = new Map();
    for (const row of rows) {
      if (ambiguous.has(row.signature)) continue;
      used.add(row.sourceId);
      const moveKey = row.from * 100 + row.to, existing = moves.get(moveKey);
      // A mirrored revisit is the same evidence, not another independent game.
      if (!existing || row.weight > existing.weight) moves.set(moveKey, row);
    }
    if (moves.size) entries.push({ key, moves: [...moves.values()].sort((a, b) => a.from - b.from || a.to - b.to) });
  }
  entries.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const lua = '-- Generated from XQWLight book.js; GPL-2.0-or-later. See third_party/xqwlight.\n' +
    '-- Copyright (C) 2004-2012 www.xqbase.com; Morning Yellow.\n' +
    '-- Full position keys, side included; no runtime source-hash lookup. Do not edit.\nreturn {\n' +
    entries.map(({ key, moves }) => ` [${JSON.stringify(key)}]=${JSON.stringify(moves.map(m => String(m.from).padStart(2, '0') + String(m.to).padStart(2, '0') + String(m.weight).padStart(5, '0')).join(''))},`).join('\n') + '\n}\n';
  const summary = {
    upstream: 'https://github.com/xqbase/xqwlight', commit: UPSTREAM_COMMIT, license: 'GPL-2.0-or-later',
    sources: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, { bytes: Buffer.byteLength(content), sha256: digest(content) }])),
    sourceRows: c.BOOK_DAT.length, sourceSignatures: groups.size, recoveredSourceRows: used.size,
    unrecoveredSourceRows: c.BOOK_DAT.length - used.size, ambiguousSignaturesExcluded: [...ambiguous].sort((a, b) => a - b),
    visitedPositions: seen.size, inspectedMoves, maxRecoveredPly: maxDepth, canonicalPositions: entries.length,
    candidates: entries.reduce((n, entry) => n + entry.moves.length, 0), luaBytes: Buffer.byteLength(lua), luaSHA256: digest(lua),
    notes: 'Offline recovery/format adaptation of existing data, not a newly trained or collected book. Unreachable rows are retained in the source but not enabled. Upstream text normalized to LF.',
  };
  return { lua, summary, entries };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { lua, summary } = adaptBook();
  const output = root + 'src/game/ai/book_data.lua', report = root + 'records/opening-book-conversion.json';
  if (process.argv.includes('--check')) {
    assert.equal(fs.readFileSync(output, 'utf8'), lua, 'Generated book is stale');
    assert.deepEqual(JSON.parse(fs.readFileSync(report, 'utf8')), summary, 'Conversion evidence is stale');
  } else {
    fs.mkdirSync(root + 'src/game/ai', { recursive: true });
    fs.writeFileSync(output, lua); fs.writeFileSync(report, JSON.stringify(summary, null, 2) + '\n');
  }
  console.log(JSON.stringify(summary, null, 2));
}

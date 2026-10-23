import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { adaptBook, loadUpstream } from './build-opening-book.mjs';

const adapted = adaptBook();
test('offline adaptation is reproducible and the complete source book stays vendored', () => {
  assert.equal(adapted.summary.sourceRows, 12081);
  assert.ok(adapted.summary.recoveredSourceRows > 9000);
  assert.equal(adapted.summary.recoveredSourceRows + adapted.summary.unrecoveredSourceRows, 12081);
  assert.ok(adapted.summary.ambiguousSignaturesExcluded.length > 0);
  assert.equal(fs.readFileSync('src/game/ai/book_data.lua', 'utf8'), adapted.lua);
  assert.deepEqual(JSON.parse(fs.readFileSync('records/opening-book-conversion.json')), adapted.summary);
});
test('every exported move and weight matches a source row and is legal in its full position', () => {
  const { context: c } = loadUpstream();
  const original = new Set(c.BOOK_DAT.map(([key, move, weight]) => `${key}:${move}:${weight}`));
  const excluded = new Set(adapted.summary.ambiguousSignaturesExcluded);
  const p = new c.Position();
  let checked = 0;
  for (const entry of adapted.entries) {
    // Source notation uses B for elephant; this project's full keys use E.
    p.fromFen(entry.key.replaceAll('E', 'B').replaceAll('e', 'b'));
    const direct = p.zobristLock >>> 1, mirrored = p.mirror().zobristLock >>> 1;
    for (const row of entry.moves) {
      const square = i => (Math.floor((i - 1) / 9) + 3) * 16 + (i - 1) % 9 + 3;
      const move = square(row.from) + square(row.to) * 256;
      assert.ok(!excluded.has(row.signature));
      assert.ok(original.has(`${direct}:${move}:${row.weight}`) || original.has(`${mirrored}:${c.MIRROR_MOVE(move)}:${row.weight}`), 'Move or weight lost source provenance');
      assert.ok(p.legalMove(move) && p.makeMove(move), 'Source rejects reconstructed full-position move');
      p.undoMakeMove(); checked++;
    }
  }
  assert.equal(checked, adapted.summary.candidates);
});
test('recovery refuses an exceeded resource bound instead of shipping a silent truncation', () => {
  assert.throws(() => adaptBook({ maxPositions: 1 }), /Recovery bound exceeded/);
});

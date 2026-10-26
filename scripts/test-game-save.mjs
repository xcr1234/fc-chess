import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { readGameScript } from './game-save-script.mjs';

const root = new URL('../', import.meta.url);
const saves = ['fc-chess.save.json', 'tests/fc-chess.test.save.json'];

test('tracked saves contain script references without generated Lua', () => {
  for (const file of saves) {
    const save = JSON.parse(readFileSync(new URL(file, root), 'utf8'));
    assert.equal(save.assets.scripts[0].path, 'dist/main.lua');
    assert.equal(save.assets.scripts[0].source ?? '', '', file);
  }
});

test('sync keeps saves independent of bundle contents and build dates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fc-chess-save-'));
  try {
    mkdirSync(join(dir, 'dist'));
    mkdirSync(join(dir, 'tests'));
    writeFileSync(join(dir, saves[0]), readFileSync(new URL(saves[0], root)));
    const sync = fileURLToPath(new URL('scripts/sync-game-save.mjs', root));
    writeFileSync(join(dir, 'dist/main.lua'), '-- first build\nreturn {}\n');
    execFileSync(process.execPath, [sync], { cwd: dir });
    const before = saves.map(file => readFileSync(join(dir, file), 'utf8'));
    for (const source of before) assert.equal(JSON.parse(source).assets.scripts[0].source ?? '', '');
    writeFileSync(join(dir, 'dist/main.lua'), '-- second build\nreturn {updated=true}\n');
    execFileSync(process.execPath, [sync], { cwd: dir });
    assert.deepEqual(saves.map(file => readFileSync(join(dir, file), 'utf8')), before);

    const save = JSON.parse(before[0]);
    const base = pathToFileURL(dir + '/');
    assert.equal(readGameScript(save, base), '-- second build\nreturn {updated=true}\n');
    save.assets.scripts[0].source = '-- stale embedded script';
    assert.throws(() => readGameScript(save, base), /Remove embedded Lua/);
    save.assets.scripts[0].source = '';
    save.assets.scripts[0].path = 'src/main.lua';
    assert.throws(() => readGameScript(save, base), /Unexpected game script path/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

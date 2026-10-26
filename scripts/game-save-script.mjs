import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Tracked saves contain mappings; generated Lua stays in the ignored dist/.
export function readGameScript(save, root = new URL('../', import.meta.url)) {
  assert.equal(save.assets.scripts.length, 1, 'Expected one game script mapping');
  const script = save.assets.scripts[0];
  assert.equal(script.path, 'dist/main.lua', 'Unexpected game script path');
  assert.equal(script.source ?? '', '', 'Remove embedded Lua from the tracked save');
  const source = readFileSync(new URL(script.path, root), 'utf8');
  assert.ok(source.trim(), 'Build the Lua bundle before running the simulator');
  return source;
}

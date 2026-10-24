import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { inputHarness } from './simulator-input-harness.mjs';
import { originalRenderer } from './patch-simulator-renderer.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.argv[2] || 'records/simulator-input-native.json';
const report = { runtime: 'simulator-browser-binding-to-native-worker', results: [] };
const original = process.argv.includes('--original');
report.originalBinding = original;
const client = new Client({ name: 'input-regression', version: '1.0.0' });
let handle;
async function call(name, args) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
  if (result.isError) throw new Error(JSON.stringify(result.content));
  return result.structuredContent ?? JSON.parse(result.content.find(c => c.type === 'text').text);
}
try {
  const source = await fs.readFile('dist/main.lua', 'utf8');
  report.luaSHA256 = createHash('sha256').update(source).digest('hex');
  const binding = await fs.readFile('node_modules/beyond-simulator-web/dist/public/play-renderer.js', 'utf8');
  report.bindingSHA256 = createHash('sha256').update(original ? originalRenderer(binding) : binding).digest('hex');
  const save = JSON.parse(await fs.readFile('tests/fc-chess.test.save.json', 'utf8'));
  if (save.assets.scripts[0].source !== source) throw new Error('Stale save');
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [root + 'node_modules/beyond-simulator-mcp/dist/index.js', '--workspace', root], cwd: root }));
  ({ handle } = await call('qxqy_project_open', { path: 'tests/fc-chess.test.save.json' }));
  const sizes = { 'pc-16-9': [1600, 900], 'pc-21-9': [2100, 900], 'mobile-16-9': [1280, 720],
    'mobile-19.5-9': [1560, 720], 'mobile-4-3': [1280, 960] };
  for (const [canvasId, [width, height]] of Object.entries(sizes)) {
    for (const scenario of ['jitter-select-move', 'jitter-undo', 'square-edges', 'real-drag']) {
      const h = await inputHarness({ width, height, cssWidth: 800, cssHeight: 800 * height / width, original });
      const events = [], asserts = []; let time = .05;
      const click = name => { events.push({ t: time, source: 'user', kind: 'click', payload: { name } }); time += .05; };
      const check = (name, equals) => asserts.push({ at: time - .04, kind: 'control', name, field: 'text', equals });
      let cursor = 0;
      const tap = (x, y, jitter = true) => {
        h.tap(...h.point(x, y), ...(jitter ? [2, 1] : [0, 0]));
        for (const payload of h.pointer().slice(cursor)) {
          const { light, ...point } = payload;
          events.push({ t: time, source: 'user', kind: 'pointer', payload: point }); time += .05;
        }
        cursor = h.pointer().length;
      };
      if (scenario === 'jitter-undo') {
        click('TestSetup_undo-wait'); click('Square_0_6'); click('Square_0_5'); check('MoveCount', '001手');
        tap(227.5, 93.5); check('ConfirmTitle', '要悔棋嗎？'); check('MoveCount', '001手');
        tap(92, 88); check('MoveCount', '000手'); check('TurnText', '紅方');
      } else {
        click('ModeDifficult');
        if (scenario === 'real-drag') {
          const [x, y] = h.point(56, 80);
          h.send('pointerdown', x, y); h.send('pointermove', x + 10, y);
          h.send('pointermove', x, y); h.send('pointerup', x, y);
          for (const { light, ...payload } of h.pointer()) {
            events.push({ t: time, source: 'user', kind: 'pointer', payload }); time += .05;
          }
          check('SelectedSquare', 'none'); check('MoveCount', '000手');
        } else if (scenario === 'jitter-select-move') {
          tap(56, 80); check('SelectedSquare', '0,6');
          tap(56, 96); check('MoveCount', '001手'); check('Piece_0_5', 'P');
        } else {
          // Four corners and four edge midpoints, 0.5 logical px inside the
          // complete square, including the two outermost board files.
          for (const f of [0, 2, 4, 6, 8]) {
            for (const [dx, dy] of [[-7.5,-7.5],[-7.5,7.5],[7.5,-7.5],[7.5,7.5],[-7.5,0],[7.5,0],[0,-7.5],[0,7.5]]) {
              tap(56 + 16 * f + dx, 80 + dy, false); check('SelectedSquare', `${f},6`);
              click(`Square_${f}_6`); check('SelectedSquare', 'none');
            }
          }
          tap(63.5, 80, false); tap(63.5, 96, false); check('MoveCount', '001手'); check('Piece_0_5', 'P');
        }
      }
      h.session.destroy();
      const testCase = { format: 'qxqy-autotest', version: 1, name: `${scenario}-${canvasId}`, dt: .025, events, asserts };
      await call('qxqy_studio_play', { handle, action: 'start', args: { canvasId } });
      const result = await call('qxqy_studio_play', { handle, action: 'runCase', args: { canvasId, case: testCase } });
      if (!result.results?.length) throw new Error('Empty input test');
      report.results.push({ canvasId, scenario, passed: result.passed, case: testCase, results: result.results });
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${testCase.name} (${result.results.length} assertions)`);
      if (!result.passed) process.exitCode = 1;
    }
  }
} catch (error) { report.error = error.message; console.error(error); process.exitCode = 1; }
finally {
  if (handle) await call('qxqy_studio_play', { handle, action: 'stop' }).catch(() => {});
  await client.close(); await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
}

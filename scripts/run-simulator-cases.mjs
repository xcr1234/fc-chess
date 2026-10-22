import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const client = new Client({ name: 'fc-chess-regression', version: '1.0.0' });
const report = { runtime: 'simulator', sourceSHA256: '', results: [] };
const layouts = process.argv.includes('--layouts');
let handle;
async function call(name, args) {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
  if (r.isError) throw new Error(JSON.stringify(r.content));
  return r.structuredContent ?? JSON.parse(r.content.find(c => c.type === 'text').text);
}
try {
  const source = await readFile(new URL('../dist/main.lua', import.meta.url), 'utf8');
  report.sourceSHA256 = createHash('sha256').update(source).digest('hex');
  for (const path of ['fc-chess.save.json', 'tests/fc-chess.test.save.json']) {
    const save = await read(path);
    if (save.assets.scripts[0].source !== source || save.assets.scripts[0].path !== 'dist/main.lua') throw new Error('Stale script: ' + path);
  }
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [root + 'node_modules/beyond-simulator-mcp/dist/index.js', '--workspace', root], cwd: root }));
  ({ handle } = await call('qxqy_project_open', { path: 'tests/fc-chess.test.save.json' }));
  await call('qxqy_studio_play', { handle, action: 'start', args: { canvasId: 'pc-16-9' } });
  for (const row of layouts ? [] : (await read('tests/plan.json')).cases) {
    const test = await read('tests/' + row.file);
    const result = await call('qxqy_studio_play', { handle, action: 'runCase', args: { ...row.args, case: test } });
    // A misspelled runCase argument can silently execute an empty case. Reject it.
    if (result.name !== test.name || result.results.length === 0) throw new Error('Empty/wrong case: ' + row.case);
    report.results.push(result);
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${row.case} (${result.results.length} assertions)`);
    if (!result.passed) process.exitCode = 1;
  }
  if (layouts) {
    // Use the production save: no diagnostic controls in visual evidence.
    await call('qxqy_studio_play', { handle, action: 'stop' });
    ({ handle } = await call('qxqy_project_open', { path: 'fc-chess.save.json' }));
    for (const canvasId of ['pc-16-9','pc-21-9','mobile-16-9','mobile-19.5-9','mobile-4-3']) {
      await call('qxqy_studio_play', { handle, action: 'start', args: { canvasId } });
      const test = { format: 'qxqy-autotest', version: 1, name: 'layout-' + canvasId, dt: .1,
        events: [{ t: .1, source: 'user', kind: 'click', payload: { name: 'ModeFast' } }],
        asserts: [{ kind: 'control', at: .2, name: 'TurnText', field: 'text', equals: '紅方' }] };
      const result = await call('qxqy_studio_play', { handle, action: 'runCase', args: { canvasId, case: test } });
      if (!result.passed || result.results.length !== 1) throw new Error('Layout smoke failed: ' + canvasId);
      const screenshot = await client.callTool({ name: 'qxqy_studio_play_screenshot', arguments: { handle } });
      if (screenshot.isError) throw new Error('Screenshot failed: ' + canvasId);
      const img = await loadImage(Buffer.from(screenshot.content.find(c => c.type === 'image').data, 'base64'));
      const scale = Math.min(img.width / 256, img.height / 224), w = Math.round(256 * scale), h = Math.round(224 * scale);
      const canvas = createCanvas(w, h);
      canvas.getContext('2d').drawImage(img, (img.width-w)/2, (img.height-h)/2, w,h,0,0,w,h);
      const path = 'records/screenshots/lua-' + canvasId + '.png';
      await writeFile(new URL('../' + path, import.meta.url), canvas.toBuffer('image/png'));
      report.results.push({ canvasId, passed: result.passed, screenshot: path, width: w, height: h, logs: result.snapshot.logs });
      console.log('PASS layout ' + canvasId);
    }
  }
} catch (error) { report.error = error.message; console.error(error); process.exitCode = 1; }
finally {
  if (handle) await call('qxqy_studio_play', { handle, action: 'stop' }).catch(() => {});
  await client.close();
  await writeFile(new URL('../records/' + (layouts ? 'lua-layout-results.json' : 'lua-step5-regression.json'), import.meta.url), JSON.stringify(report, null, 2) + '\n');
}

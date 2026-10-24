import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { fcChessSyncTextResolution } from '../tools/simulator-text-resolution.mjs';
import { fcChessCreatePointerSlop } from '../tools/simulator-pointer-slop.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const originalSHA256 = '5871692349ccec947b80a652065a7e084ebd79f8ae65fdb2a33561df9a70752d';
const start = '/* FC_CHESS_HIDPI_TEXT_V1 */';
const end = '/* FC_CHESS_HIDPI_TEXT_END */';
const inputStart = '/* FC_CHESS_POINTER_SLOP_V1 */';
const inputEnd = '/* FC_CHESS_POINTER_SLOP_END */';
const inputReplacements = [
  ['let V=$||F,ht=Z=>', 'let fcChessMotion=fcChessCreatePointerSlop();let V=$||F,ht=Z=>'],
  ['(x=Z.pointerId,F.setPointerCapture', '(fcChessMotion.down(Z),x=Z.pointerId,F.setPointerCapture'],
  ['x===Z.pointerId&&(P(),A("pointer",{type:"up",...j(Z,F)}),x=null)',
    'x===Z.pointerId&&(fcChessMotion.release(Z)&&(P(),A("pointer",{type:"move",...j(Z,F)})),P(),A("pointer",{type:"up",...j(Z,F)}),fcChessMotion.clear(),x=null)'],
  ['te=Z=>{!c||!h||', 'te=Z=>{let fcChessMove=fcChessMotion.move(Z,x);if(!fcChessMove)return;!c||!h||'],
  ['||(y=j(Z,F),!g&&', '||(y=j(Z,F),fcChessMove===2?(R(),A("pointer",{type:"move",...y})):!g&&'],
  ['x===Z.pointerId&&(R(),x=null,', 'x===Z.pointerId&&(R(),fcChessMotion.clear(),x=null,'],
  ['V.removeEventListener("keyup",Be),R()}', 'V.removeEventListener("keyup",Be),R(),fcChessMotion.clear()}'],
];
const hash = source => createHash('sha256').update(source).digest('hex');

export function originalRenderer(source) {
  if (source.includes(inputStart)) {
    const a = source.indexOf(inputStart), b = source.indexOf(inputEnd, a);
    if (b < 0 || source.indexOf(inputStart, a + inputStart.length) >= 0) throw new Error('Malformed simulator input patch');
    source = source.slice(0, a) + source.slice(b + inputEnd.length);
    for (const [before, after] of inputReplacements) {
      if (source.split(after).length !== 2) throw new Error('Simulator input patch anchors changed');
      source = source.replace(after, before);
    }
  }
  if (source.includes(start)) {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    if (b < 0 || source.indexOf(start, a + start.length) >= 0) throw new Error('Malformed simulator text patch');
    source = source.slice(0, a) + source.slice(b + end.length);
    source = source.replace('n.__fcChessText=m,m.anchor.set(u.x,u.y)', 'm.anchor.set(u.x,u.y)');
    source = source.replaceAll('this.pruneImageTextures(),fcChessSyncTextResolution(this),this.app.render()', 'this.pruneImageTextures(),this.app.render()');
  }
  if (hash(source) !== originalSHA256) throw new Error('Simulator renderer differs from the pinned 0.4.1 bundle; review the patch before updating');
  return source;
}

export function patchedRenderer(source) {
  source = originalRenderer(source);
  for (const [before, after] of inputReplacements) {
    if (source.split(before).length !== 2) throw new Error('Simulator input patch anchors changed');
    source = source.replace(before, after);
  }
  source = source.replace('function Zw(', inputStart + '\n' + fcChessCreatePointerSlop.toString() + '\n' + inputEnd + 'function Zw(');
  const classStart = source.lastIndexOf('var e1=class');
  const classEnd = source.indexOf('export{', classStart);
  if (classStart < 0 || classEnd < 0) throw new Error('Simulator renderer class not found');
  let body = source.slice(classStart, classEnd);
  const anchor = 'm.anchor.set(u.x,u.y)';
  const render = 'this.pruneImageTextures(),this.app.render()';
  if (body.split(anchor).length !== 2 || body.split(render).length !== 3) throw new Error('Simulator text/render patch anchors changed');
  body = body.replace(anchor, 'n.__fcChessText=m,' + anchor);
  body = body.replaceAll(render, 'this.pruneImageTextures(),fcChessSyncTextResolution(this),this.app.render()');
  return source.slice(0, classStart) + start + '\n' + fcChessSyncTextResolution.toString() + '\n' + end + body + source.slice(classEnd);
}

export function patchSimulator({ check = false } = {}) {
  const packagePath = root + 'node_modules/beyond-simulator-web/';
  const pkg = JSON.parse(fs.readFileSync(packagePath + 'package.json', 'utf8'));
  if (pkg.version !== '0.4.1') throw new Error('Simulator text patch requires beyond-simulator-web@0.4.1');
  const path = packagePath + 'dist/public/play-renderer.js';
  const current = fs.readFileSync(path, 'utf8'), next = patchedRenderer(current);
  if (check && current !== next) throw new Error('Simulator text patch is missing/stale; run npm run patch:simulator');
  if (!check && current !== next) {
    fs.writeFileSync(path + '.fc-chess-tmp', next);
    fs.renameSync(path + '.fc-chess-tmp', path);
  }
  return { version: pkg.version, changed: current !== next, sha256: hash(next) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = patchSimulator({ check: process.argv.includes('--check') });
    console.log(`Simulator text/input patch ${result.changed ? 'applied' : 'ready'} (v${result.version})`);
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  }
}

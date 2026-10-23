import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { originalRenderer, patchedRenderer } from './patch-simulator-renderer.mjs';

// Execute the installed renderer's real scene/update methods. Tiny Pixi stand-ins
// avoid WebGL in Node while preserving text sampling and parent relationships.
function renderer(resolution = 1) {
  const source = fs.readFileSync('node_modules/beyond-simulator-web/dist/public/play-renderer.js', 'utf8');
  const classStart = source.lastIndexOf('var e1=class');
  const marker = source.lastIndexOf('/* FC_CHESS_HIDPI_TEXT_V1 */', classStart);
  assert.ok(classStart >= 0);
  class Container {
    constructor() { this.children = []; this.scale = { set() {} }; }
    addChild(...children) { for (const child of children) { child.parent?.removeChild(child); this.children.push(child); child.parent = this; } return children[0]; }
    addChildAt(child, i) { this.addChild(child); this.children.splice(this.children.indexOf(child), 1); this.children.splice(i, 0, child); return child; }
    removeChild(child) { this.children = this.children.filter(x => x !== child); child.parent = null; }
    destroy() {}
  }
  class Graphics extends Container { rect() { return this; } fill() { return this; } }
  class Text extends Container {
    constructor(options) { super(); Object.assign(this, options); this.resolution = resolution; this.anchor = { set() {} }; }
  }
  const context = vm.createContext({
    ft: Container, Zt: Graphics, qn: Text, ir: class { constructor(style) { Object.assign(this, style); } },
    eE: new Set(['textbox', 'textwindow']), Jt: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    Ki: () => ({ color: 0xffffff, alpha: 1 }), rE: () => ({ x: .5, y: .5 }),
    sE: node => JSON.stringify([node.kind, node.text, node.fontSize, node.sourceWidth, node.sourceHeight]),
    r1: () => false, wv: () => null, t1: node => node.matrix ? Object.values(node.matrix) : null,
  });
  vm.runInContext(source.slice(marker >= 0 ? marker : classStart, source.indexOf('export{', classStart)) + ';globalThis.Renderer=e1;', context);
  const instance = Object.create(context.Renderer.prototype);
  Object.assign(instance, {
    app: { renderer: { resolution, resize() {} }, stage: new Container(), render() {} },
    ready: Promise.resolve(), nodes: new Map(), canvasWidth: 1600, canvasHeight: 900,
  });
  instance.applyMatrix = () => {}; // Text sampling uses source matrices, not Pixi's stale cached world transform.
  return instance;
}
const matrix = (a = 1, b = 0, c = 0, d = a) => ({ a, b, c, d, tx: 0, ty: 0 });
const group = (id, parent, transform) => ({ id, parent, kind: 'container', sourceWidth: 256, sourceHeight: 224, matrix: transform });
const label = (id, parent) => ({ id, parent, kind: 'textbox', sourceWidth: 80, sourceHeight: 16, fontSize: 10, text: '中國象棋', matrix: matrix() });
const text = r => r.nodes.get('label').__visual.children.find(x => x.text);

test('a 4x game container rasterizes glyphs at 4x while keeping layout and font size', async () => {
  const r = renderer();
  await r.applyScene({ format: 'tree-v1', reset: true, nodes: [group('root', null, matrix(4)), label('label', 'root')] }, 1600, 900);
  assert.equal(text(r).resolution, 4, 'Low-resolution text is magnified by the game root');
  assert.equal(text(r).style.fontSize, 10);
});
test('nested rotated and nonuniform parents include device pixel ratio', async () => {
  const r = renderer(2);
  await r.applyScene({ format: 'tree-v1', reset: true, nodes: [group('root', null, matrix(2)), group('inner', 'root', matrix(0, 3, -1, 0)), label('label', 'inner')] }, 1600, 900);
  assert.equal(text(r).resolution, 12);
});
test('changing only an ancestor scale refreshes sampling without recreating text', async () => {
  const r = renderer();
  await r.applyScene({ format: 'tree-v1', reset: true, nodes: [group('root', null, matrix(4)), label('label', 'root')] }, 1600, 900);
  const original = text(r);
  await r.applyScene({ format: 'tree-v1', changed: [group('root', null, matrix(2))] }, 1600, 900);
  assert.equal(text(r), original);
  assert.equal(text(r).resolution, 2);
});
test('flat paint, shrinkage and large scales stay bounded', async () => {
  const r = renderer(2);
  await r.render([{ ...label('label', null), matrix: matrix(3) }], 1600, 900);
  assert.equal(text(r).resolution, 6);
  await r.render([{ ...label('label', null), matrix: matrix(.5) }], 1600, 900);
  assert.equal(text(r).resolution, 2);
  await r.render([{ ...label('label', null), matrix: matrix(100) }], 1600, 900);
  assert.equal(text(r).resolution, 16);
});
test('the project patch is repeatable, reversible and rejects unexpected vendor changes', () => {
  const current = fs.readFileSync('node_modules/beyond-simulator-web/dist/public/play-renderer.js', 'utf8');
  const original = originalRenderer(current);
  assert.equal(patchedRenderer(original), current);
  assert.equal(patchedRenderer(current), current);
  assert.equal(originalRenderer(patchedRenderer(current)), original);
  assert.throws(() => patchedRenderer(current + '\n// changed vendor bundle'), /differs from the pinned/);
});

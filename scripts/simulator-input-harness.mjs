import fs from 'node:fs';
import vm from 'node:vm';
import { originalRenderer } from './patch-simulator-renderer.mjs';

// Run the installed browser binding, including its move throttle. Only the DOM,
// timers and transport are replaced; tests do not reimplement pointer dispatch.
export async function inputHarness({ width = 1600, height = 900, cssWidth = 800, cssHeight = 450, original = false } = {}) {
  let source = fs.readFileSync('node_modules/beyond-simulator-web/dist/public/play-renderer.js', 'utf8');
  if (original) source = originalRenderer(source);
  const start = source.indexOf('function Jv('), end = source.indexOf('var Qw=', start);
  if (start < 0 || end < 0) throw new Error('Pinned input binding not found');
  const timers = new Map(); let serial = 0;
  const context = vm.createContext({ Qv: 60, Zv: 33, fd: () => '',
    setTimeout: fn => { timers.set(++serial, fn); return serial; },
    clearTimeout: id => timers.delete(id), setInterval: () => ++serial, clearInterval() {} });
  vm.runInContext(source.slice(start, end) + ';this.createSession=Zw;', context);
  const calls = [], listeners = new Map();
  const stage = {
    getBoundingClientRect: () => ({ left: 0, top: 0, bottom: cssHeight, width: cssWidth, height: cssHeight }),
    setPointerCapture() {},
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const snapshot = { running: true, canvasWidth: width, canvasHeight: height, frame: 0 };
  const session = context.createSession({ renderer: {}, audio: { reset() {}, sync() {}, unlock() {}, destroy() {} },
    api: async (action, args) => { calls.push({ action, args: JSON.parse(JSON.stringify(args)) }); return snapshot; },
    onError(error) { throw error; } });
  await session.start(); session.bindInput(stage); calls.length = 0;
  const send = (type, x, y, pointerId = 1) => listeners.get(type)?.({ clientX: x, clientY: y, pointerId, button: 0 });
  const flush = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };
  const point = (x, y) => {
    const z = Math.min(width / 256, height / 224);
    return [((width - 256 * z) / 2 + x * z) * cssWidth / width,
      (height - (height - 224 * z) / 2 - y * z) * cssHeight / height];
  };
  return { session, send, flush, point,
    pointer: () => calls.filter(c => c.action === 'pointer').map(c => c.args),
    tap(x, y, dx = 2, dy = 1) {
      send('pointerdown', x, y); send('pointermove', x + dx, y + dy);
      flush(); send('pointerup', x + dx, y + dy);
    } };
}

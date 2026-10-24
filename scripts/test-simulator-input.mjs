import assert from 'node:assert/strict';
import test from 'node:test';
import { inputHarness } from './simulator-input-harness.mjs';

test('small pointer jitter preserves a single click, even when a move throttle fires', async () => {
  const h = await inputHarness(); h.tap(200, 200);
  assert.deepEqual(h.pointer().map(x => x.type), ['down', 'up']); h.session.destroy();
});
test('the tolerance uses cumulative CSS distance and keeps genuine drags', async () => {
  const h = await inputHarness(); h.send('pointerdown', 200, 200);
  for (let i = 1; i <= 6; i++) { h.send('pointermove', 200 + i, 200); h.flush(); }
  h.send('pointerup', 206, 200);
  assert.deepEqual(h.pointer().map(x => x.type), ['down', 'move', 'move', 'up']); h.session.destroy();
});
test('a large release displacement with no move event is still a drag', async () => {
  const h = await inputHarness(); h.send('pointerdown', 200, 200); h.send('pointerup', 210, 200);
  assert.deepEqual(h.pointer().map(x => x.type), ['down', 'move', 'up']); h.session.destroy();
});
test('dragging out and back never turns into a click', async () => {
  const h = await inputHarness(); h.send('pointerdown', 200, 200);
  h.send('pointermove', 210, 200); h.flush(); h.send('pointermove', 200, 200); h.send('pointerup', 200, 200);
  assert.deepEqual(h.pointer().map(x => x.type), ['down', 'move', 'move', 'up']); h.session.destroy();
});
test('a drag excursion and return within the move throttle is not collapsed into a tap', async () => {
  const h = await inputHarness(); h.send('pointerdown', 200, 200);
  h.send('pointermove', 210, 200); h.send('pointermove', 200, 200); h.send('pointerup', 200, 200);
  assert.deepEqual(h.pointer().map(x => x.type), ['down', 'move', 'move', 'up']);
  assert.equal(h.pointer()[1].x, 420, 'The first real movement must reach the worker before returning');
  h.session.destroy();
});
test('cancel, lost capture and restart do not poison the next tap; other pointers are ignored', async () => {
  for (const cancel of ['pointercancel', 'lostpointercapture', 'restart']) {
    const h = await inputHarness(); h.send('pointerdown', 200, 200);
    if (cancel === 'restart') await h.session.start(); else h.send(cancel, 200, 200);
    const before = h.pointer().length;
    h.send('pointerdown', 200, 200); h.send('pointermove', 250, 200, 2);
    h.send('pointermove', 201, 200); h.flush(); h.send('pointerup', 201, 200);
    assert.deepEqual(h.pointer().slice(before).map(x => x.type), ['down', 'up'], cancel); h.session.destroy();
  }
});
test('hover motion remains available and a new gesture resets drag state', async () => {
  const h = await inputHarness(); h.send('pointermove', 200, 200); h.flush();
  h.send('pointerdown', 200, 200); h.send('pointermove', 210, 200); h.flush(); h.send('pointerup', 210, 200);
  const before = h.pointer().length; h.tap(210, 200);
  assert.equal(h.pointer()[0].type, 'move');
  assert.deepEqual(h.pointer().slice(before).map(x => x.type), ['down', 'up']); h.session.destroy();
});
test('rapid alternating taps do not leak delayed movement into the next gesture', async () => {
  const h = await inputHarness();
  for (let i = 0; i < 30; i++) {
    const x = i % 2 ? 250 : 200;
    h.send('pointerdown', x, 200); h.send('pointermove', x + 2, 201); h.send('pointerup', x + 2, 201);
  }
  h.flush();
  assert.deepEqual(h.pointer().map(x => x.type), Array.from({ length: 30 }, () => ['down', 'up']).flat());
  h.session.destroy();
});
test('the 5px threshold includes diagonal movement and is independent of canvas scaling', async () => {
  for (const options of [{ width: 1600, cssWidth: 800 }, { width: 2100, cssWidth: 400 }, { width: 1280, cssWidth: 1280 }]) {
    const h = await inputHarness(options);
    h.tap(200, 200, 2.9, 3.9);
    assert.deepEqual(h.pointer().map(x => x.type), ['down', 'up']);
    h.send('pointerdown', 200, 200); h.send('pointermove', 203, 204); h.flush(); h.send('pointerup', 203, 204);
    assert.deepEqual(h.pointer().slice(2).map(x => x.type), ['down', 'move', 'up']); h.session.destroy();
  }
});

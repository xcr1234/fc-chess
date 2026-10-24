// Browser-only policy: measure movement in CSS pixels, before conversion into
// canvas coordinates. The 0.4.1 worker treats any move as a drag and then drops
// CursorClick. Suppress tap jitter without changing game Lua or worker rules.
export function fcChessCreatePointerSlop() {
  let press = null;
  const distance = event => Math.hypot(event.clientX - press.x, event.clientY - press.y);
  return {
    down(event) { press = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }; },
    move(event, activePointer) {
      if (activePointer === null) { press = null; return 1; }
      if (!press || event.pointerId !== press.id) return 0;
      if (press.dragging) return 1;
      if (distance(event) < 5) return 0;
      press.dragging = true;
      // Deliver the first real movement immediately. Otherwise the browser's
      // move throttle could merge an excursion and return into a zero move,
      // and the worker would interpret the entire drag as a tap.
      return 2;
    },
    // A browser may coalesce the last move into pointerup. Ensure an actual
    // displacement cannot masquerade as a click when no move was delivered.
    release(event) {
      return press && event.pointerId === press.id && !press.dragging && distance(event) >= 5;
    },
    clear() { press = null; },
  };
}

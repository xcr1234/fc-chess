// Project-local compatibility fix for beyond-simulator-web 0.4.1.
// This function is embedded into its browser bundle by patch-simulator-renderer.
export function fcChessSyncTextResolution(renderer) {
  const pixelRatio = renderer.app.renderer.resolution || 1;
  for (const node of renderer.nodes.values()) {
    const text = node.__visual?.__fcChessText;
    if (!text) continue;
    let a = 1, b = 0, c = 0, d = 1;
    const visited = new Set();
    for (let parent = node; parent && parent !== renderer.app.stage && !visited.has(parent); parent = parent.parent) {
      visited.add(parent);
      const matrix = parent.__sceneItem?.matrix;
      if (!matrix || ![matrix.a, matrix.b, matrix.c, matrix.d].every(Number.isFinite)) continue;
      const nextA = matrix.a * a + matrix.c * b;
      const nextB = matrix.b * a + matrix.d * b;
      const nextC = matrix.a * c + matrix.c * d;
      const nextD = matrix.b * c + matrix.d * d;
      a = nextA; b = nextB; c = nextC; d = nextD;
    }
    // Largest singular value: preserves enough samples for rotation, skew and
    // nonuniform ancestors without depending on Pixi's not-yet-updated transforms.
    const trace = a * a + b * b + c * c + d * d;
    const determinant = a * d - b * c;
    const stretch = Math.sqrt((trace + Math.sqrt(Math.max(0, trace * trace - 4 * determinant * determinant))) / 2);
    // Quarter-step buckets avoid rerasterizing for tiny transform changes.
    // Bound texture growth for extreme canvas sizes; layout/font size stays intact.
    const resolution = Math.min(16, Math.max(pixelRatio, Math.ceil(pixelRatio * stretch * 4) / 4));
    if (Number.isFinite(resolution) && text.resolution !== resolution) text.resolution = resolution;
  }
}

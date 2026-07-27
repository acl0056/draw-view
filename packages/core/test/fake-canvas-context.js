/**
 * Fake / recording CanvasRenderingContext2D for use by mode and engine tests.
 *
 * It records the draw calls the engine and drawing modes rely on
 * (`arc`, `fill`, `createRadialGradient`, `beginPath`, `moveTo`, `lineTo`,
 * `clearRect`) so tests can assert on the emitted call sequence without a real
 * canvas. Each recorded entry is `{ method, args }`, preserving order so
 * golden-master and round-trip comparisons are exact.
 *
 * The stub is intentionally permissive: unrecorded 2D methods used by the
 * engine (e.g. `closePath`, `save`, `restore`) are present as no-ops so code
 * under test runs unchanged, and `createRadialGradient` returns a gradient stub
 * exposing `addColorStop` because the engine configures gradients that way.
 */

const RECORDED_METHODS = [
  'arc',
  'fill',
  'createRadialGradient',
  'beginPath',
  'moveTo',
  'lineTo',
  'clearRect',
];

// Methods the engine/modes may call that we do not assert on. Present as
// no-ops so the code under test executes without touching a real canvas.
const NOOP_METHODS = [
  'closePath',
  'save',
  'restore',
  'moveTo',
  'stroke',
  'fillRect',
  'rect',
  'quadraticCurveTo',
  'bezierCurveTo',
];

function createGradientStub(calls) {
  return {
    addColorStop(offset, color) {
      calls.push({ method: 'addColorStop', args: [offset, color] });
    },
  };
}

/**
 * Create a fake recording 2D context.
 * @param {object} [options]
 * @param {number} [options.width=800] backing canvas width
 * @param {number} [options.height=600] backing canvas height
 * @returns {object} a context-like object with a `calls` array and helpers
 */
export function createFakeContext(options = {}) {
  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const calls = [];

  const ctx = {
    calls,
    canvas: { width, height },
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,

    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      calls.push({ method: 'createRadialGradient', args: [x0, y0, r0, x1, y1, r1] });
      return createGradientStub(calls);
    },

    /**
     * Return only the calls for the given method name.
     * @param {string} method
     * @returns {object[]}
     */
    callsFor(method) {
      return calls.filter((c) => c.method === method);
    },

    /** Clear the recorded call log. */
    reset() {
      calls.length = 0;
    },
  };

  // Recorded methods (skip createRadialGradient, defined above with a return).
  RECORDED_METHODS.filter((m) => m !== 'createRadialGradient').forEach((method) => {
    ctx[method] = (...args) => {
      calls.push({ method, args });
    };
  });

  // No-op methods that are not asserted on but must exist.
  NOOP_METHODS.forEach((method) => {
    if (!ctx[method]) {
      ctx[method] = () => {};
    }
  });

  return ctx;
}

export default createFakeContext;

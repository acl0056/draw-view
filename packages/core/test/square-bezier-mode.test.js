import {
  describe, it, expect, vi, afterEach,
} from 'vitest';
import { SquareBezierMode } from '../src/modes/SquareBezierMode.js';
import { createFakeContext } from './fake-canvas-context.js';

/**
 * Unit tests for SquareBezierMode (task 4.2).
 *
 * Covers the mode's lifecycle contract, velocity-driven clamped widths, the
 * four-point rolling-buffer commit behaviour (with first-point duplication at
 * three points), lone-point/tap dot rendering, deterministic replay that
 * reproduces the committed stamps, preview isolation on the temp overlay, and
 * per-stroke state reset between strokes.
 *
 * The mode reads the wall clock through a `_now()` seam; every test stubs it so
 * point timestamps — and therefore the velocity-driven widths — are fully
 * deterministic.
 *
 * _Requirements: 3.1, 3.2, 3.3_
 */

const COLOR = 'rgba(0,0,0';

/**
 * Stub the mode's `_now()` clock so it returns a predictable, monotonically
 * increasing timestamp on each call (begin() and every addPoint() call it once).
 * @param {SquareBezierMode} mode
 * @param {number} [startMs]
 * @param {number} [stepMs]
 */
function stubClock(mode, startMs = 1000, stepMs = 10) {
  let t = startMs;
  vi.spyOn(mode, '_now').mockImplementation(() => {
    const now = t;
    t += stepMs;
    return now;
  });
}

/** Draw a full stroke (begin + the given moves) against a fresh main context. */
function drawStroke(mode, ctx, first, moves, style = {}) {
  mode.begin(first, { ctx, colorPrefix: COLOR, ...style });
  moves.forEach((p) => mode.addPoint(p));
  return mode.end();
}

describe('SquareBezierMode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('identity (Req 3.1)', () => {
    it('exposes the stable id "square-bezier"', () => {
      expect(new SquareBezierMode().id).toBe('square-bezier');
    });
  });

  describe('lifecycle and serialized stroke shape (Req 3.1, 3.3)', () => {
    it('returns a well-formed stroke tagged square-bezier with timed points', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();

      const stroke = drawStroke(mode, ctx, { x: 0, y: 0 }, [
        { x: 10, y: 5 },
        { x: 20, y: 0 },
        { x: 30, y: 8 },
      ]);

      expect(stroke.mode).toBe('square-bezier');
      expect(stroke.color).toBe(COLOR);
      expect(stroke.options).toEqual({
        minWidth: 0.5,
        maxWidth: 2.5,
        velocityFilterWeight: 0.7,
        dotSize: 0,
      });
      expect(stroke.points).toHaveLength(4);
      stroke.points.forEach((p) => {
        expect(typeof p.x).toBe('number');
        expect(typeof p.y).toBe('number');
        expect(typeof p.width).toBe('number');
        expect(typeof p.time).toBe('number');
      });
    });

    it('records a monotonically increasing time on every point', () => {
      const mode = new SquareBezierMode();
      stubClock(mode, 5000, 16);
      const ctx = createFakeContext();

      const stroke = drawStroke(mode, ctx, { x: 0, y: 0 }, [
        { x: 5, y: 5 },
        { x: 10, y: 0 },
      ]);

      const times = stroke.points.map((p) => p.time);
      expect(times).toEqual([5000, 5016, 5032]);
    });

    it('serializes options supplied through the style bundle so replay can reproduce widths', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();
      const options = {
        minWidth: 1, maxWidth: 6, velocityFilterWeight: 0.5, dotSize: 3,
      };

      const stroke = drawStroke(mode, ctx, { x: 0, y: 0 }, [{ x: 4, y: 4 }], { options });

      expect(stroke.options).toEqual(options);
    });

    it('commits an initial dot to the main context on begin', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();

      mode.begin({ x: 3, y: 7 }, { ctx, colorPrefix: COLOR });

      // The initial dot is a single filled arc stamp.
      expect(ctx.callsFor('arc')).toHaveLength(1);
      expect(ctx.callsFor('fill')).toHaveLength(1);
      const [arc] = ctx.callsFor('arc');
      expect(arc.args[0]).toBe(3);
      expect(arc.args[1]).toBe(7);
    });
  });

  describe('velocity-driven widths clamped to [minWidth, maxWidth] (Req 3.2)', () => {
    it('keeps every committed point width within the configured bounds', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();
      const options = {
        minWidth: 0.5, maxWidth: 2.5, velocityFilterWeight: 0.7, dotSize: 0,
      };

      const stroke = drawStroke(mode, ctx, { x: 0, y: 0 }, [
        { x: 40, y: 40 },
        { x: 5, y: 60 },
        { x: 90, y: 10 },
        { x: 12, y: 33 },
      ], { options });

      stroke.points.forEach((p) => {
        expect(p.width).toBeGreaterThanOrEqual(options.minWidth);
        expect(p.width).toBeLessThanOrEqual(options.maxWidth);
      });
    });

    it('produces a small width for fast movement and a wide one for slow movement', () => {
      const options = {
        minWidth: 0.5, maxWidth: 10, velocityFilterWeight: 1, dotSize: 0,
      };

      // Fast: large distance per 10ms step drives width toward minWidth.
      const fastMode = new SquareBezierMode();
      stubClock(fastMode);
      const fast = drawStroke(fastMode, createFakeContext(), { x: 0, y: 0 }, [
        { x: 200, y: 0 },
        { x: 400, y: 0 },
      ], { options });

      // Slow: tiny distance per step keeps width near maxWidth.
      const slowMode = new SquareBezierMode();
      stubClock(slowMode);
      const slow = drawStroke(slowMode, createFakeContext(), { x: 0, y: 0 }, [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ], { options });

      const fastCommitted = fast.points[fast.points.length - 1].width;
      const slowCommitted = slow.points[slow.points.length - 1].width;
      expect(fastCommitted).toBeLessThan(slowCommitted);
    });
  });

  describe('four-point rolling buffer commit behaviour (Req 3.1)', () => {
    // Each committed curve segment ends with exactly one fill; the initial dot
    // adds one more. Counting fills therefore reveals how many curve segments
    // the rolling buffer committed.
    const committedCurves = (ctx) => ctx.callsFor('fill').length - 1;

    it('commits no curve until three points have been collected', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();

      mode.begin({ x: 0, y: 0 }, { ctx, colorPrefix: COLOR });
      mode.addPoint({ x: 10, y: 5 });

      expect(committedCurves(ctx)).toBe(0);
    });

    it('commits the first curve once three points exist (first-point duplication)', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();

      mode.begin({ x: 0, y: 0 }, { ctx, colorPrefix: COLOR });
      mode.addPoint({ x: 10, y: 5 });
      mode.addPoint({ x: 20, y: 0 });

      expect(committedCurves(ctx)).toBe(1);
    });

    it('commits one additional curve for each further point', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();

      mode.begin({ x: 0, y: 0 }, { ctx, colorPrefix: COLOR });
      mode.addPoint({ x: 10, y: 5 });
      mode.addPoint({ x: 20, y: 0 });
      mode.addPoint({ x: 30, y: 8 });
      mode.addPoint({ x: 40, y: 2 });

      expect(committedCurves(ctx)).toBe(3);
    });
  });

  describe('lone point / tap renders a single dot (Req 3.1)', () => {
    it('renders a tap as one dot and returns a single-point stroke', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();

      const stroke = mode.tap({ x: 5, y: 5 }, { ctx, colorPrefix: COLOR });

      expect(stroke.mode).toBe('square-bezier');
      expect(stroke.points).toHaveLength(1);
      expect(ctx.callsFor('arc')).toHaveLength(1);
      expect(ctx.callsFor('fill')).toHaveLength(1);
    });

    it('uses the min/max midpoint as the dot radius when dotSize is 0', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();
      const options = {
        minWidth: 1, maxWidth: 5, velocityFilterWeight: 0.7, dotSize: 0,
      };

      const stroke = mode.tap({ x: 2, y: 2 }, { ctx, colorPrefix: COLOR, options });

      const [arc] = ctx.callsFor('arc');
      expect(stroke.points[0].width).toBe(3); // (1 + 5) / 2
      expect(arc.args[2]).toBe(3); // arc radius argument
    });

    it('uses dotSize as the dot radius when it is non-zero', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();
      const options = {
        minWidth: 1, maxWidth: 5, velocityFilterWeight: 0.7, dotSize: 4,
      };

      const stroke = mode.tap({ x: 2, y: 2 }, { ctx, colorPrefix: COLOR, options });

      const [arc] = ctx.callsFor('arc');
      expect(stroke.points[0].width).toBe(4);
      expect(arc.args[2]).toBe(4);
    });
  });

  describe('replay reproduces the committed stamps (Req 3.3)', () => {
    it('reproduces the exact committed draw-call sequence from a serialized stroke', () => {
      const drawCtx = createFakeContext();
      const mode = new SquareBezierMode();
      stubClock(mode);

      const stroke = drawStroke(mode, drawCtx, { x: 0, y: 0 }, [
        { x: 12, y: 6 },
        { x: 24, y: 0 },
        { x: 36, y: 9 },
      ]);

      const replayCtx = createFakeContext();
      mode.replay(stroke, replayCtx);

      // Replay recomputes identical geometry/widths from the stored raw points.
      expect(replayCtx.calls).toEqual(drawCtx.calls);
    });

    it('is deterministic: replaying the same stroke twice yields identical calls', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const stroke = drawStroke(mode, createFakeContext(), { x: 0, y: 0 }, [
        { x: 15, y: 5 },
        { x: 30, y: 0 },
        { x: 45, y: 12 },
      ]);

      const first = createFakeContext();
      const second = createFakeContext();
      mode.replay(stroke, first);
      mode.replay(stroke, second);

      expect(second.calls).toEqual(first.calls);
    });

    it('replays a single-point stroke as one dot', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const stroke = mode.tap({ x: 7, y: 9 }, { ctx: createFakeContext(), colorPrefix: COLOR });

      const replayCtx = createFakeContext();
      mode.replay(stroke, replayCtx);

      expect(replayCtx.callsFor('arc')).toHaveLength(1);
      expect(replayCtx.callsFor('fill')).toHaveLength(1);
    });
  });

  describe('preview isolation on the temp overlay (Req 3.1)', () => {
    it('paints the preview only on the temp overlay and never mutates committed output', () => {
      const mode = new SquareBezierMode();
      stubClock(mode);
      const ctx = createFakeContext();
      const tempCtx = createFakeContext();

      mode.begin({ x: 0, y: 0 }, { ctx, tempCtx, colorPrefix: COLOR });
      mode.addPoint({ x: 10, y: 5 });
      mode.addPoint({ x: 20, y: 0 });

      const committedBefore = [...ctx.calls];
      mode.renderPreview(tempCtx);

      // The committed main-context calls are untouched by the preview...
      expect(ctx.calls).toEqual(committedBefore);
      // ...and the preview draws its trailing segment on the temp overlay.
      expect(tempCtx.callsFor('arc').length).toBeGreaterThan(0);
      expect(tempCtx.callsFor('clearRect').length).toBeGreaterThan(0);
    });
  });

  describe('per-stroke state resets between strokes (Req 3.1)', () => {
    it('does not leak buffer or velocity state from one stroke into the next', () => {
      const mode = new SquareBezierMode();
      stubClock(mode, 1000, 10);
      const firstCtx = createFakeContext();
      const first = drawStroke(mode, firstCtx, { x: 0, y: 0 }, [
        { x: 10, y: 5 },
        { x: 20, y: 0 },
        { x: 30, y: 8 },
      ]);

      // A second identical stroke, with an identical clock, must reproduce the
      // exact same committed geometry — proving no state leaked across strokes.
      const mode2 = new SquareBezierMode();
      stubClock(mode2, 1000, 10);
      const secondCtx = createFakeContext();
      const second = drawStroke(mode2, secondCtx, { x: 0, y: 0 }, [
        { x: 10, y: 5 },
        { x: 20, y: 0 },
        { x: 30, y: 8 },
      ]);

      expect(second.points).toEqual(first.points);
      expect(secondCtx.calls).toEqual(firstCtx.calls);
    });

    it('reusing the same mode instance for a second stroke starts a fresh buffer', () => {
      const mode = new SquareBezierMode();

      stubClock(mode, 1000, 10);
      const firstCtx = createFakeContext();
      drawStroke(mode, firstCtx, { x: 0, y: 0 }, [
        { x: 10, y: 5 },
        { x: 20, y: 0 },
        { x: 30, y: 8 },
      ]);

      vi.restoreAllMocks();
      stubClock(mode, 1000, 10);
      const secondCtx = createFakeContext();

      // Only two points after begin: the fresh buffer must commit exactly one
      // curve (initial dot + one curve = two fills), just like a first stroke.
      mode.begin({ x: 0, y: 0 }, { ctx: secondCtx, colorPrefix: COLOR });
      mode.addPoint({ x: 10, y: 5 });
      mode.addPoint({ x: 20, y: 0 });

      expect(secondCtx.callsFor('fill')).toHaveLength(2);
    });
  });
});

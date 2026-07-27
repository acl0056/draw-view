import { describe, it, expect } from 'vitest';
import { PerfectFreehandMode } from '../src/modes/PerfectFreehandMode.js';
import { createFakeContext } from './fake-canvas-context.js';

/**
 * Unit tests for PerfectFreehandMode (task 5.3).
 *
 * Covers the mode's identity and lifecycle contract, the single committed fill
 * onto the Main_Canvas at end() (with nothing committed during begin/addPoint),
 * the single-path outline shape (beginPath -> one moveTo -> many lineTo ->
 * fill), preview isolation on the Temp_Overlay, the serialized stroke shape
 * (mode/color/options/points-with-pressure), the missing-pressure default,
 * deterministic replay consistent with the committed end() output, and
 * per-stroke state reset between strokes.
 *
 * getStroke (perfect-freehand) is deterministic for identical inputs, so the
 * recorded draw-call sequences can be compared exactly.
 *
 * _Requirements: 4.1, 4.2, 4.3, 7.3_
 */

const COLOR = 'rgba(0,0,0';
const DEFAULT_PRESSURE = 0.5;
const DEFAULT_OPTIONS = {
  size: 6,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
};

/** Draw a full stroke (begin + the given moves) against a fresh main context. */
function drawStroke(mode, ctx, first, moves, style = {}) {
  mode.begin(first, { ctx, colorPrefix: COLOR, ...style });
  moves.forEach((p) => mode.addPoint(p));
  return mode.end();
}

describe('PerfectFreehandMode', () => {
  describe('identity (Req 4.2)', () => {
    it('exposes the stable id "perfect-freehand"', () => {
      expect(new PerfectFreehandMode().id).toBe('perfect-freehand');
    });
  });

  describe('single committed fill at end() (Req 4.2)', () => {
    it('commits nothing to the main context during begin/addPoint', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();

      mode.begin({ x: 0, y: 0, pressure: 0.4 }, { ctx, colorPrefix: COLOR });
      mode.addPoint({ x: 10, y: 5, pressure: 0.6 });
      mode.addPoint({ x: 20, y: 0, pressure: 0.5 });

      // Main context is append-only and only touched at end().
      expect(ctx.calls).toHaveLength(0);
    });

    it('fills the final outline onto the main context exactly once at end()', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();

      drawStroke(mode, ctx, { x: 0, y: 0, pressure: 0.4 }, [
        { x: 10, y: 5, pressure: 0.6 },
        { x: 20, y: 0, pressure: 0.5 },
      ]);

      expect(ctx.callsFor('fill')).toHaveLength(1);
    });

    it('fills the outline as a single path: beginPath, one moveTo, many lineTo, fill', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();

      drawStroke(mode, ctx, { x: 0, y: 0, pressure: 0.5 }, [
        { x: 10, y: 5, pressure: 0.5 },
        { x: 20, y: 0, pressure: 0.5 },
        { x: 30, y: 8, pressure: 0.5 },
      ]);

      expect(ctx.callsFor('beginPath')).toHaveLength(1);
      expect(ctx.callsFor('moveTo')).toHaveLength(1);
      expect(ctx.callsFor('lineTo').length).toBeGreaterThan(0);
      expect(ctx.callsFor('fill')).toHaveLength(1);

      // The path is opened before any point is placed and filled after the
      // final segment: beginPath precedes the single moveTo, and fill is last.
      const methods = ctx.calls.map((c) => c.method);
      expect(methods[0]).toBe('beginPath');
      expect(methods[1]).toBe('moveTo');
      expect(methods[methods.length - 1]).toBe('fill');
    });

    it('sets a fully-opaque fill color derived from the color prefix', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();

      drawStroke(mode, ctx, { x: 0, y: 0, pressure: 0.5 }, [{ x: 10, y: 5, pressure: 0.5 }]);

      expect(ctx.fillStyle).toBe(`${COLOR},1)`);
    });
  });

  describe('preview isolation on the temp overlay (Req 4.1)', () => {
    it('paints the evolving outline only on the temp overlay and never mutates committed output', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();
      const tempCtx = createFakeContext();

      mode.begin({ x: 0, y: 0, pressure: 0.5 }, { ctx, tempCtx, colorPrefix: COLOR });
      mode.addPoint({ x: 10, y: 5, pressure: 0.5 });
      mode.addPoint({ x: 20, y: 0, pressure: 0.5 });

      const committedBefore = [...ctx.calls];
      mode.renderPreview(tempCtx);

      // The main context is untouched by the preview...
      expect(ctx.calls).toEqual(committedBefore);
      // ...and the outline is painted (clear + fill) on the temp overlay.
      expect(tempCtx.callsFor('clearRect').length).toBeGreaterThan(0);
      expect(tempCtx.callsFor('fill').length).toBeGreaterThan(0);
      expect(tempCtx.callsFor('moveTo')).toHaveLength(1);
      expect(tempCtx.callsFor('lineTo').length).toBeGreaterThan(0);
    });

    it('clears the temp overlay each frame so previews do not accumulate', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();
      const tempCtx = createFakeContext();

      mode.begin({ x: 0, y: 0, pressure: 0.5 }, { ctx, tempCtx, colorPrefix: COLOR });
      mode.addPoint({ x: 10, y: 5, pressure: 0.5 });

      mode.renderPreview(tempCtx);
      const afterFirst = tempCtx.callsFor('clearRect').length;
      mode.addPoint({ x: 20, y: 0, pressure: 0.5 });
      mode.renderPreview(tempCtx);

      // Each preview frame issues its own clearRect before repainting.
      expect(tempCtx.callsFor('clearRect').length).toBe(afterFirst + 1);
    });

    it('is idempotent: repeated preview calls do not touch the main context', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();
      const tempCtx = createFakeContext();

      mode.begin({ x: 0, y: 0, pressure: 0.5 }, { ctx, tempCtx, colorPrefix: COLOR });
      mode.addPoint({ x: 10, y: 5, pressure: 0.5 });

      mode.renderPreview(tempCtx);
      mode.renderPreview(tempCtx);
      mode.renderPreview(tempCtx);

      expect(ctx.calls).toHaveLength(0);
    });
  });

  describe('serialized stroke shape (Req 4.3)', () => {
    it('returns a stroke tagged perfect-freehand with color, options and points', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();

      const stroke = drawStroke(mode, ctx, { x: 0, y: 0, pressure: 0.4 }, [
        { x: 10, y: 5, pressure: 0.6 },
        { x: 20, y: 0, pressure: 0.5 },
      ]);

      expect(stroke.mode).toBe('perfect-freehand');
      expect(stroke.color).toBe(COLOR);
      expect(stroke.options).toEqual(DEFAULT_OPTIONS);
      expect(stroke.points).toEqual([
        { x: 0, y: 0, pressure: 0.4 },
        { x: 10, y: 5, pressure: 0.6 },
        { x: 20, y: 0, pressure: 0.5 },
      ]);
    });

    it('serializes only x, y and pressure per point', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();

      const stroke = drawStroke(mode, ctx, { x: 1, y: 2, pressure: 0.5 }, [
        { x: 3, y: 4, pressure: 0.5 },
      ]);

      stroke.points.forEach((p) => {
        expect(Object.keys(p).sort()).toEqual(['pressure', 'x', 'y']);
      });
    });

    it('serializes options supplied through the style bundle so replay can reproduce the outline', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();
      const options = {
        size: 12, thinning: 0.2, smoothing: 0.8, streamline: 0.3,
      };

      const stroke = drawStroke(mode, ctx, { x: 0, y: 0, pressure: 0.5 }, [
        { x: 10, y: 5, pressure: 0.5 },
      ], { options });

      expect(stroke.options).toEqual(options);
    });
  });

  describe('missing pressure falls back to a default (Req 7.3)', () => {
    it('substitutes the default pressure for points that lack one', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();

      const stroke = drawStroke(mode, ctx, { x: 0, y: 0 }, [
        { x: 10, y: 5 },
        { x: 20, y: 0 },
      ]);

      stroke.points.forEach((p) => {
        expect(p.pressure).toBe(DEFAULT_PRESSURE);
      });
    });

    it('still renders a single filled outline when pressure is absent', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();

      drawStroke(mode, ctx, { x: 0, y: 0 }, [
        { x: 10, y: 5 },
        { x: 20, y: 0 },
      ]);

      expect(ctx.callsFor('fill')).toHaveLength(1);
    });

    it('treats a non-numeric pressure as missing and applies the default', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();

      const stroke = drawStroke(mode, ctx, { x: 0, y: 0, pressure: undefined }, [
        { x: 10, y: 5, pressure: null },
      ]);

      expect(stroke.points[0].pressure).toBe(DEFAULT_PRESSURE);
      expect(stroke.points[1].pressure).toBe(DEFAULT_PRESSURE);
    });
  });

  describe('replay reproduces the committed fill (Req 4.3)', () => {
    it('reproduces the exact committed draw-call sequence from a serialized stroke', () => {
      const drawCtx = createFakeContext();
      const mode = new PerfectFreehandMode();

      const stroke = drawStroke(mode, drawCtx, { x: 0, y: 0, pressure: 0.5 }, [
        { x: 12, y: 6, pressure: 0.5 },
        { x: 24, y: 0, pressure: 0.5 },
        { x: 36, y: 9, pressure: 0.5 },
      ]);

      const replayCtx = createFakeContext();
      mode.replay(stroke, replayCtx);

      // The committed end() fill and the replay fill are identical because both
      // rebuild the outline from the same points and options.
      expect(replayCtx.calls).toEqual(drawCtx.calls);
    });

    it('fills the main context exactly once on replay', () => {
      const mode = new PerfectFreehandMode();
      const stroke = drawStroke(mode, createFakeContext(), { x: 0, y: 0, pressure: 0.5 }, [
        { x: 12, y: 6, pressure: 0.5 },
        { x: 24, y: 0, pressure: 0.5 },
      ]);

      const replayCtx = createFakeContext();
      mode.replay(stroke, replayCtx);

      expect(replayCtx.callsFor('fill')).toHaveLength(1);
      expect(replayCtx.callsFor('moveTo')).toHaveLength(1);
      expect(replayCtx.callsFor('lineTo').length).toBeGreaterThan(0);
    });

    it('is deterministic: replaying the same stroke twice yields identical calls', () => {
      const mode = new PerfectFreehandMode();
      const stroke = drawStroke(mode, createFakeContext(), { x: 0, y: 0, pressure: 0.5 }, [
        { x: 15, y: 5, pressure: 0.5 },
        { x: 30, y: 0, pressure: 0.5 },
        { x: 45, y: 12, pressure: 0.5 },
      ]);

      const first = createFakeContext();
      const second = createFakeContext();
      mode.replay(stroke, first);
      mode.replay(stroke, second);

      expect(second.calls).toEqual(first.calls);
    });

    it('replays a stroke whose points omit pressure using the default', () => {
      const drawCtx = createFakeContext();
      const mode = new PerfectFreehandMode();
      const stroke = drawStroke(mode, drawCtx, { x: 0, y: 0 }, [
        { x: 10, y: 5 },
        { x: 20, y: 0 },
      ]);

      // Strip pressure to simulate an externally-authored / minimal document.
      const barePoints = stroke.points.map(({ x, y }) => ({ x, y }));
      const replayCtx = createFakeContext();
      mode.replay({ ...stroke, points: barePoints }, replayCtx);

      expect(replayCtx.calls).toEqual(drawCtx.calls);
    });
  });

  describe('per-stroke state resets between strokes (Req 4.2)', () => {
    it('does not leak points from one stroke into the next', () => {
      const mode = new PerfectFreehandMode();

      const first = drawStroke(mode, createFakeContext(), { x: 0, y: 0, pressure: 0.5 }, [
        { x: 10, y: 5, pressure: 0.5 },
        { x: 20, y: 0, pressure: 0.5 },
      ]);
      expect(first.points).toHaveLength(3);

      const secondCtx = createFakeContext();
      const second = drawStroke(mode, secondCtx, { x: 100, y: 100, pressure: 0.5 }, [
        { x: 110, y: 105, pressure: 0.5 },
      ]);

      // The second stroke contains only its own points.
      expect(second.points).toEqual([
        { x: 100, y: 100, pressure: 0.5 },
        { x: 110, y: 105, pressure: 0.5 },
      ]);
    });

    it('reproduces identical geometry for two identical strokes on the same instance', () => {
      const mode = new PerfectFreehandMode();

      const firstCtx = createFakeContext();
      drawStroke(mode, firstCtx, { x: 0, y: 0, pressure: 0.5 }, [
        { x: 10, y: 5, pressure: 0.5 },
        { x: 20, y: 0, pressure: 0.5 },
      ]);

      const secondCtx = createFakeContext();
      drawStroke(mode, secondCtx, { x: 0, y: 0, pressure: 0.5 }, [
        { x: 10, y: 5, pressure: 0.5 },
        { x: 20, y: 0, pressure: 0.5 },
      ]);

      expect(secondCtx.calls).toEqual(firstCtx.calls);
    });

    it('clears the temp overlay on begin so a stale preview is not carried over', () => {
      const mode = new PerfectFreehandMode();
      const ctx = createFakeContext();
      const tempCtx = createFakeContext();

      mode.begin({ x: 0, y: 0, pressure: 0.5 }, { ctx, tempCtx, colorPrefix: COLOR });

      expect(tempCtx.callsFor('clearRect').length).toBeGreaterThan(0);
    });
  });
});

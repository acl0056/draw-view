/**
 * Golden-master parity test for the Classic drawing-mode extraction.
 *
 * The Classic pipeline was lifted out of `DrawEngine` into
 * `ClassicSmoothingMode` without any intended change to its output (task 2.1).
 * Because there is no pre-refactor build to diff against at runtime, this test
 * pins the *current committed rendering* as the golden master: it drives
 * `DrawEngine` (default `classic` mode) through a fixed set of representative,
 * deterministic stroke sequences against the recording fake context and
 * snapshots the ordered sequence of canvas calls (method + numeric args).
 *
 * Any future change to the classic curve fitting, knot removal, corner
 * detection, or radial-gradient dot stamping will alter the recorded call
 * sequence and fail these snapshots, guarding the "behavior unchanged"
 * property (Requirements 2.1, 2.2).
 *
 * Coverage:
 *  - live drawing pipeline: begin (strokeStart) -> addPoint (strokeMove)* ->
 *    end (strokeEnd), plus the single-tap dot path.
 *  - replay pipeline: serialize the finished stroke, load it via
 *    `setDocument`, and snapshot the committed re-render. Replay is also
 *    asserted to be deterministic (replaying the same stroke twice yields an
 *    identical call sequence), which is the concrete "consistent committed
 *    output" guarantee for stored strokes.
 *
 * All input points are fixed literals (no randomness) so the snapshots are
 * stable across runs.
 */

import {
  describe, it, expect, beforeEach,
} from 'vitest';
import { DrawEngine } from '../src/DrawEngine.js';
import { createFakeContext } from './fake-canvas-context.js';

// Fixed, deterministic input sequences covering the representative shapes the
// classic pipeline must handle: a lone dot, a two-point line, a long smooth
// curve (exercises tangent fitting + knot removal), and a stroke with a sharp
// corner (exercises corner detection, which suppresses knot removal).
const DOT = [{ x: 50, y: 50 }];

const SHORT_LINE = [
  { x: 10, y: 10 },
  { x: 60, y: 12 },
];

const CURVED = [
  { x: 20, y: 100 },
  { x: 40, y: 80 },
  { x: 60, y: 65 },
  { x: 80, y: 55 },
  { x: 100, y: 50 },
  { x: 120, y: 52 },
  { x: 140, y: 60 },
  { x: 160, y: 72 },
  { x: 180, y: 88 },
  { x: 200, y: 108 },
  { x: 220, y: 130 },
  { x: 240, y: 155 },
];

const SHARP_CORNER = [
  { x: 20, y: 20 },
  { x: 40, y: 20 },
  { x: 60, y: 20 },
  { x: 80, y: 20 },
  { x: 100, y: 20 },
  { x: 120, y: 20 },
  { x: 122, y: 40 },
  { x: 124, y: 60 },
  { x: 126, y: 80 },
  { x: 128, y: 100 },
  { x: 130, y: 120 },
  { x: 132, y: 140 },
];

/**
 * Draw a multi-point stroke live through the engine and return the finished
 * serializable stroke plus the ordered committed call sequence. No temp
 * context is supplied, so the preview path is inert and every recorded call is
 * committed main-canvas output.
 * @param {{x:number,y:number}[]} points
 * @returns {{ stroke: object, calls: object[] }}
 */
function drawLive(points) {
  const ctx = createFakeContext();
  const engine = new DrawEngine({ ctx });
  engine.strokeStart(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    engine.strokeMove(points[i].x, points[i].y);
  }
  const stroke = engine.strokeEnd();
  return { stroke, calls: ctx.calls };
}

/**
 * Tap a single dot live and return the finished stroke plus recorded calls.
 * @param {{x:number,y:number}} point
 * @returns {{ stroke: object, calls: object[] }}
 */
function tapLive(point) {
  const ctx = createFakeContext();
  const engine = new DrawEngine({ ctx });
  const stroke = engine.strokeTap(point.x, point.y);
  return { stroke, calls: ctx.calls };
}

/**
 * Replay a serialized stroke into a fresh engine via `setDocument` and return
 * the committed call sequence (including the leading clearRect from redraw).
 * @param {object} stroke
 * @returns {object[]}
 */
function replayStroke(stroke) {
  const ctx = createFakeContext();
  const engine = new DrawEngine({ ctx });
  engine.setDocument({ drawDocumentVersion: '1.1', strokes: [stroke] });
  return ctx.calls;
}

describe('Classic mode golden-master parity', () => {
  const scenarios = [
    { name: 'a single dot (tap)', points: DOT, tap: true },
    { name: 'a short two-point line', points: SHORT_LINE, tap: false },
    { name: 'a long smooth curved stroke', points: CURVED, tap: false },
    { name: 'a stroke with a sharp corner', points: SHARP_CORNER, tap: false },
  ];

  describe('live committed rendering', () => {
    it.each(scenarios)('matches the golden master for $name', ({ points, tap }) => {
      const { calls } = tap ? tapLive(points[0]) : drawLive(points);

      // Sanity: the classic pipeline stamps radial-gradient dots, so committed
      // output must include arc + fill calls.
      expect(calls.filter((c) => c.method === 'arc').length).toBeGreaterThan(0);
      expect(calls.filter((c) => c.method === 'fill').length).toBeGreaterThan(0);

      expect(calls).toMatchSnapshot();
    });
  });

  describe('replay of a serialized stroke', () => {
    it.each(scenarios)('matches the golden master for $name', ({ points, tap }) => {
      const { stroke } = tap ? tapLive(points[0]) : drawLive(points);
      const calls = replayStroke(stroke);

      expect(calls.filter((c) => c.method === 'arc').length).toBeGreaterThan(0);
      expect(calls.filter((c) => c.method === 'fill').length).toBeGreaterThan(0);

      expect(calls).toMatchSnapshot();
    });

    it.each(scenarios)(
      'replays $name deterministically (identical committed output each time)',
      ({ points, tap }) => {
        const { stroke } = tap ? tapLive(points[0]) : drawLive(points);

        const first = replayStroke(stroke);
        const second = replayStroke(stroke);

        expect(second).toEqual(first);
      },
    );
  });

  describe('default mode', () => {
    let engine;

    beforeEach(() => {
      engine = new DrawEngine({ ctx: createFakeContext() });
    });

    it('is classic so these snapshots describe the default engine behavior', () => {
      expect(engine.getMode()).toBe('classic');
    });
  });
});

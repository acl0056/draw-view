import {
  describe, it, expect, vi, afterEach,
} from 'vitest';
import fc from 'fast-check';
import { DrawEngine } from '../src/DrawEngine.js';
import { createFakeContext } from './fake-canvas-context.js';

/**
 * Property-based test for Mode isolation (task 10.2).
 *
 * Property: Mode isolation — a random SEQUENCE of (mode, stroke) pairs, when
 * loaded as one document and replayed, has EACH stroke replayed under ITS OWN
 * mode regardless of order/position in the sequence. Equivalently, a stroke's
 * committed rendering does not depend on its neighbours: replaying a mixed
 * document yields the same committed draw calls as replaying each stroke
 * individually under its own mode and concatenating them.
 *
 * **Validates: Requirements 5.4**
 */

const MODE_IDS = ['classic', 'square-bezier', 'perfect-freehand'];

/** Build an engine wired to fresh recording contexts. */
function makeEngine(options = {}) {
  const ctx = createFakeContext();
  const tempCtx = createFakeContext();
  const engine = new DrawEngine({ ctx, tempCtx, ...options });
  return { engine, ctx, tempCtx };
}

/**
 * Draw a full stroke under the given mode on a throwaway engine and return the
 * finished serializable stroke (already tagged with its producing mode id).
 * Pressure is forwarded only for perfect-freehand, which is the pressure-aware
 * mode; centerline modes are driven with plain (x, y) samples.
 * @param {string} modeId
 * @param {Array<{x:number,y:number,pressure:number}>} points
 * @returns {object}
 */
function produceStroke(modeId, points) {
  const { engine } = makeEngine();
  engine.setMode(modeId);
  const usePressure = modeId === 'perfect-freehand';
  const [first, ...rest] = points;
  engine.strokeStart(first.x, first.y, usePressure ? first.pressure : undefined);
  rest.forEach((p) => engine.strokeMove(p.x, p.y, usePressure ? p.pressure : undefined));
  return engine.strokeEnd();
}

// A single bounded, finite point. Pressure is always generated but only
// consumed by the pressure-aware mode (see produceStroke).
const pointArb = fc.record({
  x: fc.double({
    min: 0, max: 300, noNaN: true, noDefaultInfinity: true,
  }),
  y: fc.double({
    min: 0, max: 300, noNaN: true, noDefaultInfinity: true,
  }),
  pressure: fc.double({
    min: 0, max: 1, noNaN: true, noDefaultInfinity: true,
  }),
});

// A (mode, points) pair: a randomly chosen mode with a random, non-empty,
// bounded point stream appropriate to that mode.
const modeStrokeArb = fc.record({
  mode: fc.constantFrom(...MODE_IDS),
  points: fc.array(pointArb, { minLength: 1, maxLength: 8 }),
});

// A random-length sequence of (mode, stroke) pairs forming one document.
const sequenceArb = fc.array(modeStrokeArb, { minLength: 1, maxLength: 10 });

describe('Property: Mode isolation (Req 5.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replays every stroke under its own mode regardless of position in the sequence', () => {
    fc.assert(
      fc.property(sequenceArb, (sequence) => {
        // Build one document from the sequence; each stroke is produced (and
        // tagged) under its own mode on a throwaway engine.
        const strokes = sequence.map(({ mode, points }) => produceStroke(mode, points));

        const { engine } = makeEngine();

        // Instrument every registered mode's replay so we capture a single,
        // globally ordered log of (which mode was invoked, with which stroke)
        // while still performing the real replay.
        const callLog = [];
        MODE_IDS.forEach((id) => {
          const mode = engine._registry.get(id);
          const original = mode.replay.bind(mode);
          vi.spyOn(mode, 'replay').mockImplementation((stroke, ctx) => {
            callLog.push({ id, stroke });
            return original(stroke, ctx);
          });
        });

        engine.setDocument({
          drawDocumentVersion: '1.1',
          defaultMode: 'classic',
          strokes,
        });

        // Isolation/routing: the ordered list of (mode, stroke) invocations
        // matches the input sequence exactly — same count, same order, each
        // stroke dispatched to the mode whose id matches its own tag and never
        // to a different mode.
        expect(callLog).toHaveLength(strokes.length);
        callLog.forEach((entry, i) => {
          expect(entry.stroke).toBe(strokes[i]);
          expect(entry.id).toBe(strokes[i].mode);
          expect(entry.id).toBe(sequence[i].mode);
        });
      }),
      { numRuns: 80 },
    );
  });

  it('renders a mixed document identically to concatenating each stroke replayed alone (order independence)', () => {
    fc.assert(
      fc.property(sequenceArb, (sequence) => {
        const strokes = sequence.map(({ mode, points }) => produceStroke(mode, points));

        // Replay the whole mixed document onto one context.
        const mixed = makeEngine();
        mixed.engine.setDocument({
          drawDocumentVersion: '1.1',
          defaultMode: 'classic',
          strokes,
        });
        // Drop the leading clearRect emitted by redraw() so we compare only the
        // committed stroke geometry.
        const mixedCalls = mixed.ctx.calls.filter((c) => c.method !== 'clearRect');

        // Replay each stroke on its own, under its own mode, and concatenate the
        // committed calls in the same order.
        const isolatedCalls = [];
        strokes.forEach((stroke) => {
          const solo = makeEngine();
          solo.engine.setDocument({
            drawDocumentVersion: '1.1',
            defaultMode: 'classic',
            strokes: [stroke],
          });
          solo.ctx.calls
            .filter((c) => c.method !== 'clearRect')
            .forEach((c) => isolatedCalls.push(c));
        });

        // A stroke's committed rendering does not depend on its neighbours.
        expect(mixedCalls).toEqual(isolatedCalls);
      }),
      { numRuns: 80 },
    );
  });
});

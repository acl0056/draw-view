import {
  describe, it, expect, vi, afterEach,
} from 'vitest';
import { SquareBezierMode } from '../src/modes/SquareBezierMode.js';
import { createFakeContext } from './fake-canvas-context.js';

/**
 * Regression tests for real-timestamp threading in SquareBezierMode.
 *
 * The mode derives per-stamp width from pen velocity (distance / dt). When the
 * consumer feeds coalesced pointer events in one synchronous loop, stamping the
 * processing-time clock (`_now()`) onto every point collapses dt to 0 within a
 * batch and spikes it at batch boundaries, producing erratic widths. The fix
 * threads each input event's real timestamp (PointerEvent.timeStamp) through as
 * the point's own `time`, and the mode must honor it when present, only falling
 * back to `_now()` when it is absent.
 *
 * _Requirements: 3.2_
 */

const COLOR = 'rgba(0,0,0';

/** Drive a full stroke directly against the mode with the given points. */
function drawStroke(mode, ctx, first, moves, style = {}) {
  mode.begin(first, { ctx, colorPrefix: COLOR, ...style });
  moves.forEach((p) => mode.addPoint(p));
  return mode.end();
}

describe('SquareBezierMode timestamp threading (Req 3.2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses provided point timestamps and never falls back to _now()', () => {
    const mode = new SquareBezierMode();
    const nowSpy = vi.spyOn(mode, '_now');
    const ctx = createFakeContext();

    const stroke = drawStroke(mode, ctx, { x: 0, y: 0, time: 1000 }, [
      { x: 10, y: 5, time: 1016 },
      { x: 20, y: 0, time: 1032 },
      { x: 30, y: 8, time: 1048 },
    ]);

    // Every point carried an explicit time, so the wall-clock seam is untouched.
    expect(nowSpy).not.toHaveBeenCalled();
    // The stored points reflect the provided timestamps verbatim.
    expect(stroke.points.map((p) => p.time)).toEqual([1000, 1016, 1032, 1048]);
  });

  it('derives different widths from different time spacing at identical coordinates', () => {
    const options = {
      minWidth: 0.5, maxWidth: 10, velocityFilterWeight: 1, dotSize: 0,
    };
    const coords = [
      { x: 200, y: 0 },
      { x: 400, y: 0 },
    ];

    // Tightly spaced times => large dt-normalized distance => high velocity.
    const fastMode = new SquareBezierMode();
    const fastNow = vi.spyOn(fastMode, '_now');
    const fast = drawStroke(fastMode, createFakeContext(), { x: 0, y: 0, time: 0 }, [
      { ...coords[0], time: 2 },
      { ...coords[1], time: 4 },
    ], { options });

    // Widely spaced times => same distance over more ms => low velocity.
    const slowMode = new SquareBezierMode();
    const slowNow = vi.spyOn(slowMode, '_now');
    const slow = drawStroke(slowMode, createFakeContext(), { x: 0, y: 0, time: 0 }, [
      { ...coords[0], time: 1000 },
      { ...coords[1], time: 2000 },
    ], { options });

    expect(fastNow).not.toHaveBeenCalled();
    expect(slowNow).not.toHaveBeenCalled();

    const fastWidth = fast.points[fast.points.length - 1].width;
    const slowWidth = slow.points[slow.points.length - 1].width;
    // Higher velocity yields a narrower stroke; the width responds to the
    // provided time spacing rather than collapsing.
    expect(fastWidth).toBeLessThan(slowWidth);
  });

  it('falls back to _now() for points without a time (backward compatibility)', () => {
    const mode = new SquareBezierMode();
    let t = 5000;
    const nowSpy = vi.spyOn(mode, '_now').mockImplementation(() => {
      const now = t;
      t += 10;
      return now;
    });
    const ctx = createFakeContext();

    const stroke = drawStroke(mode, ctx, { x: 0, y: 0 }, [
      { x: 5, y: 5 },
      { x: 10, y: 0 },
    ]);

    expect(nowSpy).toHaveBeenCalled();
    expect(stroke.points.map((p) => p.time)).toEqual([5000, 5010, 5020]);
  });
});

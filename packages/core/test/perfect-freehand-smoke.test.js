import { describe, it, expect } from 'vitest';
import { ModeRegistry, registerBuiltInModes, PerfectFreehandMode } from '../src/index.js';
import { createFakeContext } from './fake-canvas-context.js';

// Lightweight smoke coverage for PerfectFreehandMode (full unit tests are task 5.3).
describe('PerfectFreehandMode smoke', () => {
  const COLOR = 'rgba(0,0,0';

  it('is registered under id "perfect-freehand" by registerBuiltInModes', () => {
    const registry = registerBuiltInModes(new ModeRegistry());
    const mode = registry.get('perfect-freehand');
    expect(mode).toBeInstanceOf(PerfectFreehandMode);
    expect(mode.id).toBe('perfect-freehand');
  });

  it('emits a well-formed stroke tagged perfect-freehand with pressure + options', () => {
    const mode = new PerfectFreehandMode();
    const ctx = createFakeContext();

    mode.begin({ x: 0, y: 0, pressure: 0.4 }, { ctx, colorPrefix: COLOR });
    mode.addPoint({ x: 10, y: 5, pressure: 0.6 });
    mode.addPoint({ x: 20, y: 0, pressure: 0.5 });
    const stroke = mode.end();

    expect(stroke.mode).toBe('perfect-freehand');
    expect(stroke.color).toBe(COLOR);
    expect(stroke.options).toMatchObject({
      size: expect.any(Number),
      thinning: expect.any(Number),
      smoothing: expect.any(Number),
      streamline: expect.any(Number),
    });
    expect(stroke.points.length).toBe(3);
    stroke.points.forEach((p) => {
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
      expect(typeof p.pressure).toBe('number');
    });
  });

  it('fills the outline onto the main context exactly once at end()', () => {
    const mode = new PerfectFreehandMode();
    const ctx = createFakeContext();

    mode.begin({ x: 0, y: 0 }, { ctx, colorPrefix: COLOR });
    mode.addPoint({ x: 10, y: 5 });
    mode.addPoint({ x: 20, y: 0 });
    // No commit to the main context before end().
    expect(ctx.callsFor('fill').length).toBe(0);

    mode.end();
    expect(ctx.callsFor('fill').length).toBe(1);
    expect(ctx.callsFor('moveTo').length).toBe(1);
    expect(ctx.callsFor('lineTo').length).toBeGreaterThan(0);
  });

  it('paints the evolving outline only on the temp overlay during the stroke', () => {
    const mode = new PerfectFreehandMode();
    const ctx = createFakeContext();
    const tempCtx = createFakeContext();

    mode.begin({ x: 0, y: 0 }, { ctx, tempCtx, colorPrefix: COLOR });
    mode.addPoint({ x: 10, y: 5 });
    mode.addPoint({ x: 20, y: 0 });

    const committedBefore = [...ctx.calls];
    mode.renderPreview(tempCtx);

    expect(ctx.calls).toEqual(committedBefore);
    expect(tempCtx.callsFor('fill').length).toBeGreaterThan(0);
    expect(tempCtx.callsFor('clearRect').length).toBeGreaterThan(0);
  });

  it('substitutes a default pressure when a point lacks one', () => {
    const mode = new PerfectFreehandMode();
    const ctx = createFakeContext();

    mode.begin({ x: 0, y: 0 }, { ctx, colorPrefix: COLOR });
    mode.addPoint({ x: 10, y: 5 });
    const stroke = mode.end();

    stroke.points.forEach((p) => {
      expect(typeof p.pressure).toBe('number');
      expect(p.pressure).toBeGreaterThan(0);
    });
  });

  it('replays a serialized stroke onto a fresh main context', () => {
    const drawCtx = createFakeContext();
    const mode = new PerfectFreehandMode();
    mode.begin({ x: 0, y: 0, pressure: 0.5 }, { ctx: drawCtx, colorPrefix: COLOR });
    mode.addPoint({ x: 12, y: 6, pressure: 0.5 });
    mode.addPoint({ x: 24, y: 0, pressure: 0.5 });
    const stroke = mode.end();

    const replayCtx = createFakeContext();
    mode.replay(stroke, replayCtx);

    expect(replayCtx.callsFor('fill').length).toBe(1);
    expect(replayCtx.callsFor('moveTo').length).toBe(1);
    expect(replayCtx.callsFor('lineTo').length).toBeGreaterThan(0);
  });
});

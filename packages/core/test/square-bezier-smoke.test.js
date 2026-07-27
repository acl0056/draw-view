import { describe, it, expect } from 'vitest';
import { ModeRegistry, registerBuiltInModes, SquareBezierMode } from '../src/index.js';
import { createFakeContext } from './fake-canvas-context.js';

// Lightweight smoke coverage for SquareBezierMode (full unit tests are task 4.2).
describe('SquareBezierMode smoke', () => {
  it('is registered under id "square-bezier" by registerBuiltInModes', () => {
    const registry = registerBuiltInModes(new ModeRegistry());
    const mode = registry.get('square-bezier');
    expect(mode).toBeInstanceOf(SquareBezierMode);
    expect(mode.id).toBe('square-bezier');
  });

  it('emits a well-formed stroke tagged square-bezier with timed points', () => {
    const mode = new SquareBezierMode();
    const ctx = createFakeContext();
    const style = { ctx, colorPrefix: 'rgba(0,0,0' };

    mode.begin({ x: 0, y: 0 }, style);
    mode.addPoint({ x: 10, y: 5 });
    mode.addPoint({ x: 20, y: 0 });
    mode.addPoint({ x: 30, y: 8 });
    const stroke = mode.end();

    expect(stroke.mode).toBe('square-bezier');
    expect(stroke.color).toBe('rgba(0,0,0');
    expect(stroke.options).toMatchObject({
      minWidth: expect.any(Number),
      maxWidth: expect.any(Number),
      velocityFilterWeight: expect.any(Number),
      dotSize: expect.any(Number),
    });
    expect(stroke.points.length).toBe(4);
    stroke.points.forEach((p) => {
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
      expect(typeof p.time).toBe('number');
      expect(p.width).toBeGreaterThanOrEqual(stroke.options.minWidth);
      expect(p.width).toBeLessThanOrEqual(stroke.options.maxWidth);
    });
  });

  it('commits filled arc stamps to the main context during a stroke', () => {
    const mode = new SquareBezierMode();
    const ctx = createFakeContext();
    mode.begin({ x: 0, y: 0 }, { ctx, colorPrefix: 'rgba(0,0,0' });
    mode.addPoint({ x: 10, y: 5 });
    mode.addPoint({ x: 20, y: 0 });
    mode.end();

    expect(ctx.callsFor('arc').length).toBeGreaterThan(0);
    expect(ctx.callsFor('fill').length).toBeGreaterThan(0);
  });

  it('replays a serialized stroke onto a fresh main context', () => {
    const drawCtx = createFakeContext();
    const mode = new SquareBezierMode();
    mode.begin({ x: 0, y: 0 }, { ctx: drawCtx, colorPrefix: 'rgba(0,0,0' });
    mode.addPoint({ x: 12, y: 6 });
    mode.addPoint({ x: 24, y: 0 });
    mode.addPoint({ x: 36, y: 9 });
    const stroke = mode.end();

    const replayCtx = createFakeContext();
    mode.replay(stroke, replayCtx);

    expect(replayCtx.callsFor('arc').length).toBeGreaterThan(0);
    expect(replayCtx.callsFor('fill').length).toBeGreaterThan(0);
  });

  it('renders a lone point as a single dot', () => {
    const mode = new SquareBezierMode();
    const ctx = createFakeContext();
    const stroke = mode.tap({ x: 5, y: 5 }, { ctx, colorPrefix: 'rgba(0,0,0' });

    expect(stroke.mode).toBe('square-bezier');
    expect(stroke.points.length).toBe(1);
    expect(ctx.callsFor('arc').length).toBe(1);
  });
});

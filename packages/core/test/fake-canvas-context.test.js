import { describe, it, expect } from 'vitest';
import { createFakeContext } from './fake-canvas-context.js';

describe('createFakeContext', () => {
  it('records the draw calls in order with their arguments', () => {
    const ctx = createFakeContext();

    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.lineTo(3, 4);
    ctx.arc(5, 6, 7, 0, Math.PI * 2, false);
    ctx.fill();

    expect(ctx.calls).toEqual([
      { method: 'beginPath', args: [] },
      { method: 'moveTo', args: [1, 2] },
      { method: 'lineTo', args: [3, 4] },
      { method: 'arc', args: [5, 6, 7, 0, Math.PI * 2, false] },
      { method: 'fill', args: [] },
    ]);
  });

  it('records clearRect calls', () => {
    const ctx = createFakeContext({ width: 100, height: 50 });
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    expect(ctx.callsFor('clearRect')).toEqual([
      { method: 'clearRect', args: [0, 0, 100, 50] },
    ]);
  });

  it('returns a gradient stub from createRadialGradient and records both calls', () => {
    const ctx = createFakeContext();
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 3);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');

    expect(ctx.callsFor('createRadialGradient')).toHaveLength(1);
    expect(ctx.callsFor('addColorStop')).toEqual([
      { method: 'addColorStop', args: [0, 'rgba(0,0,0,1)'] },
      { method: 'addColorStop', args: [1, 'rgba(0,0,0,0)'] },
    ]);
  });

  it('drives the real DrawEngine without touching a real canvas', async () => {
    const { DrawEngine } = await import('../src/DrawEngine.js');
    const ctx = createFakeContext();
    const engine = new DrawEngine({ ctx });

    engine.strokeTap(10, 20);

    // A tap stamps a radial-gradient dot: gradient created, arc + fill emitted.
    expect(ctx.callsFor('createRadialGradient')).toHaveLength(1);
    expect(ctx.callsFor('arc')).toHaveLength(1);
    expect(ctx.callsFor('fill')).toHaveLength(1);
  });

  it('reset clears the recorded call log', () => {
    const ctx = createFakeContext();
    ctx.beginPath();
    ctx.reset();
    expect(ctx.calls).toHaveLength(0);
  });
});

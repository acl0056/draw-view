import {
  describe, it, expect, vi, afterEach,
} from 'vitest';
import { DrawEngine } from '../src/DrawEngine.js';
import { createFakeContext } from './fake-canvas-context.js';

/**
 * Unit tests for the DrawEngine mode-selection API (task 2.4):
 * constructor default, known/unknown constructor ids, setMode/getMode
 * round-trip, unknown-id setMode handling, and mid-stroke isolation.
 *
 * _Requirements: 1.2, 1.3, 1.4, 7.2_
 */

/**
 * A recording stub DrawingMode used to prove which mode handled a stroke.
 * It satisfies enough of the DrawingMode contract for the engine to drive it
 * and records the lifecycle calls it receives so tests can assert that a
 * mid-stroke setMode() does not divert an in-progress stroke to a new mode.
 */
function createRecordingMode(id) {
  const events = [];
  return {
    id,
    events,
    begin(point, style) {
      events.push({ method: 'begin', point, style });
    },
    addPoint(point) {
      events.push({ method: 'addPoint', point });
    },
    renderPreview(tempCtx) {
      events.push({ method: 'renderPreview', tempCtx });
    },
    end() {
      events.push({ method: 'end' });
      return { mode: id, points: [], color: 'rgba(0,0,0' };
    },
    replay(stroke, ctx) {
      events.push({ method: 'replay', stroke, ctx });
    },
  };
}

function makeEngine(options = {}) {
  const ctx = createFakeContext();
  const tempCtx = createFakeContext();
  const engine = new DrawEngine({ ctx, tempCtx, ...options });
  return { engine, ctx, tempCtx };
}

describe('DrawEngine mode-selection API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor default and initial mode (Req 1.2)', () => {
    it('defaults to classic when no mode option is given', () => {
      const { engine } = makeEngine();

      expect(engine.getMode()).toBe('classic');
    });

    it('activates a known mode id supplied to the constructor', () => {
      const { engine } = makeEngine({ mode: 'classic' });

      expect(engine.getMode()).toBe('classic');
    });

    it('falls back to classic when the constructor mode id is unknown', () => {
      const { engine } = makeEngine({ mode: 'does-not-exist' });

      expect(engine.getMode()).toBe('classic');
    });
  });

  describe('setMode / getMode round-trip (Req 1.3, 1.4)', () => {
    it('switches getMode() to a known id and returns the new id', () => {
      const { engine } = makeEngine();
      const stub = createRecordingMode('stub-mode');
      engine._registry.register(stub);

      const returned = engine.setMode('stub-mode');

      expect(returned).toBe('stub-mode');
      expect(engine.getMode()).toBe('stub-mode');
    });
  });

  describe('unknown-id setMode (Req 7.2)', () => {
    it('keeps the current mode, returns the current id, and warns once', () => {
      const { engine } = makeEngine();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const returned = engine.setMode('nope');

      expect(returned).toBe('classic');
      expect(engine.getMode()).toBe('classic');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('nope');
    });
  });

  describe('mid-stroke mode switch isolation (Req 1.3)', () => {
    it('keeps an in-progress stroke on its original mode when setMode is called mid-stroke', () => {
      const { engine } = makeEngine();
      const stub = createRecordingMode('stub-mode');
      engine._registry.register(stub);

      // Start a stroke under the default classic mode.
      engine.strokeStart(10, 10);
      // Switch the active mode mid-stroke; the in-progress stroke must not move.
      engine.setMode('stub-mode');
      engine.strokeMove(20, 20);
      engine.strokeMove(30, 30);
      const stroke = engine.strokeEnd();

      // The active mode changed for the NEXT stroke...
      expect(engine.getMode()).toBe('stub-mode');
      // ...but the just-completed stroke never touched the stub mode.
      expect(stub.events).toEqual([]);
      // The completed stroke is tagged with the mode that produced it (the
      // classic mode captured at strokeStart), not the switched-to stub mode.
      expect(stroke.mode).toBe('classic');
      expect(stroke).toHaveProperty('points');
    });

    it('applies the switched-to mode only to strokes started after the switch', () => {
      const { engine } = makeEngine();
      const stub = createRecordingMode('stub-mode');
      engine._registry.register(stub);

      // First stroke under classic, switch mid-stroke, finish under classic.
      engine.strokeStart(10, 10);
      engine.setMode('stub-mode');
      engine.strokeMove(20, 20);
      engine.strokeEnd();

      expect(stub.events).toEqual([]);

      // The next stroke is handled entirely by the stub mode.
      engine.strokeStart(40, 40);
      engine.strokeMove(50, 50);
      const secondStroke = engine.strokeEnd();

      const methods = stub.events.map((e) => e.method);
      expect(methods).toEqual(['begin', 'addPoint', 'end']);
      expect(secondStroke.mode).toBe('stub-mode');
    });
  });
});

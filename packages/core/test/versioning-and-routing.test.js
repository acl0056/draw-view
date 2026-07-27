import {
  describe, it, expect, vi, afterEach,
} from 'vitest';
import { DrawEngine } from '../src/DrawEngine.js';
import { createFakeContext } from './fake-canvas-context.js';

/**
 * Unit tests for document versioning, stroke tagging, and replay routing
 * (task 7.3).
 *
 * Coverage:
 *  - New documents (fresh engine and after clear()) are `1.1` with a
 *    document-level `defaultMode`, and strokes produced via strokeEnd/strokeTap
 *    are tagged with their producing mode id (classic -> 'classic'; the two new
 *    modes self-tag 'square-bezier' / 'perfect-freehand').  [Req 5.1]
 *  - A `1.0` document (version '1.0', strokes without a `mode` field) loaded via
 *    setDocument renders EVERY stroke as classic, matching pre-feature output
 *    (classic stamps radial-gradient arcs).                    [Req 5.2, 5.3]
 *  - A mixed-mode `1.1` document routes each stroke to the mode that produced
 *    it: replay is dispatched to the matching registered mode and each mode's
 *    committed effect is its own (classic radial-gradient arcs, square-bezier
 *    plain arc stamps, perfect-freehand a single filled outline path).  [Req 5.4]
 *  - An unknown-mode stroke falls back to the default/classic mode, logs a
 *    single warning, and RETAINS its original `mode` tag after redraw.  [Req 7.1]
 *
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1_
 */

/** Build an engine wired to fresh recording contexts. */
function makeEngine(options = {}) {
  const ctx = createFakeContext();
  const tempCtx = createFakeContext();
  const engine = new DrawEngine({ ctx, tempCtx, ...options });
  return { engine, ctx, tempCtx };
}

// Deterministic input shapes long enough for each mode to commit geometry.
const CLASSIC_POINTS = [
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
];

const BEZIER_POINTS = [
  { x: 10, y: 10 },
  { x: 30, y: 25 },
  { x: 55, y: 20 },
  { x: 80, y: 40 },
  { x: 110, y: 30 },
];

const FREEHAND_POINTS = [
  { x: 10, y: 10, pressure: 0.4 },
  { x: 25, y: 18, pressure: 0.6 },
  { x: 45, y: 12, pressure: 0.5 },
  { x: 65, y: 24, pressure: 0.7 },
];

/**
 * Draw a full stroke under the given mode on a throwaway engine and return the
 * finished serializable stroke (already tagged with its producing mode id).
 * @param {string} modeId
 * @param {Array<{x:number,y:number,pressure?:number}>} points
 * @returns {object}
 */
/**
 * Return a shallow copy of a stroke with its `mode` tag removed, simulating a
 * pre-feature 1.0 stroke that carries no mode field.
 * @param {object} stroke
 * @returns {object}
 */
function stripMode(stroke) {
  const copy = { ...stroke };
  delete copy.mode;
  return copy;
}

function produceStroke(modeId, points) {
  const { engine } = makeEngine();
  engine.setMode(modeId);
  const [first, ...rest] = points;
  engine.strokeStart(first.x, first.y, first.pressure);
  rest.forEach((p) => engine.strokeMove(p.x, p.y, p.pressure));
  return engine.strokeEnd();
}

describe('DrawEngine document versioning and replay routing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('new documents are 1.1 with a defaultMode (Req 5.1)', () => {
    it('creates a fresh document at version 1.1 with defaultMode classic', () => {
      const { engine } = makeEngine();

      const doc = engine.getDocument();
      expect(doc.drawDocumentVersion).toBe('1.1');
      expect(doc.defaultMode).toBe('classic');
    });

    it('honors a custom constructor defaultMode on the new document', () => {
      const { engine } = makeEngine({ defaultMode: 'square-bezier' });

      expect(engine.getDocument().defaultMode).toBe('square-bezier');
    });

    it('resets to a fresh 1.1 document with a defaultMode after clear()', () => {
      const { engine } = makeEngine();
      engine.strokeTap(10, 10);
      expect(engine.getDocument().strokes).toHaveLength(1);

      engine.clear();

      const doc = engine.getDocument();
      expect(doc.drawDocumentVersion).toBe('1.1');
      expect(doc.defaultMode).toBe('classic');
      expect(doc.strokes ?? []).toHaveLength(0);
    });
  });

  describe('strokes are tagged with their producing mode (Req 5.1)', () => {
    it('tags a classic strokeEnd stroke with mode "classic"', () => {
      const { engine } = makeEngine();
      engine.strokeStart(10, 10);
      engine.strokeMove(20, 15);
      engine.strokeMove(30, 20);
      const stroke = engine.strokeEnd();

      expect(stroke.mode).toBe('classic');
      expect(engine.getDocument().strokes[0].mode).toBe('classic');
    });

    it('tags a classic strokeTap stroke with mode "classic"', () => {
      const { engine } = makeEngine();
      const stroke = engine.strokeTap(42, 42);

      expect(stroke.mode).toBe('classic');
    });

    it('tags strokes with square-bezier and perfect-freehand after switching modes', () => {
      const { engine } = makeEngine();

      engine.setMode('square-bezier');
      engine.strokeStart(10, 10);
      engine.strokeMove(20, 15);
      engine.strokeMove(30, 20);
      const bezier = engine.strokeEnd();

      engine.setMode('perfect-freehand');
      engine.strokeStart(50, 50, 0.5);
      engine.strokeMove(60, 55, 0.5);
      engine.strokeMove(70, 60, 0.5);
      const freehand = engine.strokeEnd();

      expect(bezier.mode).toBe('square-bezier');
      expect(freehand.mode).toBe('perfect-freehand');
      expect(engine.getDocument().strokes.map((s) => s.mode)).toEqual([
        'square-bezier',
        'perfect-freehand',
      ]);
    });
  });

  describe('1.0 documents render every stroke as classic (Req 5.2, 5.3)', () => {
    it('replays an untagged 1.0 stroke with classic radial-gradient arc stamps', () => {
      // Build a classic stroke, then strip its mode tag and wrap it in a 1.0
      // document to simulate a pre-feature save.
      const classicStroke = produceStroke('classic', CLASSIC_POINTS);
      const legacyDoc = {
        drawDocumentVersion: '1.0',
        strokes: [stripMode(classicStroke)],
      };

      const { engine, ctx } = makeEngine();
      const classicReplay = vi.spyOn(engine._registry.get('classic'), 'replay');
      const bezierReplay = vi.spyOn(engine._registry.get('square-bezier'), 'replay');
      const freehandReplay = vi.spyOn(engine._registry.get('perfect-freehand'), 'replay');

      engine.setDocument(legacyDoc);

      // Routed to classic and nothing else...
      expect(classicReplay).toHaveBeenCalledTimes(1);
      expect(bezierReplay).not.toHaveBeenCalled();
      expect(freehandReplay).not.toHaveBeenCalled();
      // ...and the committed output is the classic radial-gradient dot stamps.
      expect(ctx.callsFor('createRadialGradient').length).toBeGreaterThan(0);
      expect(ctx.callsFor('arc').length).toBeGreaterThan(0);
      expect(ctx.callsFor('fill').length).toBeGreaterThan(0);
    });

    it('renders a multi-stroke 1.0 document entirely through classic', () => {
      const strokeA = produceStroke('classic', CLASSIC_POINTS);
      const strokeB = produceStroke('classic', BEZIER_POINTS);
      const legacyDoc = {
        drawDocumentVersion: '1.0',
        strokes: [stripMode(strokeA), stripMode(strokeB)],
      };

      const { engine } = makeEngine();
      const classicReplay = vi.spyOn(engine._registry.get('classic'), 'replay');
      const bezierReplay = vi.spyOn(engine._registry.get('square-bezier'), 'replay');
      const freehandReplay = vi.spyOn(engine._registry.get('perfect-freehand'), 'replay');

      engine.setDocument(legacyDoc);

      expect(classicReplay).toHaveBeenCalledTimes(2);
      expect(bezierReplay).not.toHaveBeenCalled();
      expect(freehandReplay).not.toHaveBeenCalled();
    });
  });

  describe('mixed-mode documents route each stroke to its own mode (Req 5.4)', () => {
    it('dispatches replay to the mode matching each stroke tag', () => {
      const classicStroke = produceStroke('classic', CLASSIC_POINTS);
      const bezierStroke = produceStroke('square-bezier', BEZIER_POINTS);
      const freehandStroke = produceStroke('perfect-freehand', FREEHAND_POINTS);

      const { engine, ctx } = makeEngine();
      const classicMode = engine._registry.get('classic');
      const bezierMode = engine._registry.get('square-bezier');
      const freehandMode = engine._registry.get('perfect-freehand');
      const classicReplay = vi.spyOn(classicMode, 'replay');
      const bezierReplay = vi.spyOn(bezierMode, 'replay');
      const freehandReplay = vi.spyOn(freehandMode, 'replay');

      engine.setDocument({
        drawDocumentVersion: '1.1',
        defaultMode: 'classic',
        strokes: [classicStroke, bezierStroke, freehandStroke],
      });

      // Each stroke reached exactly its own mode, with the stroke and the main
      // context passed through.
      expect(classicReplay).toHaveBeenCalledTimes(1);
      expect(classicReplay).toHaveBeenCalledWith(classicStroke, ctx);
      expect(bezierReplay).toHaveBeenCalledTimes(1);
      expect(bezierReplay).toHaveBeenCalledWith(bezierStroke, ctx);
      expect(freehandReplay).toHaveBeenCalledTimes(1);
      expect(freehandReplay).toHaveBeenCalledWith(freehandStroke, ctx);
    });

    it('produces each mode\'s own committed effect on replay', () => {
      // Replay each stroke in isolation so the committed calls are attributable
      // to a single mode.
      const classicStroke = produceStroke('classic', CLASSIC_POINTS);
      const bezierStroke = produceStroke('square-bezier', BEZIER_POINTS);
      const freehandStroke = produceStroke('perfect-freehand', FREEHAND_POINTS);

      const replayOne = (stroke) => {
        const { engine, ctx } = makeEngine();
        engine.setDocument({ drawDocumentVersion: '1.1', strokes: [stroke] });
        return ctx;
      };

      // Classic: radial-gradient dot stamps.
      const classicCtx = replayOne(classicStroke);
      expect(classicCtx.callsFor('createRadialGradient').length).toBeGreaterThan(0);
      expect(classicCtx.callsFor('arc').length).toBeGreaterThan(0);

      // Square-bezier: plain arc stamps, no radial gradient.
      const bezierCtx = replayOne(bezierStroke);
      expect(bezierCtx.callsFor('arc').length).toBeGreaterThan(0);
      expect(bezierCtx.callsFor('createRadialGradient')).toHaveLength(0);

      // Perfect-freehand: a single filled outline path (moveTo + lineTo, one
      // fill), no arc stamping.
      const freehandCtx = replayOne(freehandStroke);
      expect(freehandCtx.callsFor('fill')).toHaveLength(1);
      expect(freehandCtx.callsFor('moveTo')).toHaveLength(1);
      expect(freehandCtx.callsFor('lineTo').length).toBeGreaterThan(0);
      expect(freehandCtx.callsFor('arc')).toHaveLength(0);
    });

    it('routes strokes to their own mode regardless of document order', () => {
      const classicStroke = produceStroke('classic', CLASSIC_POINTS);
      const bezierStroke = produceStroke('square-bezier', BEZIER_POINTS);
      const freehandStroke = produceStroke('perfect-freehand', FREEHAND_POINTS);

      const { engine } = makeEngine();
      const classicReplay = vi.spyOn(engine._registry.get('classic'), 'replay');
      const bezierReplay = vi.spyOn(engine._registry.get('square-bezier'), 'replay');
      const freehandReplay = vi.spyOn(engine._registry.get('perfect-freehand'), 'replay');

      engine.setDocument({
        drawDocumentVersion: '1.1',
        defaultMode: 'classic',
        strokes: [freehandStroke, classicStroke, bezierStroke, freehandStroke],
      });

      expect(freehandReplay).toHaveBeenCalledTimes(2);
      expect(classicReplay).toHaveBeenCalledTimes(1);
      expect(bezierReplay).toHaveBeenCalledTimes(1);
    });
  });

  describe('unknown-mode strokes fall back and retain their tag (Req 7.1)', () => {
    it('falls back to the default/classic mode, warns once, and keeps the mode tag', () => {
      const classicStroke = produceStroke('classic', CLASSIC_POINTS);
      const unknownStroke = { ...classicStroke, mode: 'no-such-mode' };

      const { engine, ctx } = makeEngine();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const classicReplay = vi.spyOn(engine._registry.get('classic'), 'replay');

      engine.setDocument({
        drawDocumentVersion: '1.1',
        defaultMode: 'classic',
        strokes: [unknownStroke],
      });

      // Fell back to classic and rendered the stroke...
      expect(classicReplay).toHaveBeenCalledTimes(1);
      expect(ctx.callsFor('createRadialGradient').length).toBeGreaterThan(0);
      // ...logged a single warning naming the missing id...
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('no-such-mode');
      // ...and preserved the original mode tag on the stored stroke.
      expect(engine.getDocument().strokes[0].mode).toBe('no-such-mode');
    });

    it('warns only once for the same unknown id across repeated redraws', () => {
      const classicStroke = produceStroke('classic', CLASSIC_POINTS);
      const unknownStroke = { ...classicStroke, mode: 'ghost-mode' };

      const { engine } = makeEngine();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      engine.setDocument({
        drawDocumentVersion: '1.1',
        strokes: [unknownStroke],
      });
      engine.redraw();
      engine.redraw();

      expect(warn).toHaveBeenCalledTimes(1);
      // The tag survives every redraw so re-saving preserves it.
      expect(engine.getDocument().strokes[0].mode).toBe('ghost-mode');
    });
  });
});

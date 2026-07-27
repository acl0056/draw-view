import {
  describe, it, expect, vi,
} from 'vitest';
import fc from 'fast-check';
import { DrawEngine } from '../src/DrawEngine.js';
import { createFakeContext } from './fake-canvas-context.js';

/**
 * Property-based backward-compatibility test (task 10.3).
 *
 * **Property: Backward compatibility** — a randomly generated `1.0`-shaped
 * document (strokes of `{ color, points: [{ x, y, width }] }`, no per-stroke
 * `mode`, no document `defaultMode`) replays IDENTICALLY to explicitly
 * replaying every stroke through the classic mode. Because the classic mode is
 * the definition of pre-feature behavior, this establishes that loading a 1.0
 * document after the feature change produces exactly the pre-change rendering.
 *
 * There is no pre-change build to diff at runtime, so the property is
 * formulated as an equivalence: for the same strokes,
 *   setDocument(1.0 doc, untagged)  ===  setDocument(doc, every stroke mode:'classic')
 * comparing the full recorded draw-call sequence on a fake context.
 *
 * The test also asserts that loading a 1.0 document emits NO console.warn — an
 * absent `mode` is not an "unknown id" and must resolve silently to classic.
 *
 * **Validates: Requirements 5.3**
 */

// Bounded, finite coordinate/width generators keep the classic curve-fitting
// math well-defined while still exploring a wide input space.
const finite = (min, max) => fc.double({
  min,
  max,
  noNaN: true,
  noDefaultInfinity: true,
});

// A signed step magnitude of at least 2px. Genuine 1.0 strokes are produced by
// the classic `end()` path, which only serializes points that survived the
// VertexQueue dedup (consecutive points spaced > 1px apart). Generating points
// as a path of >=2px steps keeps consecutive spacing above that threshold, so
// the generated documents match the real 1.0 input space rather than degenerate
// clusters the engine could never have emitted.
const signedStep = fc
  .tuple(finite(2, 40), fc.boolean())
  .map(([magnitude, negative]) => (negative ? -magnitude : magnitude));

// A per-step delta plus width. `removed` is optional (sometimes present as
// `false`), matching the shape older documents may carry.
const stepArb = fc.record(
  {
    dx: signedStep,
    dy: signedStep,
    width: finite(0.5, 10),
    removed: fc.constant(false),
  },
  { requiredKeys: ['dx', 'dy', 'width'] },
);

// A `rgba(r,g,b` prefix string, exactly the color shape 1.0 strokes use.
const colorArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
  )
  .map(([r, g, b]) => `rgba(${r},${g},${b}`);

/**
 * Fold a start point and a list of >=2px steps into an ordered `{ x, y, width }`
 * point path with consecutive spacing above the dedup threshold.
 */
const buildPoints = (start, steps) => {
  const points = [{ x: start.x, y: start.y, width: start.width }];
  let prev = points[0];
  steps.forEach((step) => {
    const point = { x: prev.x + step.dx, y: prev.y + step.dy, width: step.width };
    if (step.removed !== undefined) point.removed = step.removed;
    points.push(point);
    prev = point;
  });
  return points;
};

// A 1.0 stroke: color + varied-length points (including short strokes of 1, 2,
// and 3 points), with NO `mode` tag.
const strokeArb = fc
  .record({
    color: colorArb,
    start: fc.record({ x: finite(-400, 400), y: finite(-400, 400), width: finite(0.5, 10) }),
    steps: fc.array(stepArb, { minLength: 0, maxLength: 11 }),
  })
  .map(({ color, start, steps }) => ({ color, points: buildPoints(start, steps) }));

// A 1.0 document: one or more strokes, no document-level `defaultMode`.
const legacyDocArb = fc.array(strokeArb, { minLength: 1, maxLength: 5 });

/** Deep-clone a stroke so engine A and engine B never share mutable state. */
const cloneStroke = (stroke) => ({
  color: stroke.color,
  points: stroke.points.map((p) => ({ ...p })),
});

describe('Backward compatibility (property) — 1.0 documents replay as classic', () => {
  it('renders an untagged 1.0 document identically to classic-tagged strokes, with no warning', () => {
    fc.assert(
      fc.property(legacyDocArb, (strokes) => {
        // A: the genuine 1.0 document — untagged strokes, version '1.0', no
        // document defaultMode. This is what a pre-feature save looks like.
        const legacyDoc = {
          drawDocumentVersion: '1.0',
          strokes: strokes.map(cloneStroke),
        };

        // B: the same strokes explicitly routed through the classic mode —
        // classic being the definition of pre-feature behavior.
        const classicDoc = {
          drawDocumentVersion: '1.1',
          defaultMode: 'classic',
          strokes: strokes.map((s) => ({ ...cloneStroke(s), mode: 'classic' })),
        };

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ctxA = createFakeContext();
        const engineA = new DrawEngine({ ctx: ctxA });
        engineA.setDocument(legacyDoc);

        const ctxB = createFakeContext();
        const engineB = new DrawEngine({ ctx: ctxB });
        engineB.setDocument(classicDoc);

        // Every 1.0 stroke renders exactly as classic: identical draw calls.
        expect(ctxA.calls).toEqual(ctxB.calls);
        // Loading a 1.0 document is silent — absent mode is not an unknown id.
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
      }),
      { numRuns: 80 },
    );
  });
});

import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../../apps/demo/src/draw-document.schema.json';

/**
 * Schema validation tests for the draw-document JSON schema (task 8.2).
 *
 * The schema lives at apps/demo/src/draw-document.schema.json; it is imported
 * here via a relative path because the root vitest config only discovers tests
 * under packages/**. Validation uses ajv (already a runtime dependency of the
 * document-engine package), matching how DocumentEngine validates documents.
 *
 * Coverage:
 *  - A `1.1` document exercising every new field validates: a document-level
 *    `defaultMode`, per-stroke `mode` + `options`, and per-point `pressure`
 *    and `time`, across all three shapes (classic, square-bezier,
 *    perfect-freehand).
 *  - A `1.0` document (version '1.0', `{ x, y, width }` points, optional
 *    per-point `removed`) still validates.
 *  - Documents carrying unexpected properties or missing required fields are
 *    rejected, since the schema keeps `additionalProperties: false`.
 *
 * _Requirements: 5.5_
 */

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

// A 1.1 document exercising defaultMode + all three stroke shapes.
const V11_DOCUMENT = {
  drawDocumentVersion: '1.1',
  name: 'mixed-mode',
  defaultMode: 'classic',
  strokes: [
    {
      mode: 'classic',
      color: '#000000',
      points: [
        { x: 10, y: 20, width: 2 },
        { x: 30, y: 40, width: 3 },
      ],
    },
    {
      mode: 'square-bezier',
      color: '#ff0000',
      options: {
        minWidth: 0.5,
        maxWidth: 4,
        velocityFilterWeight: 0.7,
        dotSize: 1.5,
      },
      points: [
        { x: 5, y: 5, width: 1, time: 1000 },
        { x: 15, y: 25, width: 2, time: 1016 },
      ],
    },
    {
      mode: 'perfect-freehand',
      color: '#0000ff',
      options: {
        size: 8,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      },
      points: [
        { x: 1, y: 1, pressure: 0.4 },
        { x: 2, y: 3, pressure: 0.6 },
      ],
    },
  ],
};

// A legacy 1.0 document: version '1.0', classic { x, y, width } points, and
// an optional `removed` flag.
const V10_DOCUMENT = {
  drawDocumentVersion: '1.0',
  name: 'legacy',
  strokes: [
    {
      color: '#000000',
      points: [
        { x: 0, y: 0, width: 1 },
        { x: 10, y: 10, width: 1.5, removed: true },
      ],
    },
  ],
};

describe('draw-document schema', () => {
  it('accepts a 1.1 document using every new field across all modes', () => {
    const valid = validate(V11_DOCUMENT);
    expect(valid, JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts a legacy 1.0 document', () => {
    const valid = validate(V10_DOCUMENT);
    expect(valid, JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects an unknown top-level property', () => {
    const doc = { ...V11_DOCUMENT, bogusTopLevel: true };
    expect(validate(doc)).toBe(false);
  });

  it('rejects an unknown stroke property', () => {
    const doc = {
      drawDocumentVersion: '1.1',
      strokes: [
        {
          color: '#000000',
          points: [{ x: 0, y: 0 }],
          bogusStrokeProp: 'nope',
        },
      ],
    };
    expect(validate(doc)).toBe(false);
  });

  it('rejects an unknown point property', () => {
    const doc = {
      drawDocumentVersion: '1.1',
      strokes: [
        {
          color: '#000000',
          points: [{ x: 0, y: 0, bogusPointProp: 1 }],
        },
      ],
    };
    expect(validate(doc)).toBe(false);
  });

  it('rejects an out-of-enum drawDocumentVersion', () => {
    const doc = { ...V11_DOCUMENT, drawDocumentVersion: '2.0' };
    expect(validate(doc)).toBe(false);
  });

  it('rejects a document missing drawDocumentVersion', () => {
    const doc = { name: 'no-version', strokes: [] };
    expect(validate(doc)).toBe(false);
  });

  it('rejects a stroke missing its required color', () => {
    const doc = {
      drawDocumentVersion: '1.1',
      strokes: [{ points: [{ x: 0, y: 0 }] }],
    };
    expect(validate(doc)).toBe(false);
  });

  it('rejects a stroke missing its required points', () => {
    const doc = {
      drawDocumentVersion: '1.1',
      strokes: [{ color: '#000000' }],
    };
    expect(validate(doc)).toBe(false);
  });

  it('rejects a point missing its required coordinates', () => {
    const doc = {
      drawDocumentVersion: '1.1',
      strokes: [
        {
          color: '#000000',
          points: [{ x: 0 }],
        },
      ],
    };
    expect(validate(doc)).toBe(false);
  });
});

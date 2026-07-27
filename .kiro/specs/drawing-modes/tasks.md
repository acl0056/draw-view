# Implementation Plan: Drawing Modes

## Overview

This plan refactors `packages/core/src/DrawEngine.js` so its single hard-coded
stroke algorithm becomes one of several interchangeable `DrawingMode`
strategies resolved through a Mode Registry. Work is sequenced so the strategy
seam and a behavior-preserving extraction of the current algorithm
(`ClassicSmoothingMode`, guarded by a golden-master parity test) land first,
then the two new modes (`SquareBezierMode`, `PerfectFreehandMode`), then
document versioning/persistence and the JSON schema, then the Vue/demo wiring,
and finally the property-based tests. Everything is JavaScript (ES modules,
Airbnb style). A Vitest test runner is set up first because none exists today.

## Tasks

- [x] 1. Set up test tooling and the drawing-mode strategy seam
  - [x] 1.1 Add and configure a test runner
    - Add `vitest` and `fast-check` as dev dependencies at the workspace root (exact-pinned per workspace standards); fast-check is used later for property tests
    - Add a `test` script (single-run, e.g. `vitest --run`) and wire `packages/core` to run under it
    - Create a small fake/recording `CanvasRenderingContext2D` test helper (records `arc`/`fill`/`createRadialGradient`/`beginPath`/`moveTo`/`lineTo`/`clearRect` calls) for use by mode and engine tests
    - _Requirements: 2.1_

  - [x] 1.2 Define the DrawingMode strategy contract and Mode Registry
    - Create `packages/core/src/modes/DrawingMode.js` documenting the uniform contract: stable `id`, `begin(point, style)`, `addPoint(point)`, `renderPreview(tempCtx)`, `end() -> serializable stroke`, and `replay(stroke, ctx)`
    - Create `packages/core/src/modes/ModeRegistry.js` that maps ids to mode instances, resolves the active mode, resolves a mode by id for replay, and exposes a barrel `registerBuiltInModes(registry)` in `packages/core/src/modes/index.js`
    - Implement unknown-id fallback resolution (requested id -> `defaultMode` -> `classic`) and an unknown-id guard for active-mode selection
    - _Requirements: 1.1, 7.1, 7.2_

  - [x] 1.3 Write unit tests for registry resolution
    - Test lookup by id, active-mode switching, unknown-id replay fallback chain, and unknown-id `setMode` rejection
    - _Requirements: 1.1, 7.1, 7.2_

- [x] 2. Extract Classic mode and add the engine delegation seam
  - [x] 2.1 Extract ClassicSmoothingMode without changing output
    - Move `VertexQueue`, tangent/cardinal curve fitting, corner detection, knot removal, and radial-gradient dot stamping out of `DrawEngine.js` into `packages/core/src/modes/ClassicSmoothingMode.js` implementing the DrawingMode contract with `id = 'classic'`
    - Reproduce today's `strokeStart`/`strokeMove`/`renderPreview`/`strokeEnd` and `_processStroke` replay behavior exactly; emit `{ x, y, width }` points compatible with 1.0 documents
    - Register it via `registerBuiltInModes`
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Refactor DrawEngine to delegate to the active mode
    - Have `DrawEngine` own the registry, active mode, and style state; forward `strokeStart`/`strokeMove`/`renderPreview`/`strokeEnd`/`strokeTap` to the active mode and manage temp-overlay clearing between strokes
    - Add `setMode(modeId)` (applies to next stroke), `getMode()`, constructor `mode` option (default `classic`) and `modeOptions` map; keep `setColor`/`clear`/`getDocument`/`popStroke` signatures unchanged
    - Add an optional trailing `pressure` argument to `strokeStart`/`strokeMove`/`strokeTap` that is ignored by centerline modes; existing two-arg calls stay valid
    - Update `packages/core/src/index.js` to export the registry/mode entry points as needed
    - _Requirements: 1.2, 1.3, 1.4, 7.2, 8.1, 8.2_

  - [x] 2.3 Write golden-master parity test for the Classic extraction
    - Record the pre-refactor draw-call sequence for representative point streams (dot, short line, long curved stroke) against the fake context, then assert the refactored `classic` mode produces the identical sequence
    - _Requirements: 2.1, 2.2_

  - [x] 2.4 Write unit tests for mode selection API
    - Test constructor default is `classic`, `setMode`/`getMode` round-trip, and unknown-id `setMode` keeps current mode and warns
    - _Requirements: 1.2, 1.3, 1.4, 7.2_

- [x] 3. Checkpoint - Classic parity and seam
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement SquareBezierMode
  - [x] 4.1 Implement the Square Bezier mode
    - Create `packages/core/src/modes/SquareBezierMode.js` with `id = 'square-bezier'`: buffer input points (with `time`), compute midpoint-anchored cubic Bezier control points (ratio `k`, reference `cm`, translation `t`; copy first point when only three collected)
    - Derive per-stamp width from pointer velocity (`width = max(maxWidth / (velocity + 1), minWidth)`) smoothed by `velocityFilterWeight`; walk the curve in `ceil(curveLength) * 2` steps stamping filled circles on the Main_Canvas; single-point renders a `dotSize` dot
    - Serialize `{ x, y, width, time }` points plus `options` (`minWidth`, `maxWidth`, `velocityFilterWeight`, `dotSize`); implement `replay` to recompute identical curves/widths; paint trailing preview on the temp overlay; register via `registerBuiltInModes`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.2 Write unit tests for SquareBezierMode
    - Test lifecycle emits a well-formed stroke tagged `square-bezier` with per-point `time`, velocity-clamped widths between `minWidth`/`maxWidth`, and replay reproducing the committed stamps
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. Implement PerfectFreehandMode
  - [x] 5.1 Add the perfect-freehand runtime dependency
    - Add `perfect-freehand` to `packages/core/package.json` `dependencies` pinned to an exact version (core's first runtime dependency) and install
    - _Requirements: 4.1, 4.2_

  - [x] 5.2 Implement the perfect-freehand mode
    - Create `packages/core/src/modes/PerfectFreehandMode.js` with `id = 'perfect-freehand'`: collect points with `pressure`, generate the outline via perfect-freehand, render the evolving outline on the Temp_Overlay once per frame during the stroke, and fill the final outline onto the Main_Canvas exactly once at `strokeEnd`
    - Substitute a default pressure when a point lacks one so the stroke still renders (uniform width); serialize input points with `pressure` plus `options` (size/thinning/smoothing/streamline); implement `replay` to fill an identical outline; register via `registerBuiltInModes`
    - _Requirements: 4.1, 4.2, 4.3, 7.3_

  - [x] 5.3 Write unit tests for PerfectFreehandMode
    - Test the final outline fills the Main_Canvas exactly once, preview paints only the temp overlay, serialized stroke carries `pressure` + `options`, replay reproduces the fill, and missing pressure falls back to a default
    - _Requirements: 4.1, 4.2, 4.3, 7.3_

- [x] 6. Checkpoint - All three modes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Document versioning, tagging, and replay routing
  - [x] 7.1 Bump the document model and tag strokes
    - Update new-document creation to set `drawDocumentVersion` to `1.1` and support an optional document-level `defaultMode` (default `classic`); tag each serialized stroke with its producing mode id, writing `"mode": "classic"` explicitly for classic strokes
    - _Requirements: 5.1_

  - [x] 7.2 Route replay through per-stroke modes
    - Update `redraw`/`setDocument`/`pushStroke` to resolve each stroke's mode via the registry (absent `mode` -> `defaultMode` -> `classic`) and replay with that mode; on an unregistered id, fall back, log a single warning, and preserve the original `mode` tag
    - Ensure `1.0` documents load with every stroke rendered as `classic`, matching pre-feature output
    - _Requirements: 5.2, 5.3, 5.4, 7.1_

  - [x] 7.3 Write unit tests for versioning and routing
    - Test new documents are `1.1` with tagged strokes, `1.0` documents render all strokes as classic, mixed-mode documents route each stroke to its own mode, and unknown-mode strokes fall back with a warning while retaining their tag
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1_

- [x] 8. Update the draw-document JSON schema
  - [x] 8.1 Extend the schema in lockstep with the model
    - Update `apps/demo/src/draw-document.schema.json`: add `"1.1"` to the `drawDocumentVersion` enum (keep `"1.0"`), add optional document `defaultMode`, optional per-stroke `mode` and `options`, and optional per-point `pressure` and `time`, keeping `additionalProperties: false`
    - _Requirements: 5.5_

  - [x] 8.2 Write schema validation tests
    - Validate that `1.1` documents with the new fields pass, `1.0` documents still validate, and documents with unexpected properties are rejected
    - _Requirements: 5.5_

- [x] 9. Wire mode selection through DrawView and the demo
  - [x] 9.1 Add the DrawView mode prop and pressure forwarding
    - Add a `mode` prop to `packages/vue/src/DrawView.vue` (default `classic`) with a watcher calling `engine.setMode(...)`; forward `PointerEvent.pressure` into `strokeStart`/`strokeMove` when available, defaulting otherwise so centerline modes are unaffected
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.2 Add the demo mode dropdown
    - Add a mode dropdown to `apps/demo/src/App.vue` mirroring the existing color/size controls, bound to the `DrawView` `mode` prop, labeling `classic` as "Classic"
    - _Requirements: 6.4_

- [x] 10. Property-based tests
  - [x] 10.1 Write round-trip fidelity property tests
    - **Property: Mode round-trip fidelity** — for each mode, random point streams drawn -> serialized -> replayed produce an equivalent recorded draw-call sequence
    - **Validates: Requirements 2.1, 3.1, 4.2, 5.4**

  - [x] 10.2 Write mode-isolation property tests
    - **Property: Mode isolation** — random sequences of (mode, stroke) pairs replay each stroke under its own mode regardless of order
    - **Validates: Requirements 5.4**

  - [x] 10.3 Write backward-compatibility property tests
    - **Property: Backward compatibility** — randomly generated `1.0`-shaped documents replay identically before and after the change (all treated as classic)
    - **Validates: Requirements 5.3**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks, including test sub-tasks, are required; there are no optional tasks in this plan.
- Each task references specific requirement clauses for traceability.
- The Classic extraction (2.1) must not change output; the golden-master parity test (2.3) guards this before new modes are added.
- perfect-freehand is core's first runtime dependency, pinned exactly; fast-check is a dev dependency for the property tests.
- signature_pad stays a gitignored reference only; SquareBezierMode is reimplemented from scratch (retain MIT attribution if any snippet is ported verbatim).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["5.3", "7.1"] },
    { "id": 7, "tasks": ["7.2"] },
    { "id": 8, "tasks": ["7.3", "8.1"] },
    { "id": 9, "tasks": ["8.2", "9.1", "9.2"] },
    { "id": 10, "tasks": ["10.1", "10.2", "10.3"] }
  ]
}
```

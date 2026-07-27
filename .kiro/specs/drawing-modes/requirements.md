# Requirements Document

## Introduction

This feature makes the stroke-rendering algorithm in `DrawEngine` selectable rather than hard-coded. Today the engine always uses a single tangent-based cardinal curve fit rendered by stamping dots along a centerline. This feature introduces three interchangeable drawing modes behind a common strategy contract: Classic (the existing algorithm, unchanged and default), Square Bezier (signature_pad-style midpoint cubic with velocity-driven variable width), and perfect-freehand (a filled outline polygon). Strokes are tagged with the mode that produced them so documents replay faithfully, the document format is bumped to 1.1 with additive optional per-point data, and existing 1.0 documents continue to load and render unchanged.

## Glossary

- **DrawEngine**: The framework-independent core engine that orchestrates the stroke lifecycle and owns the document.
- **DrawView**: The Vue component wrapping DrawEngine, exposing props and handling pointer input.
- **Drawing_Mode**: A strategy implementation encapsulating point ingestion, curve fitting, preview rendering, and committed rendering for one stroke style. Identified by a stable string id: `classic`, `square-bezier`, or `perfect-freehand`.
- **Mode_Registry**: The component mapping mode ids to Drawing_Mode implementations and resolving the active or per-stroke mode.
- **Document**: The versioned serialized model containing strokes; version bumps from `1.0` to `1.1`.
- **Main_Canvas**: The primary Canvas 2D context holding committed strokes.
- **Temp_Overlay**: The secondary Canvas 2D context used for live in-progress previews.

## Requirements

### Requirement 1: Selectable drawing modes and default

**User Story:** As a consumer of DrawEngine, I want to choose among drawing modes, so that I can produce different stroke styles without changing my integration.

#### Acceptance Criteria

1. THE DrawEngine SHALL register three modes with ids `classic`, `square-bezier`, and `perfect-freehand`.
2. WHERE no mode is specified in the constructor, THE DrawEngine SHALL use `classic` as the active mode.
3. WHEN a consumer calls `setMode` with a registered mode id, THE DrawEngine SHALL apply that mode to strokes started after the call.
4. WHEN a consumer calls `getMode`, THE DrawEngine SHALL return the id of the active mode.

### Requirement 2: Classic mode preserves existing behavior

**User Story:** As an existing consumer, I want the default rendering to be identical to today, so that upgrading does not change my drawings.

#### Acceptance Criteria

1. WHERE the active mode is `classic`, THE DrawEngine SHALL reproduce the existing strokeStart, strokeMove, renderPreview, strokeEnd, and replay behavior.
2. WHEN a `classic` stroke is serialized, THE DrawEngine SHALL emit points in the `{ x, y, width }` shape compatible with version 1.0 documents.

### Requirement 3: Square Bezier mode

**User Story:** As a user drawing signatures, I want a velocity-tapered smoothing mode, so that my strokes look clean and natural.

#### Acceptance Criteria

1. WHILE the active mode is `square-bezier`, THE DrawEngine SHALL fit a cubic Bezier anchored to input points and stamp variable-width filled circles along the fitted curve on the Main_Canvas.
2. THE Square_Bezier mode SHALL derive per-stamp width from pointer velocity smoothed by a velocity filter weight, clamped between the configured minimum and maximum widths.
3. WHEN a `square-bezier` stroke is serialized, THE DrawEngine SHALL record a per-point `time` value sufficient to recompute identical velocities and widths on replay.

### Requirement 4: perfect-freehand mode

**User Story:** As a user, I want a pressure-responsive outline stroke, so that I get filled variable-width freehand marks.

#### Acceptance Criteria

1. WHILE the active mode is `perfect-freehand`, THE DrawEngine SHALL render the evolving outline on the Temp_Overlay once per frame during the stroke.
2. WHEN a `perfect-freehand` stroke ends, THE DrawEngine SHALL fill the final outline polygon onto the Main_Canvas exactly once.
3. WHEN a `perfect-freehand` stroke is serialized, THE DrawEngine SHALL record the input points with `pressure` and the mode options needed to regenerate an identical outline on replay.

### Requirement 5: Persistence, versioning, and backward compatibility

**User Story:** As a consumer, I want documents to record which mode drew each stroke, so that mixed-mode documents replay faithfully while old documents still work.

#### Acceptance Criteria

1. WHEN the DrawEngine creates a new document, THE DrawEngine SHALL set `drawDocumentVersion` to `1.1` and tag each stroke with its producing mode id.
2. WHEN a stroke omits a `mode` tag, THE DrawEngine SHALL resolve it to the document `defaultMode`, and to `classic` when no default is set.
3. WHEN a version `1.0` document is loaded, THE DrawEngine SHALL render every stroke as `classic` and produce the same result as before this feature.
4. WHEN loading or replaying a document via `setDocument`, `redraw`, or `pushStroke`, THE DrawEngine SHALL render each stroke using the mode that produced it.
5. THE draw-document JSON schema SHALL accept `1.1` documents with optional `defaultMode`, per-stroke `mode` and `options`, and per-point `pressure` and `time`, while continuing to validate `1.0` documents and retaining `additionalProperties: false`.

### Requirement 6: DrawView and demo mode selection

**User Story:** As an app developer, I want to select a mode through DrawView and the demo, so that I can expose modes to end users.

#### Acceptance Criteria

1. WHERE no `mode` prop is provided, THE DrawView SHALL default the mode to `classic`.
2. WHEN the DrawView `mode` prop changes, THE DrawView SHALL call `setMode` on the DrawEngine with the new value.
3. WHERE pointer pressure is available, THE DrawView SHALL forward the pressure value into strokeStart and strokeMove.
4. THE demo application SHALL provide a mode dropdown bound to the DrawView `mode` prop that labels `classic` as "Classic".

### Requirement 7: Graceful handling of unknown modes and missing pressure

**User Story:** As a consumer, I want the engine to degrade gracefully on unexpected input, so that documents and sessions never crash.

#### Acceptance Criteria

1. IF a stroke references an unregistered mode id during replay, THEN THE DrawEngine SHALL render it using `defaultMode`, then `classic`, log a single warning, and preserve the original `mode` tag.
2. IF `setMode` is called with an unregistered mode id, THEN THE DrawEngine SHALL keep the current active mode and surface a warning.
3. IF a pressure-aware mode receives a point without pressure, THEN THE DrawEngine SHALL substitute a default pressure so the stroke renders with uniform width.

### Requirement 8: Backward-compatible public API

**User Story:** As an existing consumer, I want the DrawEngine API to stay compatible, so that my current calls keep working.

#### Acceptance Criteria

1. THE DrawEngine SHALL preserve the existing signatures of `setColor`, `renderPreview`, `strokeEnd`, `clear`, `getDocument`, and `popStroke`.
2. WHERE strokeStart, strokeMove, or strokeTap are called without a pressure argument, THE DrawEngine SHALL treat the call as valid and behave as it does today.

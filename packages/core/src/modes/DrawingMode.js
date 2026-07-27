/**
 * DrawingMode — the uniform strategy contract every drawing mode implements so
 * that `DrawEngine` can drive any mode identically. A mode encapsulates the
 * full per-stroke pipeline: ingest raw points, fit geometry, render the
 * committed stroke to the main context, render the live preview to the temp
 * overlay, and re-render a stored stroke on load.
 *
 * Modes must never touch the DOM or input events; they operate only on the
 * canvas contexts and style values handed to them by the engine, and they own
 * (and reset between strokes) all algorithm-specific state.
 *
 * This base class documents the contract and provides "not implemented"
 * guards. Concrete modes (ClassicSmoothingMode, SquareBezierMode,
 * PerfectFreehandMode) extend it in later tasks.
 *
 * Contract:
 * - `id` — a stable string identifier (e.g. `classic`, `square-bezier`,
 *   `perfect-freehand`) written into serialized strokes. Concrete modes expose
 *   it as an instance property.
 * - `begin(point, style)` — receive the first point and the current style
 *   (color, radius, and mode-specific options); paint any initial mark on the
 *   main context.
 * - `addPoint(point)` — accept a subsequent sample (including optional
 *   pressure); accumulate internal state and commit any now-final geometry to
 *   the main context.
 * - `renderPreview(tempCtx)` — paint the not-yet-committed tail onto the temp
 *   overlay; idempotent and safe to call once per animation frame.
 * - `end()` — flush remaining geometry to the main context and return a
 *   serializable stroke record tagged with this mode's `id`.
 * - `replay(stroke, ctx)` — given a previously serialized stroke, reproduce its
 *   committed rendering on the provided main context. A mode must faithfully
 *   replay strokes bearing its own `id`.
 */

/** The default drawing-mode id used as the final fallback everywhere. */
export const DEFAULT_MODE_ID = 'classic';

export class DrawingMode {
  /**
   * A stable string id written into serialized strokes. Concrete modes define
   * this as an instance property; the base getter guards against misuse.
   * @returns {string}
   */
  get id() {
    throw new Error('DrawingMode subclasses must define a stable string `id`');
  }

  /**
   * Begin a stroke: receive the first point and current style; paint any
   * initial mark on the main context.
   * @param {{ x: number, y: number, pressure?: number }} _point
   * @param {object} _style - color, radius, and mode-specific options
   */
  begin(_point, _style) {
    throw new Error('DrawingMode subclasses must implement `begin(point, style)`');
  }

  /**
   * Accept a subsequent sample and commit any now-final geometry.
   * @param {{ x: number, y: number, pressure?: number }} _point
   */
  addPoint(_point) {
    throw new Error('DrawingMode subclasses must implement `addPoint(point)`');
  }

  /**
   * Paint the not-yet-committed tail onto the temp overlay. Idempotent.
   * @param {CanvasRenderingContext2D} _tempCtx
   */
  renderPreview(_tempCtx) {
    throw new Error('DrawingMode subclasses must implement `renderPreview(tempCtx)`');
  }

  /**
   * Flush remaining geometry and return a serializable stroke record tagged
   * with this mode's `id`.
   * @returns {object} serializable stroke
   */
  end() {
    throw new Error('DrawingMode subclasses must implement `end()`');
  }

  /**
   * Reproduce a previously serialized stroke's committed rendering.
   * @param {object} _stroke - a stroke previously produced by `end()`
   * @param {CanvasRenderingContext2D} _ctx - the main context to render onto
   */
  replay(_stroke, _ctx) {
    throw new Error('DrawingMode subclasses must implement `replay(stroke, ctx)`');
  }
}

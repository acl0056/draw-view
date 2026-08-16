/**
 * DrawEngine — framework-independent stroke lifecycle orchestrator.
 *
 * Accepts a CanvasRenderingContext2D and point data. Does not own event
 * listeners or DOM — the consumer handles input and feeds points in.
 *
 * The engine no longer contains any stroke-fitting algorithm itself. Instead it
 * owns a ModeRegistry (populated with the built-in modes), tracks an active
 * DrawingMode (default `classic`), and delegates the per-stroke pipeline to it:
 *
 *   strokeStart  -> mode.begin(point, style)
 *   strokeMove   -> mode.addPoint(point)
 *   renderPreview-> mode.renderPreview(tempCtx)
 *   strokeEnd    -> mode.end() -> serializable stroke
 *   strokeTap    -> mode.tap(point, style) (when the mode provides one)
 *
 * The engine hands each mode a style/context bundle describing where and how to
 * draw (`ctx`, `tempCtx`, `colorPrefix`, `strokeRadius`, `maxError`,
 * `decoupledPreview`, `debugPoints`). Replay (`redraw`, `setDocument`,
 * `pushStroke`) resolves each stored stroke's mode through the registry and
 * delegates to that mode's `replay`.
 */

import { ModeRegistry, registerBuiltInModes } from './modes/index.js';
import { DEFAULT_MODE_ID } from './modes/DrawingMode.js';

export class DrawEngine {
  /**
   * @param {object} options
   * @param {CanvasRenderingContext2D} options.ctx - main canvas context
   * @param {CanvasRenderingContext2D} [options.tempCtx] - optional overlay
   *   context for live, semi-transparent previews of the un-committed tail
   * @param {number} [options.strokeRadius=3]
   * @param {number} [options.maxError=1]
   * @param {{r:number, g:number, b:number}} [options.color={r:0,g:0,b:0}]
   * @param {boolean} [options.decoupledPreview=false] - if true, strokeMove
   *   skips inline preview; caller drives renderPreview()
   * @param {boolean} [options.debugPoints=false]
   * @param {string} [options.mode='classic'] - id of the initial active mode
   * @param {object} [options.modeOptions] - per-mode options map (reserved for
   *   modes that consume extra parameters)
   * @param {string} [options.defaultMode='classic'] - document-level fallback
   *   mode written onto newly created documents and used to resolve strokes
   *   that omit a `mode` tag
   */
  constructor(options) {
    this.ctx = options.ctx;
    this.tempCtx = options.tempCtx ?? null;
    this.strokeRadius = options.strokeRadius ?? 3;
    this.maxError = options.maxError ?? 1;
    // When false (default), strokeMove draws the live preview inline on every
    // point (original behavior). When true, strokeMove skips the preview and
    // the caller is responsible for calling renderPreview() once per frame.
    this.decoupledPreview = options.decoupledPreview ?? false;
    // Debug: when true, committed re-fit overlays a marker at each fitted point
    // so we can see where the points actually are relative to the curve.
    this.debugPoints = options.debugPoints ?? false;
    this.setColor(options.color?.r ?? 0, options.color?.g ?? 0, options.color?.b ?? 0);

    // Own the registry of built-in modes and resolve the active mode. An
    // unknown requested id falls back to the default `classic` mode.
    this._registry = new ModeRegistry();
    registerBuiltInModes(this._registry);
    this._modeOptions = options.modeOptions ?? {};

    const requestedId = options.mode ?? DEFAULT_MODE_ID;
    const resolved = this._registry.resolveActiveMode(requestedId);
    if (resolved) {
      this._activeModeId = requestedId;
      this._activeMode = resolved;
    }
    else {
      this._activeModeId = DEFAULT_MODE_ID;
      this._activeMode = this._registry.get(DEFAULT_MODE_ID);
    }

    // The mode driving the in-progress stroke. Captured at strokeStart so a
    // mid-stroke setMode() does not affect the stroke already underway.
    this._currentMode = null;

    // Document-level fallback mode written onto newly created documents and
    // used when a stored stroke omits its own `mode` tag. Defaults to classic.
    this._defaultMode = options.defaultMode ?? DEFAULT_MODE_ID;

    this._document = this._createDocument();
  }

  // --- Public API ---

  setColor(r, g, b) {
    this._colorPrefix = `rgba(${r},${g},${b}`;
  }

  /**
   * Switch the active mode for strokes started after this call. In-progress
   * strokes are unaffected. An unregistered id keeps the current mode and
   * surfaces a warning (Req 7.2).
   * @param {string} modeId
   * @returns {string} the id of the active mode after the call
   */
  setMode(modeId) {
    const resolved = this._registry.resolveActiveMode(modeId);
    if (!resolved) {
      console.warn(
        `[draw-view] Unknown drawing mode "${modeId}"; keeping current mode "${this._activeModeId}".`,
      );
      return this._activeModeId;
    }
    this._activeModeId = modeId;
    this._activeMode = resolved;
    return this._activeModeId;
  }

  /**
   * @returns {string} the id of the active mode
   */
  getMode() {
    return this._activeModeId;
  }

  /**
   * Call when a stroke begins (pointer down).
   * @param {number} x
   * @param {number} y
   * @param {number} [pressure] - optional pointer pressure; ignored by
   *   centerline modes. Existing two-argument calls remain valid.
   * @param {number} [time] - optional input event timestamp in ms (e.g.
   *   PointerEvent.timeStamp); used by velocity-based modes. Existing calls
   *   without it stay valid.
   */
  strokeStart(x, y, pressure, time) {
    this._currentMode = this._activeMode;
    this._currentMode.begin(this._makePoint(x, y, pressure, time), this._style());
  }

  /**
   * Call on each pointer move during a stroke.
   * @param {number} x
   * @param {number} y
   * @param {number} [pressure] - optional pointer pressure; ignored by
   *   centerline modes.
   * @param {number} [time] - optional input event timestamp in ms (e.g.
   *   PointerEvent.timeStamp); used by velocity-based modes. Existing calls
   *   without it stay valid.
   */
  strokeMove(x, y, pressure, time) {
    const mode = this._currentMode ?? this._activeMode;
    mode.addPoint(this._makePoint(x, y, pressure, time));
  }

  /**
   * Render the live, semi-transparent preview of the un-committed tail to the
   * temp overlay. Decoupled from strokeMove so callers feeding many points per
   * frame can repaint the preview only once per frame. No-op without a temp
   * context.
   */
  renderPreview() {
    const mode = this._currentMode ?? this._activeMode;
    mode.renderPreview(this.tempCtx);
  }

  /**
   * Call when a stroke ends (pointer up).
   * @returns {object} the completed, serializable stroke
   */
  strokeEnd() {
    const mode = this._currentMode ?? this._activeMode;
    const stroke = mode.end();
    this._tagStroke(stroke, mode);

    if (!this._document.strokes) this._document.strokes = [];
    this._document.strokes.push(stroke);

    this._currentMode = null;

    // Debug: re-render so the just-finished stroke shows its point markers.
    if (this.debugPoints) this.redraw();

    return stroke;
  }

  /**
   * Handle a single tap (dot).
   * @param {number} x
   * @param {number} y
   * @param {number} [pressure] - optional pointer pressure; ignored by
   *   centerline modes.
   * @param {number} [time] - optional input event timestamp in ms (e.g.
   *   PointerEvent.timeStamp); used by velocity-based modes. Existing calls
   *   without it stay valid.
   * @returns {object} the serializable stroke
   */
  strokeTap(x, y, pressure, time) {
    const mode = this._activeMode;
    const point = this._makePoint(x, y, pressure, time);
    let stroke;
    if (typeof mode.tap === 'function') {
      stroke = mode.tap(point, this._style());
    }
    else {
      // Fallback for modes without a dedicated tap: a zero-length stroke.
      mode.begin(point, this._style());
      stroke = mode.end();
    }
    this._tagStroke(stroke, mode);

    if (!this._document.strokes) this._document.strokes = [];
    this._document.strokes.push(stroke);
    return stroke;
  }

  /**
   * Clear the canvas and redraw all strokes in the current document, routing
   * each stroke to the mode that produced it.
   */
  redraw() {
    const { canvas } = this.ctx;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    const strokes = this._document.strokes;
    if (!strokes) return;
    for (const stroke of strokes) {
      this._replayStroke(stroke);
    }
  }

  /**
   * Clear the canvas entirely and reset the document.
   */
  clear() {
    const { canvas } = this.ctx;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._document = this._createDocument();
  }

  /**
   * Get the current document (serializable).
   */
  getDocument() {
    return this._document;
  }

  /**
   * Load a document and render it.
   * @param {object} doc
   */
  setDocument(doc) {
    this._document = doc;
    this.redraw();
  }

  /**
   * Remove the last stroke and redraw.
   * @returns {object|undefined} the removed stroke
   */
  popStroke() {
    if (!this._document.strokes?.length) return undefined;
    const removed = this._document.strokes.pop();
    this.redraw();
    return removed;
  }

  /**
   * Push a stroke back (for redo) and render it.
   * @param {object} stroke
   */
  pushStroke(stroke) {
    if (!this._document.strokes) this._document.strokes = [];
    this._document.strokes.push(stroke);
    this._replayStroke(stroke);
  }

  // --- Private helpers ---

  /**
   * Build a fresh, empty document at the current version. New documents are
   * written at `1.1` to signal the extended, self-describing stroke shape
   * (every stroke is tagged with its producing mode). Loaded `1.0` documents
   * are left untouched by this factory and continue to resolve untagged
   * strokes to classic via the registry fallback chain.
   * @returns {{ drawDocumentVersion: string, defaultMode: string }}
   */
  _createDocument() {
    return { drawDocumentVersion: '1.1', defaultMode: this._defaultMode };
  }

  /**
   * Ensure a freshly produced stroke carries a `mode` tag identifying the mode
   * that produced it. Modes that already self-tag (square-bezier,
   * perfect-freehand) are left as-is; classic strokes, which carry no tag, are
   * stamped with the producing mode's id (`classic`) so every stored stroke is
   * self-describing without mutating the mode's own output shape.
   * @param {object} stroke
   * @param {import('./modes/DrawingMode.js').DrawingMode} mode
   */
  _tagStroke(stroke, mode) {
    if (stroke && stroke.mode === undefined) {
      stroke.mode = mode.id;
    }
  }

  /**
   * Build a point for a mode, attaching pressure and time only when supplied so
   * existing two-argument lifecycle calls behave exactly as before.
   * @param {number} x
   * @param {number} y
   * @param {number} [pressure]
   * @param {number} [time] - input event timestamp in ms; used by
   *   velocity-based modes.
   * @returns {{ x: number, y: number, pressure?: number, time?: number }}
   */
  _makePoint(x, y, pressure, time) {
    const point = { x, y };
    if (pressure !== undefined) point.pressure = pressure;
    if (time !== undefined) point.time = time;
    return point;
  }

  /**
   * The style/context bundle handed to a mode. Read fresh each call so live
   * mutations of `strokeRadius`, `maxError`, `debugPoints`, color, etc. take
   * effect on the next stroke, mirroring the previous engine behavior.
   * @returns {object}
   */
  _style() {
    return {
      ctx: this.ctx,
      tempCtx: this.tempCtx,
      colorPrefix: this._colorPrefix,
      strokeRadius: this.strokeRadius,
      maxError: this.maxError,
      decoupledPreview: this.decoupledPreview,
      debugPoints: this.debugPoints,
    };
  }

  /**
   * Resolve a stored stroke's mode via the registry (absent id -> document
   * defaultMode -> `classic`) and replay it onto the main context. The engine's
   * current style is applied first so replay-time concerns like `debugPoints`
   * reflect the engine state, while the mode restores per-stroke color itself.
   * @param {object} stroke
   */
  _replayStroke(stroke) {
    const mode = this._registry.resolveReplayMode(stroke.mode, this._document.defaultMode)
      ?? this._activeMode;
    if (typeof mode._applyStyle === 'function') {
      mode._applyStyle(this._style());
    }
    mode.replay(stroke, this.ctx);
  }
}

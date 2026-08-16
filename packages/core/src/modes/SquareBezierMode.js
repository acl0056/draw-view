/**
 * SquareBezierMode — the Square "Smoother Signatures" technique behind the
 * DrawingMode strategy contract with `id = 'square-bezier'`.
 *
 * This is a from-scratch reimplementation of the documented technique as used
 * by signature_pad (MIT, Copyright 2018 Szymon Nowak — kept only as a gitignored
 * reference at `reference/signature_pad`, never vendored or shipped). Rather
 * than stroking a native canvas path, the mode fits a cubic Bezier per group of
 * four consecutive input points and then stamps filled circles of variable
 * radius along that curve, so the stroke tapers with pen speed.
 *
 * Control points are anchored to the real input points: for three consecutive
 * points the two segment midpoints are translated by `t = s2 - cm`, where
 * `cm = m2 + (m1 - m2) * k` and `k = l2 / (l1 + l2)`. A cubic Bezier then runs
 * from `points[1]` to `points[2]` using those control points, so consecutive
 * segments join smoothly and pass through the raw input points. When only three
 * points have been collected the first point is copied to the front of the
 * buffer so a curve can be produced immediately; the buffer is otherwise kept at
 * four points, dropping the oldest as each new point arrives.
 *
 * Per-stamp width is derived from pointer velocity (not radius):
 * `width = max(maxWidth / (velocity + 1), minWidth)`, with velocity smoothed by
 * a `velocityFilterWeight` low-pass filter against the previous velocity. The
 * committed geometry walks the fitted curve in `ceil(curveLength) * 2` steps,
 * stamping a filled circle at each step with the radius interpolated between the
 * segment's start and end width (clamped to `maxWidth`). A lone point renders as
 * a single dot of `dotSize` (or the min/max midpoint when `dotSize` is 0).
 *
 * The mode owns all per-stroke state and resets it between strokes. Contexts and
 * style are handed in by the engine via `begin(point, style)`; `replay(stroke,
 * ctx)` recomputes identical curves and widths from the serialized raw points
 * (each carrying a `time`).
 */

import { DrawingMode } from './DrawingMode.js';

const DEFAULT_OPTIONS = {
  minWidth: 0.5,
  maxWidth: 2.5,
  velocityFilterWeight: 0.7,
  dotSize: 0,
};

function distance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Velocity between two timed points (units per ms); 0 when times are equal. */
function velocityBetween(start, end) {
  const dt = end.time - start.time;
  return dt > 0 ? distance(start, end) / dt : 0;
}

/**
 * Compute the two control points for the segment centered on `s2`, following
 * the midpoint-anchored construction described above.
 * @param {{x:number,y:number}} s1
 * @param {{x:number,y:number}} s2
 * @param {{x:number,y:number}} s3
 * @returns {{ c1: {x:number,y:number}, c2: {x:number,y:number} }}
 */
function calculateControlPoints(s1, s2, s3) {
  const m1 = { x: (s1.x + s2.x) / 2, y: (s1.y + s2.y) / 2 };
  const m2 = { x: (s2.x + s3.x) / 2, y: (s2.y + s3.y) / 2 };

  const l1 = distance(s1, s2);
  const l2 = distance(s2, s3);

  const dxm = m1.x - m2.x;
  const dym = m1.y - m2.y;

  const k = l1 + l2 === 0 ? 0 : l2 / (l1 + l2);
  const cm = { x: m2.x + dxm * k, y: m2.y + dym * k };

  const tx = s2.x - cm.x;
  const ty = s2.y - cm.y;

  return {
    c1: { x: m1.x + tx, y: m1.y + ty },
    c2: { x: m2.x + tx, y: m2.y + ty },
  };
}

/**
 * Build a cubic Bezier from four consecutive points and the segment widths.
 * The curve runs from `points[1]` to `points[2]`.
 * @param {Array<{x:number,y:number}>} points - four points
 * @param {{ start:number, end:number }} widths
 * @returns {object} curve with control points, widths, and a `length()` helper
 */
function bezierFromPoints(points, widths) {
  const c2 = calculateControlPoints(points[0], points[1], points[2]).c2;
  const c1 = calculateControlPoints(points[1], points[2], points[3]).c1;

  return {
    startPoint: points[1],
    control1: c1,
    control2: c2,
    endPoint: points[2],
    startWidth: widths.start,
    endWidth: widths.end,
    /** Approximate arc length by sampling the curve. */
    length() {
      const steps = 10;
      let length = 0;
      let px;
      let py;
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const u = 1 - t;
        const cx = (u * u * u) * this.startPoint.x
          + (3 * u * u * t) * this.control1.x
          + (3 * u * t * t) * this.control2.x
          + (t * t * t) * this.endPoint.x;
        const cy = (u * u * u) * this.startPoint.y
          + (3 * u * u * t) * this.control1.y
          + (3 * u * t * t) * this.control2.y
          + (t * t * t) * this.endPoint.y;
        if (i > 0) {
          const xdiff = cx - px;
          const ydiff = cy - py;
          length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
        }
        px = cx;
        py = cy;
      }
      return length;
    },
  };
}

export class SquareBezierMode extends DrawingMode {
  constructor() {
    super();
    // Style / context supplied by the engine via begin() and replay(). Defaults
    // mirror the engine's own so a standalone mode still behaves sensibly.
    this._ctx = null;
    this._tempCtx = null;
    this._colorPrefix = 'rgba(0,0,0';
    this._options = { ...DEFAULT_OPTIONS };

    // Per-stroke state, owned by the mode and reset between strokes.
    this._lastPoints = [];
    this._lastVelocity = 0;
    this._lastWidth = 0;
    this._stroke = [];
  }

  /** @returns {string} */
  get id() {
    return 'square-bezier';
  }

  /**
   * Apply the style/context bundle handed in by the engine. Only provided keys
   * are updated so callers can pass a partial bundle. Mode-specific numeric
   * options may arrive either as top-level keys or nested under `options`.
   * @param {object} style
   */
  _applyStyle(style = {}) {
    if (style.ctx !== undefined) this._ctx = style.ctx;
    if (style.tempCtx !== undefined) this._tempCtx = style.tempCtx;
    if (style.colorPrefix !== undefined) this._colorPrefix = style.colorPrefix;
    this._options = this._resolveOptions(style);
  }

  /**
   * Merge mode options from a style bundle (top-level keys or `options`) over
   * the defaults.
   * @param {object} source
   * @returns {{minWidth:number, maxWidth:number, velocityFilterWeight:number, dotSize:number}}
   */
  _resolveOptions(source = {}) {
    const nested = source.options ?? {};
    const pick = (key) => {
      if (source[key] !== undefined) return source[key];
      if (nested[key] !== undefined) return nested[key];
      return DEFAULT_OPTIONS[key];
    };
    return {
      minWidth: pick('minWidth'),
      maxWidth: pick('maxWidth'),
      velocityFilterWeight: pick('velocityFilterWeight'),
      dotSize: pick('dotSize'),
    };
  }

  /** Reset per-stroke smoothing state for a fresh stroke. */
  _resetStrokeState() {
    this._lastPoints = [];
    this._lastVelocity = 0;
    this._lastWidth = (this._options.minWidth + this._options.maxWidth) / 2;
    this._stroke = [];
  }

  /**
   * Begin a stroke (pointer down). Renders the initial dot and seeds the point
   * buffer. `time` is stamped from the wall clock so replay can recompute the
   * identical velocity-driven widths.
   * @param {{ x:number, y:number }} point
   * @param {object} [style]
   */
  begin(point, style = {}) {
    this._applyStyle(style);
    this._resetStrokeState();
    this._clearTemp();

    // Prefer the point's own timestamp (the real input event time) so batched/
    // coalesced events yield correct per-segment velocities; `_now()` is the
    // fallback when no timestamp was threaded through.
    const timed = {
      x: point.x, y: point.y, time: typeof point.time === 'number' ? point.time : this._now(),
    };
    this._addBufferedPoint(timed);

    const dotWidth = this._dotWidth();
    this._drawDot(timed, dotWidth, this._ctx);
    this._stroke.push({
      x: timed.x, y: timed.y, width: dotWidth, time: timed.time,
    });
  }

  /**
   * Add a subsequent sample (pointer move). Commits any now-final curve segment
   * to the main context and records the raw point (with `time`).
   * @param {{ x:number, y:number }} point
   */
  addPoint(point) {
    // Prefer the point's own timestamp (the real input event time) so batched/
    // coalesced events yield correct per-segment velocities; `_now()` is the
    // fallback when no timestamp was threaded through.
    const timed = {
      x: point.x, y: point.y, time: typeof point.time === 'number' ? point.time : this._now(),
    };

    const curve = this._addBufferedPoint(timed);

    let width = this._lastWidth;
    if (curve) {
      width = curve.endWidth;
      this._drawCurve(curve, this._ctx, `${this._colorPrefix},1)`);
    }

    this._stroke.push({
      x: timed.x, y: timed.y, width, time: timed.time,
    });
  }

  /**
   * Paint the not-yet-committed trailing segment onto the temp overlay. Pure
   * overlay operation: it never mutates the committed main-context result.
   * @param {CanvasRenderingContext2D} [tempCtx]
   */
  renderPreview(tempCtx) {
    if (tempCtx !== undefined) this._tempCtx = tempCtx;
    if (!this._tempCtx) return;
    this._clearTemp();

    const pts = this._lastPoints;
    if (pts.length < 2) return;

    const from = pts[pts.length - 2];
    const to = pts[pts.length - 1];
    const previewColor = `${this._colorPrefix},0.333)`;
    const steps = Math.max(1, Math.ceil(distance(from, to)));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      this._drawStamp(x, y, this._lastWidth, previewColor, this._tempCtx);
    }
  }

  /**
   * End a stroke (pointer up). Clears the live preview and returns the
   * serializable stroke: raw `{ x, y, width, time }` points plus the mode
   * `options` needed to recompute identical curves/widths on replay.
   * @returns {{ mode:string, color:string, options:object, points:object[] }}
   */
  end() {
    const stroke = {
      mode: this.id,
      color: this._colorPrefix,
      options: { ...this._options },
      points: this._stroke,
    };
    this._resetStrokeState();
    this._clearTemp();
    return stroke;
  }

  /**
   * Handle a single tap (dot).
   * @param {{ x:number, y:number }} point
   * @param {object} [style]
   * @returns {{ mode:string, color:string, options:object, points:object[] }}
   */
  tap(point, style = {}) {
    this._applyStyle(style);
    this._resetStrokeState();
    // Prefer the point's own timestamp (the real input event time) so batched/
    // coalesced events yield correct per-segment velocities; `_now()` is the
    // fallback when no timestamp was threaded through.
    const timed = {
      x: point.x, y: point.y, time: typeof point.time === 'number' ? point.time : this._now(),
    };
    const dotWidth = this._dotWidth();
    this._drawDot(timed, dotWidth, this._ctx);
    return {
      mode: this.id,
      color: this._colorPrefix,
      options: { ...this._options },
      points: [{
        x: timed.x, y: timed.y, width: dotWidth, time: timed.time,
      }],
    };
  }

  /**
   * Reproduce a previously serialized square-bezier stroke onto the given main
   * context, recomputing the identical curves and velocity-driven widths from
   * the stored raw points and options.
   * @param {{ color?:string, options?:object, points:object[] }} stroke
   * @param {CanvasRenderingContext2D} ctx
   */
  replay(stroke, ctx) {
    const points = stroke.points;
    if (!points || points.length === 0) return;

    const savedColor = this._colorPrefix;
    const savedOptions = this._options;
    if (stroke.color !== undefined) this._colorPrefix = stroke.color;
    this._options = this._resolveOptions({ options: stroke.options });

    this._lastPoints = [];
    this._lastVelocity = 0;
    this._lastWidth = (this._options.minWidth + this._options.maxWidth) / 2;

    const fillColor = `${this._colorPrefix},1)`;
    const dotWidth = this._dotWidth();

    if (points.length === 1) {
      this._drawDot(points[0], dotWidth, ctx);
    }
    else {
      // Mirror the live pipeline: the initial dot is committed at begin(), then
      // each buffered set of four points yields one committed curve segment.
      this._drawDot(points[0], dotWidth, ctx);
      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        const timed = { x: p.x, y: p.y, time: p.time ?? 0 };
        const curve = this._addBufferedPoint(timed);
        if (curve) this._drawCurve(curve, ctx, fillColor);
      }
    }

    this._lastPoints = [];
    this._colorPrefix = savedColor;
    this._options = savedOptions;
  }

  // --- Private helpers ---

  /** Current timestamp; isolated so tests could stub it if needed. */
  _now() {
    return Date.now();
  }

  /** Radius used for a lone dot: `dotSize`, or the min/max midpoint when 0. */
  _dotWidth() {
    const { dotSize, minWidth, maxWidth } = this._options;
    return dotSize > 0 ? dotSize : (minWidth + maxWidth) / 2;
  }

  /**
   * Push a timed point into the four-point buffer and, once enough points are
   * present, produce the finalized cubic Bezier for the middle segment. Copies
   * the first point to the front when exactly three have been collected to
   * reduce initial lag, and keeps the buffer at four points.
   * @param {{ x:number, y:number, time:number }} point
   * @returns {object|null} the finalized curve, or null when none is ready
   */
  _addBufferedPoint(point) {
    this._lastPoints.push(point);

    if (this._lastPoints.length > 2) {
      if (this._lastPoints.length === 3) {
        this._lastPoints.unshift(this._lastPoints[0]);
      }

      const widths = this._calculateCurveWidths(this._lastPoints[1], this._lastPoints[2]);
      const curve = bezierFromPoints(this._lastPoints, widths);
      this._lastPoints.shift();
      return curve;
    }

    return null;
  }

  /**
   * Velocity-smoothed start/end widths for a segment, advancing the low-pass
   * filter state.
   * @param {{x:number,y:number,time:number}} startPoint
   * @param {{x:number,y:number,time:number}} endPoint
   * @returns {{ start:number, end:number }}
   */
  _calculateCurveWidths(startPoint, endPoint) {
    const { velocityFilterWeight } = this._options;
    const velocity = velocityFilterWeight * velocityBetween(startPoint, endPoint)
      + (1 - velocityFilterWeight) * this._lastVelocity;

    const newWidth = this._strokeWidth(velocity);
    const widths = { start: this._lastWidth, end: newWidth };

    this._lastVelocity = velocity;
    this._lastWidth = newWidth;
    return widths;
  }

  /**
   * Width for a velocity, clamped to the configured minimum.
   * @param {number} velocity
   * @returns {number}
   */
  _strokeWidth(velocity) {
    return Math.max(this._options.maxWidth / (velocity + 1), this._options.minWidth);
  }

  /**
   * Walk the fitted curve and stamp filled circles of interpolated radius.
   * @param {object} curve
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} fillColor
   */
  _drawCurve(curve, ctx, fillColor) {
    const widthDelta = curve.endWidth - curve.startWidth;
    const drawSteps = Math.ceil(curve.length()) * 2;

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    for (let i = 0; i < drawSteps; i += 1) {
      const t = i / drawSteps;
      const tt = t * t;
      const ttt = tt * t;
      const u = 1 - t;
      const uu = u * u;
      const uuu = uu * u;

      const x = uuu * curve.startPoint.x
        + 3 * uu * t * curve.control1.x
        + 3 * u * tt * curve.control2.x
        + ttt * curve.endPoint.x;
      const y = uuu * curve.startPoint.y
        + 3 * uu * t * curve.control1.y
        + 3 * u * tt * curve.control2.y
        + ttt * curve.endPoint.y;

      const width = Math.min(curve.startWidth + ttt * widthDelta, this._options.maxWidth);
      ctx.moveTo(x, y);
      ctx.arc(x, y, width, 0, 2 * Math.PI, false);
    }
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Stamp a single filled dot (its own path + fill), used for lone points.
   * @param {{x:number,y:number}} point
   * @param {number} width
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawDot(point, width, ctx) {
    this._drawStamp(point.x, point.y, width, `${this._colorPrefix},1)`, ctx);
  }

  /**
   * Stamp a single filled circle at (x, y).
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {string} fillColor
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawStamp(x, y, width, fillColor, ctx) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, width, 0, 2 * Math.PI, false);
    ctx.closePath();
    ctx.fill();
  }

  _clearTemp() {
    if (!this._tempCtx) return;
    const { canvas } = this._tempCtx;
    this._tempCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export default SquareBezierMode;

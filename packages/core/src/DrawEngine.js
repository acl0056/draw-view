/**
 * DrawEngine — framework-independent stroke smoothing and curve-fitting engine.
 *
 * Accepts a CanvasRenderingContext2D and point data. Does not own event
 * listeners or DOM — the consumer handles input and feeds points in.
 */

function distance(a, b) {
  const x = b.x - a.x;
  const y = b.y - a.y;
  return Math.sqrt(x * x + y * y);
}

function tangentForPoints(v1, v2, v3, v4, v5) {
  const d2 = { x: v3.x - v2.x, y: v3.y - v2.y };
  const d3 = { x: v4.x - v3.x, y: v4.y - v3.y };

  const w2 = Math.abs(d3.x * (v5.y - v4.y) - d3.y * (v5.x - v4.x));
  const w3 = Math.abs((v2.x - v1.x) * d2.y - (v2.y - v1.y) * d2.x);

  const a0 = w2 * d2.x + w3 * d3.x;
  const b0 = w2 * d2.y + w3 * d3.y;

  let multiplier = 1.0 / Math.sqrt(a0 * a0 + b0 * b0);
  if (multiplier === Infinity) multiplier = 0;

  return { origin: v3, direction: { x: a0 * multiplier, y: b0 * multiplier } };
}

function getAngle(p1, p2, p3) {
  const dir1 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const dir2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
  const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
  const norm1 = { x: dir1.x / len1, y: dir1.y / len1 };
  const norm2 = { x: dir2.x / len2, y: dir2.y / len2 };
  return Math.acos(norm1.x * norm2.x + norm1.y * norm2.y);
}

function cardinalCurve(z, a, b, c, t) {
  const tension = 0.5;
  const t2 = t * t;
  const t3 = t * t2;
  const l = 2 * t3 - 3 * t2 + 1;
  const m = -2 * t3 + 3 * t2;
  const n = tension * (t3 - 2 * t2 + t);
  const o = tension * (t3 - t2);
  return {
    x: a.x * l + b.x * m + (b.x - z.x) * n + (c.x - a.x) * o,
    y: a.y * l + b.y * m + (b.y - z.y) * n + (c.y - a.y) * o,
  };
}

// --- VertexQueue (internal) ---

class VertexQueue {
  constructor() {
    this.queue = [];
    this.t1 = null;
    this.t2 = null;
  }

  push(obj) {
    const q = this.queue;
    if (q.length) {
      if (distance(obj, q[q.length - 1]) > 1) q.push(obj);
    } else {
      q.push(obj);
    }
  }

  getCount() {
    let count = 0;
    for (const p of this.queue) {
      if (!p.removed) count++;
    }
    return count;
  }

  pop() {
    while (this.queue.shift().removed) { /* skip removed */ }
  }

  reset() {
    this.queue = [];
    this.t1 = null;
    this.t2 = null;
  }

  getPoints() {
    return this.queue.filter((p) => !p.removed);
  }

  getRemovedPoints() {
    const arr = [];
    let notRemoved = 0;
    for (const p of this.queue) {
      if (p.removed) {
        if (notRemoved === 6) arr.push(p);
      } else {
        notRemoved++;
      }
    }
    return arr;
  }

  estimateInitialTangent() {
    const points = this.getPoints();
    const p4 = points[2];
    const p3 = points[1];
    const p2 = points[0];
    const s2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const s1 = { x: s2.x * 2 - (p4.x - p3.x), y: s2.y * 2 - (p4.y - p3.y) };
    const p1 = { x: p2.x - s1.x, y: p2.y - s1.y };
    const p0 = { x: p1.x - (s1.x * 2 - s2.x), y: p1.y - (s1.y * 2 - s2.y) };
    this.queue.unshift(p0, p1);
    this.t2 = tangentForPoints(p0, p1, p2, p3, p4);
  }

  estimateEndPoints() {
    const points = this.getPoints();
    const p4 = points[4];
    const p3 = points[3];
    const p2 = points[2];
    const s2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const s3 = { x: p4.x - p3.x, y: p4.y - p3.y };
    const s4 = { x: 2 * s3.x - s2.x, y: 2 * s3.y - s2.y };
    const s5 = { x: 2 * s4.x - s3.x, y: 2 * s4.y - s3.y };
    const p5 = { x: p4.x + s4.x, y: p4.y + s4.y };
    const p6 = { x: p5.x + s5.x, y: p5.y + s5.y };
    this.queue.push(p5, p6);
  }

  calculateTangent() {
    const points = this.getPoints();
    this.t1 = this.t2;
    this.t2 = tangentForPoints(points[1], points[2], points[3], points[4], points[5]);
    this.pop();
  }
}

// --- DrawEngine ---

export class DrawEngine {
  /**
   * @param {object} options
   * @param {CanvasRenderingContext2D} options.ctx - main canvas context
   * @param {number} [options.strokeRadius=3]
   * @param {number} [options.maxError=5]
   * @param {{r:number, g:number, b:number}} [options.color={r:0,g:0,b:0}]
   */
  constructor(options) {
    this.ctx = options.ctx;
    this.strokeRadius = options.strokeRadius ?? 3;
    this.maxError = options.maxError ?? 5;
    this.setColor(options.color?.r ?? 0, options.color?.g ?? 0, options.color?.b ?? 0);

    this._vq = new VertexQueue();
    this._stroke = [];
    this._document = { drawDocumentVersion: '1.0' };
  }

  // --- Public API ---

  setColor(r, g, b) {
    this._colorPrefix = `rgba(${r},${g},${b}`;
  }

  /**
   * Call when a stroke begins (pointer down).
   * @param {number} x
   * @param {number} y
   */
  strokeStart(x, y) {
    const radius = this.strokeRadius;
    const point = { x, y, width: radius, removed: false };
    this._vq.push(point);
    this._drawDot(x, y, radius, this.ctx);
    this._stroke = [{ x, y, width: radius }];
  }

  /**
   * Call on each pointer move during a stroke.
   * @param {number} x
   * @param {number} y
   */
  strokeMove(x, y) {
    const radius = this.strokeRadius;
    const point = { x, y, width: radius, removed: false };
    const vq = this._vq;
    vq.push(point);

    const points = vq.getPoints();
    const count = points.length;

    if (count === 3) {
      vq.estimateInitialTangent();
    } else if (count > 8) {
      // Corner detection
      const corner = 1.618;
      let hasCorner = false;
      for (let i = 4; i < count && !hasCorner; i++) {
        for (let j = i + 1; j < count && !hasCorner; j++) {
          for (let k = j + 1; k < count && !hasCorner; k++) {
            if (getAngle(points[i], points[i + 1], points[i + 2]) >= corner) {
              hasCorner = true;
            }
          }
        }
      }

      if (!hasCorner) {
        // Knot removal
        const distancePrev = distance(points[5], points[6]);
        const t = distancePrev / (distancePrev + distance(points[6], points[7]));
        const error = distance(
          points[6],
          cardinalCurve(points[4], points[5], points[7], points[8], t),
        );
        let removeKnot = error < this.maxError;

        if (removeKnot) {
          const removedPoints = vq.getRemovedPoints();
          for (const removed of removedPoints) {
            const dp = distance(points[5], removed);
            const tr = dp / (dp + distance(removed, points[7]));
            const err = distance(
              removed,
              cardinalCurve(points[4], points[5], points[7], points[8], tr),
            );
            if (err >= this.maxError) {
              removeKnot = false;
              break;
            }
          }
        }

        if (removeKnot) points[6].removed = true;
      }

      const refreshedPoints = vq.getPoints();
      if (refreshedPoints.length > 8) {
        vq.calculateTangent();
        this._drawCurve(refreshedPoints[2], refreshedPoints[3], vq.t1, vq.t2, this.ctx);
        this._stroke.push(refreshedPoints[2]);
      }
    }
  }

  /**
   * Call when a stroke ends (pointer up).
   */
  strokeEnd() {
    const vq = this._vq;
    let points = vq.getPoints();

    if (points.length === 2) {
      this._drawLine(points[0], points[1], this.ctx);
    } else if (points.length === 3) {
      vq.estimateInitialTangent();
      points = vq.getPoints();
    }

    while (points.length > 5) {
      vq.calculateTangent();
      this._drawCurve(points[2], points[3], vq.t1, vq.t2, this.ctx);
      this._stroke.push(points[2]);
      points = vq.getPoints();
    }

    if (points.length === 5) {
      this._stroke.push(points[2], points[3], points[4]);
      vq.estimateEndPoints();
      vq.calculateTangent();
      this._drawCurve(points[2], points[3], vq.t1, vq.t2, this.ctx);
      vq.calculateTangent();
      this._drawCurve(points[3], points[4], vq.t1, vq.t2, this.ctx);
    }

    // Save completed stroke to document
    const stroke = { points: this._stroke, color: this._colorPrefix };
    if (!this._document.strokes) this._document.strokes = [];
    this._document.strokes.push(stroke);

    this._stroke = [];
    vq.reset();

    return stroke;
  }

  /**
   * Handle a single tap (dot).
   * @param {number} x
   * @param {number} y
   */
  strokeTap(x, y) {
    const radius = this.strokeRadius;
    this._drawDot(x, y, radius, this.ctx);
    const stroke = { points: [{ x, y, width: radius }], color: this._colorPrefix };
    if (!this._document.strokes) this._document.strokes = [];
    this._document.strokes.push(stroke);
    return stroke;
  }

  /**
   * Clear the canvas and redraw all strokes in the current document.
   */
  redraw() {
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    const strokes = this._document.strokes;
    if (!strokes) return;
    const savedColor = this._colorPrefix;
    for (const stroke of strokes) {
      this._colorPrefix = stroke.color;
      this._processStroke(stroke);
    }
    this._colorPrefix = savedColor;
  }

  /**
   * Clear the canvas entirely and reset the document.
   */
  clear() {
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._document = { drawDocumentVersion: '1.0' };
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
    const savedColor = this._colorPrefix;
    this._colorPrefix = stroke.color;
    this._processStroke(stroke);
    this._colorPrefix = savedColor;
  }

  // --- Private rendering methods ---

  _drawDot(x, y, radius, ctx) {
    const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grd.addColorStop(0, this._colorPrefix + ',1)');
    grd.addColorStop(1, this._colorPrefix + ',0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.closePath();
  }

  _drawCurve(vStart, vEnd, t1, t2, ctx) {
    const r = distance(t1.origin, t2.origin);
    const p0 = t1.origin.x;
    const p1 = r * t1.direction.x;
    const p2 = 3 * (t2.origin.x - t1.origin.x) - r * (t2.direction.x + 2 * t1.direction.x);
    const p3 = -2 * (t2.origin.x - t1.origin.x) + r * (t2.direction.x + t1.direction.x);
    const q0 = t1.origin.y;
    const q1 = r * t1.direction.y;
    const q2 = 3 * (t2.origin.y - t1.origin.y) - r * (t2.direction.y + 2 * t1.direction.y);
    const q3 = -2 * (t2.origin.y - t1.origin.y) + r * (t2.direction.y + t1.direction.y);

    const currentWidth = vStart.width;
    const kStrokeStep = 0.45;
    const kIncrement = 0.001;
    let tFinder = 0;
    let drawVertex = { x: vStart.x, y: vStart.y };

    this._drawDot(drawVertex.x, drawVertex.y, currentWidth, ctx);

    for (let t = 0; t + tFinder < 1.0; t += tFinder) {
      let tempVert = { x: vEnd.x, y: vEnd.y };
      const d = distance(drawVertex, tempVert);
      const w = kStrokeStep * currentWidth;

      if (d < w) {
        tFinder = 1.0;
      } else if (d === w) {
        tFinder = 1.0;
      } else {
        const t2v = t * t;
        const t3v = t2v * t;
        tempVert = { x: p0 + p1 * t + p2 * t2v + p3 * t3v, y: q0 + q1 * t + q2 * t2v + q3 * t3v };
        if (distance(drawVertex, tempVert) < w) {
          for (tFinder = kIncrement; distance(drawVertex, tempVert) < w && t + tFinder < 1.0; tFinder += kIncrement) {
            const tf = t + tFinder;
            const tf2 = tf * tf;
            const tf3 = tf2 * tf;
            tempVert = { x: p0 + p1 * tf + p2 * tf2 + p3 * tf3, y: q0 + q1 * tf + q2 * tf2 + q3 * tf3 };
          }
        } else {
          tFinder = kIncrement;
        }
        drawVertex = tempVert;
        this._drawDot(drawVertex.x, drawVertex.y, currentWidth, ctx);
      }
    }
  }

  _drawLine(vStart, vEnd, ctx) {
    let currentWidth = vStart.width;
    const wStart = vStart.width;
    const wEnd = vEnd.width;
    const kStrokeStep = 0.45;
    const kIncrement = 0.001;
    let tFinder = 0;
    let drawVertex = { x: vStart.x, y: vStart.y };

    this._drawDot(drawVertex.x, drawVertex.y, wStart, ctx);

    for (let t = 0; t + tFinder < 1.0; t += tFinder) {
      let tempVert = { x: vEnd.x, y: vEnd.y };
      const d = distance(drawVertex, tempVert);
      const w = kStrokeStep * currentWidth;

      if (d < w) {
        tFinder = 1.0;
      } else if (d === w) {
        tFinder = 1.0;
      } else {
        tempVert = {
          x: vStart.x + (vEnd.x - vStart.x) * t,
          y: vStart.y + (vEnd.y - vStart.y) * t,
        };
        if (distance(drawVertex, tempVert) < w) {
          for (tFinder = kIncrement; distance(drawVertex, tempVert) < w && t + tFinder < 1.0; tFinder += kIncrement) {
            const tf = t + tFinder;
            tempVert = {
              x: vStart.x + (vEnd.x - vStart.x) * tf,
              y: vStart.y + (vEnd.y - vStart.y) * tf,
            };
          }
        } else {
          tFinder = kIncrement;
        }
        drawVertex = { x: tempVert.x, y: tempVert.y };
        currentWidth = wStart + (wEnd - wStart) * t;
        this._drawDot(drawVertex.x, drawVertex.y, currentWidth, ctx);
      }
    }
  }

  _processStroke(stroke) {
    const points = stroke.points;
    if (!points || points.length === 0) return;

    if (points.length < 4) {
      // Just dots or short lines
      if (points.length === 1) {
        this._drawDot(points[0].x, points[0].y, points[0].width, this.ctx);
      } else {
        for (let i = 0; i < points.length - 1; i++) {
          this._drawLine(points[i], points[i + 1], this.ctx);
        }
      }
      return;
    }

    const vq = new VertexQueue();
    for (let j = 0; j < points.length; j++) {
      vq.push(points[j]);
      if (j === 3) {
        vq.estimateInitialTangent();
      } else if (j > 3) {
        vq.calculateTangent();
        this._drawCurve(points[j - 3], points[j - 2], vq.t1, vq.t2, this.ctx);
        if (j === points.length - 1) {
          vq.estimateEndPoints();
          vq.calculateTangent();
          this._drawCurve(points[j - 2], points[j - 1], vq.t1, vq.t2, this.ctx);
          vq.calculateTangent();
          this._drawCurve(points[j - 1], points[j], vq.t1, vq.t2, this.ctx);
        }
      }
    }
  }
}

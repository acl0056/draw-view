# @adamlockhart/draw-view

Real-time stroke-smoothing and curve-fitting engine for HTML5 Canvas drawing.

[Live demo](https://practicube.com/draw/index.html)

## Install

```sh
npm install @adamlockhart/draw-view
```

## Usage

```js
import { DrawEngine } from '@adamlockhart/draw-view';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const engine = new DrawEngine({ ctx });

// On pointer down:
engine.strokeStart(x, y);

// On pointer move:
engine.strokeMove(x, y);

// On pointer up:
const stroke = engine.strokeEnd();
```

## API

### `new DrawEngine(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ctx` | `CanvasRenderingContext2D` | required | Main canvas context to draw on |
| `tempCtx` | `CanvasRenderingContext2D` | — | Optional overlay context for live previews (required for `renderPreview`, and for the live preview of the `square-bezier` and `perfect-freehand` modes) |
| `strokeRadius` | `number` | `3` | Dot radius for the classic mode |
| `maxError` | `number` | `1` | Error tolerance for classic knot removal |
| `color` | `{ r, g, b }` | `{ r: 0, g: 0, b: 0 }` | Stroke color |
| `mode` | `string` | `'classic'` | Initial active drawing mode id |
| `defaultMode` | `string` | `'classic'` | Document-level fallback mode for strokes with no `mode` tag |
| `modeOptions` | `object` | `{}` | Per-mode options map (reserved for mode-specific parameters) |

### Methods

- `strokeStart(x, y[, pressure])` — begin a stroke (`pressure` optional; ignored by centerline modes)
- `strokeMove(x, y[, pressure])` — continue a stroke (ingest a point and commit finalized segments)
- `strokeEnd()` — finish a stroke, returns the completed stroke object (tagged with its mode)
- `strokeTap(x, y[, pressure])` — draw a single dot
- `renderPreview()` — repaint the live preview overlay (call once per frame after feeding points; requires `tempCtx`)
- `setMode(id)` — switch the active mode for the next stroke; an unknown id keeps the current mode and logs a warning. Returns the active mode id
- `getMode()` — get the active mode id
- `setColor(r, g, b)` — change stroke color
- `redraw()` — clear and re-render all strokes, routing each to the mode that produced it
- `clear()` — clear canvas and reset document
- `getDocument()` — get serializable document
- `setDocument(doc)` — load and render a document
- `popStroke()` — remove last stroke (undo)
- `pushStroke(stroke)` — add a stroke back (redo)

## Drawing modes

| Mode id | Description |
|---------|-------------|
| `classic` | Tangent-based cubic smoothing with error-bounded knot removal and corner detection (default) |
| `square-bezier` | Midpoint-anchored cubic Béziers with velocity-based width |
| `perfect-freehand` | Pressure-sensitive filled outline via [perfect-freehand](https://github.com/steveruizok/perfect-freehand) |

```js
const engine = new DrawEngine({ ctx, tempCtx, mode: 'perfect-freehand' });
engine.setMode('square-bezier'); // applies to the next stroke started
```

Documents are versioned: newly created documents are `1.1` and tag each stroke
with the mode that produced it. `1.0` documents — and any stroke without a
`mode` tag — replay as `classic`, so older saves render unchanged.

## License

MIT

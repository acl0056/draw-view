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
| `ctx` | `CanvasRenderingContext2D` | required | Canvas context to draw on |
| `strokeRadius` | `number` | `3` | Radius of the stroke |
| `maxError` | `number` | `5` | Error tolerance for knot removal |
| `color` | `{ r, g, b }` | `{ r: 0, g: 0, b: 0 }` | Stroke color |

### Methods

- `strokeStart(x, y)` — begin a stroke
- `strokeMove(x, y)` — continue a stroke
- `strokeEnd()` — finish a stroke, returns the completed stroke object
- `strokeTap(x, y)` — draw a single dot
- `setColor(r, g, b)` — change stroke color
- `redraw()` — clear and re-render all strokes
- `clear()` — clear canvas and reset document
- `getDocument()` — get serializable document
- `setDocument(doc)` — load and render a document
- `popStroke()` — remove last stroke (undo)
- `pushStroke(stroke)` — add a stroke back (redo)

## License

MIT

# draw-view

A real-time stroke-smoothing and curve-fitting engine for HTML5 Canvas drawing.

Converts raw pointer input into smooth strokes, with several interchangeable
drawing modes — from tangent-based cubic smoothing to pressure-sensitive
freehand ink.

[Live demo](https://practicube.com/draw/index.html)

## Packages

| Package | Description |
|---------|-------------|
| [@adamlockhart/draw-view](https://www.npmjs.com/package/@adamlockhart/draw-view) | Framework-independent drawing engine |
| [@adamlockhart/draw-vue](https://www.npmjs.com/package/@adamlockhart/draw-vue) | Vue 3 component wrapper |
| [@adamlockhart/document-engine](https://www.npmjs.com/package/@adamlockhart/document-engine) | localStorage persistence with optional JSON Schema validation |

## Install

```sh
npm install @adamlockhart/draw-view
```

Or with the Vue wrapper:

```sh
npm install @adamlockhart/draw-vue
```

## Usage (vanilla)

```js
import { DrawEngine } from '@adamlockhart/draw-view';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const engine = new DrawEngine({ ctx });

// Feed pointer events:
engine.strokeStart(x, y);
engine.strokeMove(x, y);
engine.strokeEnd();
```

## Usage (Vue)

```vue
<template>
  <DrawView
    :width="800"
    :height="600"
    :color="{ r: 0, g: 0, b: 0 }"
    :stroke-radius="3"
    :mode="mode"
    @stroke="onStroke"
  />
</template>

<script setup>
import { ref } from 'vue';
import { DrawView } from '@adamlockhart/draw-vue';

const mode = ref('classic');

function onStroke(stroke) {
  console.log('completed stroke', stroke);
}
</script>
```

## Features

- Real-time smoothing while the user draws
- Multiple drawing modes: classic smoothing, square Bézier, and pressure-sensitive perfect-freehand
- Tangent-based piecewise cubic curve interpolation (classic mode)
- Error-bounded reduction of redundant input points
- Corner detection preserves sharp direction changes
- Configurable stroke color and radius
- Serializable, versioned drawing documents (each stroke tagged with its mode)

## Drawing modes

The engine ships with three built-in modes, selectable per stroke:

| Mode id | Description |
|---------|-------------|
| `classic` | Tangent-based cubic smoothing with error-bounded knot removal and corner detection (the original algorithm; default) |
| `square-bezier` | Midpoint-anchored cubic Béziers with velocity-based width |
| `perfect-freehand` | Pressure-sensitive filled outline via [perfect-freehand](https://github.com/steveruizok/perfect-freehand) |

Set the initial mode with the `mode` constructor option (vanilla) or the `mode`
prop (Vue), and switch at runtime with `engine.setMode(id)`. See the package
READMEs for details.

## Development

```sh
npm install
npm run build        # build all packages
npm run dev          # start the demo app
```

## History

Extracted from an older jQuery-based implementation into a framework-independent
ES module. The original code is preserved in [`legacy/`](./legacy/). The
classic smoothing algorithm is based on an earlier Objective-C iOS drawing app.

## License

MIT

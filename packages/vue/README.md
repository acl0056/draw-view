# @adamlockhart/draw-vue

Vue 3 component wrapper for [@adamlockhart/draw-view](https://www.npmjs.com/package/@adamlockhart/draw-view).

[Live demo](https://practicube.com/draw/index.html)

## Install

```sh
npm install @adamlockhart/draw-vue
```

Vue 3 is a peer dependency.

## Usage

```vue
<template>
  <DrawView
    ref="drawView"
    :width="800"
    :height="600"
    :color="{ r: 0, g: 0, b: 0 }"
    :stroke-radius="3"
    @stroke="onStroke"
  />
</template>

<script setup>
import { DrawView } from '@adamlockhart/draw-vue';

function onStroke(stroke) {
  console.log('completed stroke', stroke);
}
</script>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number` | `800` | Canvas width |
| `height` | `number` | `600` | Canvas height |
| `strokeRadius` | `number` | `3` | Stroke radius |
| `maxError` | `number` | `5` | Error tolerance for smoothing |
| `color` | `{ r, g, b }` | `{ r: 0, g: 0, b: 0 }` | Stroke color |
| `backgroundColor` | `string` | `'white'` | Canvas background color |

## Events

- `stroke` — emitted when a stroke is completed, with the stroke object

## Exposed Methods

Access via template ref:

- `clear()` — clear the canvas
- `undo()` — remove the last stroke
- `redo(stroke)` — push a stroke back
- `getDocument()` — get the serializable document
- `setDocument(doc)` — load a document
- `getEngine()` — access the underlying DrawEngine instance

## License

MIT

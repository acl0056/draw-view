<template>
  <div
    class="draw-view"
    :style="{ position: 'relative', width: `${width}px`, height: `${height}px` }"
  >
    <!--
      No :width/:height attribute bindings: those are the backing store in
      device pixels and are set imperatively in applyCanvasSize(). The :style
      width/height below is the layout size in CSS pixels.
    -->
    <canvas
      ref="baseCanvas"
      :style="{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor,
      }"
    />
    <canvas
      ref="tempCanvas"
      :style="{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        touchAction: 'none',
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    />
  </div>
</template>

<script setup>
import {
  ref, onMounted, watch, shallowRef,
} from 'vue';
import { DrawEngine } from '@adamlockhart/draw-view';

const props = defineProps({
  width: { type: Number, default: 800 },
  height: { type: Number, default: 600 },
  strokeRadius: { type: Number, default: 3 },
  maxError: { type: Number, default: 1 },
  // Active drawing mode id (e.g. 'classic', 'square-bezier', 'perfect-freehand').
  mode: { type: String, default: 'classic' },
  color: { type: Object, default: () => ({ r: 0, g: 0, b: 0 }) },
  backgroundColor: { type: String, default: 'white' },
  // Device pixels per CSS pixel used for the canvas backing store. 0 (the
  // default) means auto: use window.devicePixelRatio || 1. An explicit value
  // lets a caller pin the ratio or disable scaling entirely (pass 1).
  pixelRatio: { type: Number, default: 0 },
  // Cap on how many coalesced points to process per pointermove. Sits above
  // any realistic per-frame batch, so normal drawing is never decimated; it
  // only engages to tame a runaway batch after a main-thread stall.
  maxPointsPerMove: { type: Number, default: 50 },
  // When true, read PointerEvent.getCoalescedEvents() and feed all (decimated)
  // points per move. When false (default), process a single point per event.
  coalesceInput: { type: Boolean, default: false },
  // When true, the engine skips its inline preview and we repaint the preview
  // overlay once per move via renderPreview(). When false (default), the engine
  // draws the preview inline on every point.
  decoupledPreview: { type: Boolean, default: false },
  // Debug: overlay a marker at each fitted point.
  debugPoints: { type: Boolean, default: false },
});

const emit = defineEmits(['stroke']);

const baseCanvas = ref(null);
const tempCanvas = ref(null);
const engine = shallowRef(null);
let isDrawing = false;

/**
 * Resolve the device-pixel ratio to render at.
 * @returns {number} the explicit `pixelRatio` prop when > 0, else the display's.
 */
function effectivePixelRatio() {
  return props.pixelRatio > 0 ? props.pixelRatio : (window.devicePixelRatio || 1);
}

/**
 * Size both canvases for the current display: backing store in device pixels,
 * layout size in CSS pixels (the latter comes from the :style bindings in the
 * template), then scale each context so all drawing coordinates stay in CSS
 * pixels.
 *
 * IMPORTANT: assigning canvas.width/height resets the entire 2D context state
 * (transform, fillStyle, lineWidth, ...), so the scale MUST be re-applied every
 * time the size changes — which is why the setTransform/scale pair lives here
 * rather than being done once at construction.
 *
 * Note: the engine and modes clear with
 * `clearRect(0, 0, canvas.width, canvas.height)`, i.e. a device-pixel extent
 * fed to a scaled context, so they over-clear in user units. That is intentional
 * and harmless — clearRect is clipped to the canvas — so the core stays
 * DPR-agnostic.
 */
function applyCanvasSize() {
  const ratio = effectivePixelRatio();
  const backingWidth = Math.round(props.width * ratio);
  const backingHeight = Math.round(props.height * ratio);

  [baseCanvas.value, tempCanvas.value].forEach((canvas) => {
    if (!canvas) return;
    canvas.width = backingWidth;
    canvas.height = backingHeight;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
  });
}

onMounted(() => {
  // Size and scale before the engine captures the contexts.
  applyCanvasSize();
  const ctx = baseCanvas.value.getContext('2d');
  const tempCtx = tempCanvas.value.getContext('2d');
  engine.value = new DrawEngine({
    ctx,
    tempCtx,
    strokeRadius: props.strokeRadius,
    maxError: props.maxError,
    mode: props.mode,
    color: props.color,
    decoupledPreview: props.decoupledPreview,
    debugPoints: props.debugPoints,
  });
});

// Resizing (or a DPR change) resets the backing store and wipes the pixels, so
// re-scale and then replay the committed strokes.
watch([() => props.width, () => props.height, () => props.pixelRatio], () => {
  applyCanvasSize();
  if (engine.value) engine.value.redraw();
});

watch(() => props.color, (c) => {
  if (engine.value) engine.value.setColor(c.r, c.g, c.b);
}, { deep: true });

watch(() => props.strokeRadius, (r) => {
  if (engine.value) engine.value.strokeRadius = r;
});

watch(() => props.maxError, (e) => {
  if (engine.value) engine.value.maxError = e;
});

watch(() => props.mode, (m) => {
  if (engine.value) engine.value.setMode(m);
});

watch(() => props.debugPoints, (v) => {
  if (!engine.value) return;
  engine.value.debugPoints = v;
  engine.value.redraw();
});

function pointerPos(e) {
  const rect = tempCanvas.value.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function onPointerDown(e) {
  if (e.button !== 0) return;
  isDrawing = true;
  tempCanvas.value.setPointerCapture(e.pointerId);
  const { x, y } = pointerPos(e);
  engine.value.strokeStart(x, y, e.pressure, e.timeStamp);
}

function onPointerMove(e) {
  if (!isDrawing) return;
  const rect = tempCanvas.value.getBoundingClientRect();
  const move = (ev) => engine.value.strokeMove(
    ev.clientX - rect.left,
    ev.clientY - rect.top,
    ev.pressure,
    ev.timeStamp,
  );

  if (props.coalesceInput) {
    // The browser throttles pointermove delivery but samples input at a higher
    // rate. getCoalescedEvents() returns the intermediate points captured
    // between delivered events, which matters most on mobile and high-refresh
    // displays. Fall back to the event itself where unsupported.
    let events = typeof e.getCoalescedEvents === 'function'
      ? e.getCoalescedEvents()
      : [e];
    if (!events.length) events = [e];

    // Decimate large batches to at most maxPointsPerMove so per-frame work
    // stays bounded. stride is 1 for normal-sized batches (no decimation).
    const stride = Math.max(1, Math.ceil(events.length / props.maxPointsPerMove));
    const lastIndex = events.length - 1;
    for (let i = 0; i < events.length; i += stride) {
      move(events[i]);
    }
    // Always process the most recent sample so the ink stays at the fingertip.
    if (lastIndex % stride !== 0) {
      move(events[lastIndex]);
    }
  } else {
    move(e);
  }

  // When the preview is decoupled from strokeMove, repaint it once here.
  // Otherwise strokeMove already drew it inline.
  if (props.decoupledPreview) {
    engine.value.renderPreview();
  }
}

function onPointerUp() {
  if (!isDrawing) return;
  isDrawing = false;
  const stroke = engine.value.strokeEnd();
  emit('stroke', stroke);
}

/**
 * Expose engine methods for parent component access.
 */
defineExpose({
  getEngine: () => engine.value,
  clear: () => engine.value?.clear(),
  undo: () => engine.value?.popStroke(),
  redo: (stroke) => engine.value?.pushStroke(stroke),
  getDocument: () => engine.value?.getDocument(),
  setDocument: (doc) => engine.value?.setDocument(doc),
});
</script>

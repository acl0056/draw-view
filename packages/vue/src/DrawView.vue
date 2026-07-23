<template>
  <canvas
    ref="canvasRef"
    :width="width"
    :height="height"
    :style="{ touchAction: 'none', backgroundColor: backgroundColor }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  />
</template>

<script setup>
import { ref, onMounted, watch, shallowRef } from 'vue';
import { DrawEngine } from '@adamlockhart/draw-view';

const props = defineProps({
  width: { type: Number, default: 800 },
  height: { type: Number, default: 600 },
  strokeRadius: { type: Number, default: 3 },
  maxError: { type: Number, default: 5 },
  color: { type: Object, default: () => ({ r: 0, g: 0, b: 0 }) },
  backgroundColor: { type: String, default: 'white' },
});

const emit = defineEmits(['stroke']);

const canvasRef = ref(null);
const engine = shallowRef(null);
let isDrawing = false;

onMounted(() => {
  const ctx = canvasRef.value.getContext('2d');
  engine.value = new DrawEngine({
    ctx,
    strokeRadius: props.strokeRadius,
    maxError: props.maxError,
    color: props.color,
  });
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

function onPointerDown(e) {
  if (e.button !== 0) return;
  isDrawing = true;
  canvasRef.value.setPointerCapture(e.pointerId);
  const rect = canvasRef.value.getBoundingClientRect();
  engine.value.strokeStart(e.clientX - rect.left, e.clientY - rect.top);
}

function onPointerMove(e) {
  if (!isDrawing) return;
  const rect = canvasRef.value.getBoundingClientRect();
  engine.value.strokeMove(e.clientX - rect.left, e.clientY - rect.top);
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

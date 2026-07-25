<template>
  <div class="app">
    <nav class="navbar">
      <span class="brand">draw-view.js</span>

      <!-- File dropdown -->
      <div class="dropdown">
        <button class="dropdown-toggle" @click.stop="toggleMenu('file')">file <span class="caret" /></button>
        <ul v-if="openMenu === 'file'" class="dropdown-menu">
          <li @click="newDocument">new</li>
          <li @click="openDocument">open</li>
          <li @click="saveDocument">save</li>
          <li @click="saveDocumentAs">save as</li>
        </ul>
      </div>

      <!-- Color dropdown -->
      <div class="dropdown">
        <button class="dropdown-toggle" @click.stop="toggleMenu('color')">color <span class="caret" /></button>
        <div v-if="openMenu === 'color'" class="dropdown-menu color-menu" @click.stop>
          <Chrome v-model="pickerColor" />
        </div>
      </div>

      <!-- Size dropdown -->
      <div class="dropdown">
        <button class="dropdown-toggle" @click.stop="toggleMenu('size')">size <span class="caret" /></button>
        <ul v-if="openMenu === 'size'" class="dropdown-menu">
          <li v-for="s in sizes" :key="s" @click="strokeRadius = s; openMenu = null">
            {{ s * 2 }}
          </li>
        </ul>
      </div>

      <button class="nav-btn" @click="clearCanvas">clear</button>
      <button class="nav-btn" @click="undo">undo</button>
      <button class="nav-btn" @click="redo">redo</button>
    </nav>

    <div class="canvas-wrap" ref="canvasWrap">
      <DrawView
        ref="drawView"
        :width="canvasWidth"
        :height="canvasHeight"
        :color="currentColor"
        :stroke-radius="strokeRadius"
        :coalesce-input="true"
        :decoupled-preview="true"
        @stroke="onStroke"
      />
    </div>

    <!-- Open dialog -->
    <div v-if="showOpenDialog" class="modal-backdrop" @click="showOpenDialog = false">
      <div class="modal" @click.stop>
        <h3>Open Document</h3>
        <p v-if="!docNames.length">No saved documents.</p>
        <select v-else v-model="selectedDocName">
          <option v-for="name in docNames" :key="name" :value="name">{{ name }}</option>
        </select>
        <div class="modal-buttons">
          <button @click="showOpenDialog = false">Cancel</button>
          <button @click="confirmOpen" :disabled="!selectedDocName">Open</button>
        </div>
      </div>
    </div>

    <!-- Save As dialog -->
    <div v-if="showSaveDialog" class="modal-backdrop" @click="showSaveDialog = false">
      <div class="modal" @click.stop>
        <h3>Save Document</h3>
        <input v-model="saveDocName" placeholder="Enter name" @keyup.enter="confirmSave" />
        <div class="modal-buttons">
          <button @click="showSaveDialog = false">Cancel</button>
          <button @click="confirmSave" :disabled="!saveDocName">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { DrawView } from '@adamlockhart/draw-vue';
import { DocumentEngine } from '@adamlockhart/document-engine';
import { Chrome } from '@ckpack/vue-color';
import drawDocSchema from './draw-document.schema.json';

// --- Document Engine ---
const docs = new DocumentEngine('draw-view', { schema: drawDocSchema });

// --- State ---
const sizes = [2, 3, 4, 5, 6, 12];
const strokeRadius = ref(3);
const canvasWidth = ref(800);
const canvasHeight = ref(600);
const drawView = ref(null);
const canvasWrap = ref(null);
const openMenu = ref(null);
const currentDocName = ref(null);

// Color picker state
const pickerColor = ref({ r: 0, g: 0, b: 0, a: 1 });
const currentColor = computed(() => {
  const c = pickerColor.value.rgba || pickerColor.value;
  return { r: c.r, g: c.g, b: c.b };
});

// Undo/redo
const undoStack = ref([]);
const redoStack = ref([]);

// Dialogs
const showOpenDialog = ref(false);
const showSaveDialog = ref(false);
const docNames = ref([]);
const selectedDocName = ref(null);
const saveDocName = ref('');

// --- Menu ---
function toggleMenu(name) {
  openMenu.value = openMenu.value === name ? null : name;
}

function closeMenus() {
  openMenu.value = null;
}

// --- Drawing callbacks ---
function onStroke(stroke) {
  undoStack.value.push(stroke);
  redoStack.value = [];
}

function undo() {
  if (!drawView.value) return;
  const stroke = drawView.value.undo();
  if (stroke) redoStack.value.push(stroke);
}

function redo() {
  if (!drawView.value || !redoStack.value.length) return;
  const stroke = redoStack.value.pop();
  drawView.value.redo(stroke);
  undoStack.value.push(stroke);
}

function clearCanvas() {
  if (!drawView.value) return;
  drawView.value.clear();
  undoStack.value = [];
  redoStack.value = [];
}

// --- File operations ---
function newDocument() {
  openMenu.value = null;
  clearCanvas();
  currentDocName.value = null;
}

function openDocument() {
  openMenu.value = null;
  docNames.value = docs.list();
  selectedDocName.value = docNames.value[0] || null;
  showOpenDialog.value = true;
}

function confirmOpen() {
  if (!selectedDocName.value) return;
  const doc = docs.load(selectedDocName.value);
  if (doc && drawView.value) {
    drawView.value.setDocument(doc);
    currentDocName.value = selectedDocName.value;
    undoStack.value = [];
    redoStack.value = [];
  }
  showOpenDialog.value = false;
}

function saveDocument() {
  openMenu.value = null;
  if (!currentDocName.value) {
    saveDocumentAs();
    return;
  }
  const doc = drawView.value.getDocument();
  doc.name = currentDocName.value;
  docs.save(currentDocName.value, doc);
}

function saveDocumentAs() {
  openMenu.value = null;
  saveDocName.value = currentDocName.value || '';
  showSaveDialog.value = true;
}

function confirmSave() {
  if (!saveDocName.value || !drawView.value) return;
  const doc = drawView.value.getDocument();
  doc.name = saveDocName.value;
  docs.save(saveDocName.value, doc);
  currentDocName.value = saveDocName.value;
  showSaveDialog.value = false;
}

// --- Resize ---
// Measure the actual container rather than window.innerHeight, which is
// unreliable on mobile with dynamic browser chrome.
function resize() {
  const el = canvasWrap.value;
  if (!el) return;
  canvasWidth.value = el.clientWidth;
  canvasHeight.value = el.clientHeight;
}

onMounted(() => {
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.visualViewport?.addEventListener('resize', resize);
  document.addEventListener('click', closeMenus);
});

onUnmounted(() => {
  window.removeEventListener('resize', resize);
  window.removeEventListener('orientationchange', resize);
  window.visualViewport?.removeEventListener('resize', resize);
  document.removeEventListener('click', closeMenus);
});
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh; /* fallback */
  height: 100dvh; /* matches visible viewport as mobile chrome shows/hides */
  overflow: hidden;
}

.canvas-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.navbar {
  display: flex;
  align-items: center;
  gap: 0;
  height: 40px;
  background: #222;
  padding: 0 12px;
  flex-shrink: 0;
}

.brand {
  font-weight: bold;
  color: #ccc;
  margin-right: 16px;
  font-size: 14px;
}

.dropdown {
  position: relative;
}

.dropdown-toggle {
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: #aaa;
  cursor: pointer;
  font-size: 13px;
}

.dropdown-toggle:hover {
  color: #fff;
}

.caret {
  display: inline-block;
  width: 0;
  height: 0;
  margin-left: 4px;
  vertical-align: middle;
  border-top: 4px solid;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 140px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  list-style: none;
  padding: 4px 0;
  margin: 0;
}

.dropdown-menu li {
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
}

.dropdown-menu li:hover {
  background: #f0f0f0;
}

.color-menu {
  padding: 8px;
  min-width: auto;
}

.nav-btn {
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: #aaa;
  cursor: pointer;
  font-size: 13px;
}

.nav-btn:hover {
  color: #fff;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  min-width: 300px;
  color: #333;
}

.modal h3 {
  margin: 0 0 12px;
}

.modal select,
.modal input {
  width: 100%;
  padding: 8px;
  margin-bottom: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.modal-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modal-buttons button {
  padding: 6px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 13px;
}

.modal-buttons button:last-child {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

.modal-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

/**
 * Barrel for the drawing-mode strategy layer: the DrawingMode contract, the
 * ModeRegistry, and `registerBuiltInModes` — the single place that wires the
 * bundled modes onto a registry.
 *
 * The built-in mode implementations (ClassicSmoothingMode, SquareBezierMode,
 * PerfectFreehandMode) are added in later tasks; `registerBuiltInModes`
 * registers each as it becomes available, so the engine can depend on this
 * seam now without knowing which modes exist yet.
 */

import { ClassicSmoothingMode } from './ClassicSmoothingMode.js';
import { SquareBezierMode } from './SquareBezierMode.js';
import { PerfectFreehandMode } from './PerfectFreehandMode.js';

export { DrawingMode, DEFAULT_MODE_ID } from './DrawingMode.js';
export { ModeRegistry } from './ModeRegistry.js';
export { ClassicSmoothingMode } from './ClassicSmoothingMode.js';
export { SquareBezierMode } from './SquareBezierMode.js';
export { PerfectFreehandMode } from './PerfectFreehandMode.js';

/**
 * Register the built-in drawing modes onto the given registry.
 *
 * Modes are registered here as they are implemented:
 *   registry.register(new ClassicSmoothingMode());   // task 2.1 (done)
 *   registry.register(new SquareBezierMode());        // task 4.1 (done)
 *   registry.register(new PerfectFreehandMode());     // task 5.2 (done)
 *
 * @param {import('./ModeRegistry.js').ModeRegistry} registry
 * @returns {import('./ModeRegistry.js').ModeRegistry} the same registry (for chaining)
 */
export function registerBuiltInModes(registry) {
  if (!registry) {
    throw new Error('registerBuiltInModes requires a ModeRegistry instance');
  }
  registry.register(new ClassicSmoothingMode());
  registry.register(new SquareBezierMode());
  registry.register(new PerfectFreehandMode());
  // Additional built-in modes are registered here as they become available.
  return registry;
}

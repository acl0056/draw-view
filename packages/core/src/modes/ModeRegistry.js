import { DEFAULT_MODE_ID } from './DrawingMode.js';

/**
 * ModeRegistry — maps mode ids to DrawingMode instances and resolves which
 * mode to use for live drawing (active mode) and for replaying a stored stroke
 * (per-stroke mode). It is the seam through which built-in and future custom
 * modes are made available to `DrawEngine`.
 *
 * Resolution rules:
 * - Active mode (`resolveActiveMode`): an unknown id resolves to `null` so the
 *   caller can keep the current active mode and surface a warning (Req 7.2).
 * - Replay mode (`resolveReplayMode`): an unknown or absent id falls back to
 *   the document `defaultMode`, then to `classic`, logging a single warning per
 *   unknown id and never throwing (Req 7.1).
 */
export class ModeRegistry {
  constructor() {
    this._modes = new Map();
    this._warnedUnknownIds = new Set();
  }

  /**
   * Register a mode instance under its `id`.
   * @param {import('./DrawingMode.js').DrawingMode} mode
   * @returns {ModeRegistry} this (for chaining)
   */
  register(mode) {
    if (!mode || typeof mode.id !== 'string' || mode.id.length === 0) {
      throw new Error('ModeRegistry.register requires a mode with a non-empty string `id`');
    }
    this._modes.set(mode.id, mode);
    return this;
  }

  /**
   * @param {string} id
   * @returns {boolean} whether a mode is registered under `id`
   */
  has(id) {
    return this._modes.has(id);
  }

  /**
   * Direct lookup by id.
   * @param {string} id
   * @returns {import('./DrawingMode.js').DrawingMode|undefined}
   */
  get(id) {
    return this._modes.get(id);
  }

  /**
   * All registered mode ids.
   * @returns {string[]}
   */
  ids() {
    return [...this._modes.keys()];
  }

  /**
   * Resolve the mode to activate for live drawing. Returns the registered mode
   * for a known id, or `null` when the id is unknown so the caller can keep the
   * current active mode (Req 7.2).
   * @param {string} requestedId
   * @returns {import('./DrawingMode.js').DrawingMode|null}
   */
  resolveActiveMode(requestedId) {
    if (this._modes.has(requestedId)) return this._modes.get(requestedId);
    return null;
  }

  /**
   * Resolve the mode to replay a stored stroke, applying the fallback chain
   * requested id -> `defaultModeId` -> `classic`. Logs a single warning per
   * unknown id and never throws (Req 7.1). An absent (`null`/`undefined`)
   * requested id is treated as "use the default" without warning, which is how
   * untagged 1.0 strokes resolve to classic.
   * @param {string|null|undefined} requestedId
   * @param {string} [defaultModeId=DEFAULT_MODE_ID]
   * @returns {import('./DrawingMode.js').DrawingMode|null}
   */
  resolveReplayMode(requestedId, defaultModeId = DEFAULT_MODE_ID) {
    const hasRequestedId = requestedId !== null && requestedId !== undefined;
    if (hasRequestedId && this._modes.has(requestedId)) {
      return this._modes.get(requestedId);
    }
    if (hasRequestedId) {
      this._warnUnknownId(requestedId);
    }
    const hasDefaultId = defaultModeId !== null && defaultModeId !== undefined;
    if (hasDefaultId && this._modes.has(defaultModeId)) {
      return this._modes.get(defaultModeId);
    }
    if (this._modes.has(DEFAULT_MODE_ID)) {
      return this._modes.get(DEFAULT_MODE_ID);
    }
    return null;
  }

  _warnUnknownId(id) {
    if (this._warnedUnknownIds.has(id)) return;
    this._warnedUnknownIds.add(id);
    console.warn(`[draw-view] Unknown drawing mode "${id}"; falling back to the default mode.`);
  }
}

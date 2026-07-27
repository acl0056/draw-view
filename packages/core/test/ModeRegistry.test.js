import {
  describe, it, expect, vi, afterEach,
} from 'vitest';
import { ModeRegistry } from '../src/modes/ModeRegistry.js';
import { DEFAULT_MODE_ID } from '../src/modes/DrawingMode.js';

/**
 * Minimal stub mode: the registry only cares about a stable string `id`, so a
 * plain object with an `id` is sufficient to exercise resolution behavior
 * without pulling in a concrete mode implementation.
 */
const stubMode = (id) => ({ id });

const CLASSIC = stubMode(DEFAULT_MODE_ID);

describe('ModeRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register / has / get / ids', () => {
    it('registers a mode and looks it up by id (Req 1.1)', () => {
      const registry = new ModeRegistry();
      const mode = stubMode('square-bezier');

      registry.register(mode);

      expect(registry.has('square-bezier')).toBe(true);
      expect(registry.get('square-bezier')).toBe(mode);
    });

    it('reports has=false and get=undefined for an unregistered id', () => {
      const registry = new ModeRegistry();

      expect(registry.has('nope')).toBe(false);
      expect(registry.get('nope')).toBeUndefined();
    });

    it('lists all registered ids in registration order', () => {
      const registry = new ModeRegistry();

      registry
        .register(CLASSIC)
        .register(stubMode('square-bezier'))
        .register(stubMode('perfect-freehand'));

      expect(registry.ids()).toEqual(['classic', 'square-bezier', 'perfect-freehand']);
    });

    it('returns the registry from register() for chaining', () => {
      const registry = new ModeRegistry();

      expect(registry.register(CLASSIC)).toBe(registry);
    });

    it('overwrites a previously registered mode sharing the same id', () => {
      const registry = new ModeRegistry();
      const first = stubMode('classic');
      const second = stubMode('classic');

      registry.register(first);
      registry.register(second);

      expect(registry.get('classic')).toBe(second);
      expect(registry.ids()).toEqual(['classic']);
    });

    it('rejects a mode without a non-empty string id', () => {
      const registry = new ModeRegistry();

      expect(() => registry.register(undefined)).toThrow(/non-empty string/);
      expect(() => registry.register(null)).toThrow(/non-empty string/);
      expect(() => registry.register({})).toThrow(/non-empty string/);
      expect(() => registry.register({ id: '' })).toThrow(/non-empty string/);
      expect(() => registry.register({ id: 42 })).toThrow(/non-empty string/);
    });
  });

  describe('resolveActiveMode (Req 7.2)', () => {
    it('returns the registered mode for a known id', () => {
      const registry = new ModeRegistry();
      const mode = stubMode('square-bezier');
      registry.register(mode);

      expect(registry.resolveActiveMode('square-bezier')).toBe(mode);
    });

    it('returns null for an unknown id so the caller keeps the current mode', () => {
      const registry = new ModeRegistry();
      registry.register(CLASSIC);

      expect(registry.resolveActiveMode('unknown')).toBeNull();
    });
  });

  describe('resolveReplayMode fallback chain (Req 7.1)', () => {
    it('returns the requested mode when its id is registered', () => {
      const registry = new ModeRegistry();
      const bezier = stubMode('square-bezier');
      registry.register(CLASSIC).register(bezier);

      expect(registry.resolveReplayMode('square-bezier')).toBe(bezier);
    });

    it('falls back to the document defaultMode when the requested id is unknown', () => {
      const registry = new ModeRegistry();
      const bezier = stubMode('square-bezier');
      registry.register(CLASSIC).register(bezier);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(registry.resolveReplayMode('missing', 'square-bezier')).toBe(bezier);
    });

    it('falls back to classic when the requested id is unknown and no default is registered', () => {
      const registry = new ModeRegistry();
      registry.register(CLASSIC);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(registry.resolveReplayMode('missing', 'also-missing')).toBe(CLASSIC);
    });

    it('uses the default without warning for an absent (null) id — untagged 1.0 strokes resolve to classic', () => {
      const registry = new ModeRegistry();
      registry.register(CLASSIC);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(registry.resolveReplayMode(null)).toBe(CLASSIC);
      expect(registry.resolveReplayMode(undefined)).toBe(CLASSIC);
      expect(warn).not.toHaveBeenCalled();
    });

    it('returns null when nothing (requested, default, or classic) is registered', () => {
      const registry = new ModeRegistry();
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(registry.resolveReplayMode('missing', 'also-missing')).toBeNull();
    });
  });

  describe('unknown-id warning dedup (Req 7.1)', () => {
    it('logs a single console.warn per unknown id and never throws', () => {
      const registry = new ModeRegistry();
      registry.register(CLASSIC);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        registry.resolveReplayMode('ghost');
        registry.resolveReplayMode('ghost');
        registry.resolveReplayMode('ghost');
      }).not.toThrow();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('ghost');
    });

    it('warns once for each distinct unknown id', () => {
      const registry = new ModeRegistry();
      registry.register(CLASSIC);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.resolveReplayMode('ghost-a');
      registry.resolveReplayMode('ghost-b');
      registry.resolveReplayMode('ghost-a');

      expect(warn).toHaveBeenCalledTimes(2);
    });
  });
});

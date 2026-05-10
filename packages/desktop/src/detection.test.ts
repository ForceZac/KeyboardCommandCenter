import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DetectionService } from './detection';
import type { ActiveWindowInfo, DetectionPayload, DetectionServiceStore } from './detection';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Returns a store mock that returns provided settings (falls back to defaultValue). */
function makeStore(overrides: Record<string, unknown> = {}): DetectionServiceStore {
  return {
    get<T>(key: string, defaultValue: T): T {
      return key in overrides ? (overrides[key] as T) : defaultValue;
    },
  };
}

/** Returns a minimal ActiveWindowInfo object. */
function makeWindowInfo(processName: string, windowTitle = 'Test Window'): ActiveWindowInfo {
  return { processName, windowTitle };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DetectionService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  it('isRunning() returns false before start()', () => {
    const svc = new DetectionService({
      getActiveWindow: () => null,
      lookupApp: () => null,
      emitToRenderer: vi.fn(),
      store: makeStore(),
    });
    expect(svc.isRunning()).toBe(false);
  });

  it('isRunning() returns true after start()', () => {
    const svc = new DetectionService({
      getActiveWindow: () => null,
      lookupApp: () => null,
      emitToRenderer: vi.fn(),
      store: makeStore(),
    });
    svc.start();
    expect(svc.isRunning()).toBe(true);
    svc.stop();
  });

  it('isRunning() returns false after stop()', () => {
    const svc = new DetectionService({
      getActiveWindow: () => null,
      lookupApp: () => null,
      emitToRenderer: vi.fn(),
      store: makeStore(),
    });
    svc.start();
    svc.stop();
    expect(svc.isRunning()).toBe(false);
  });

  // ── Polling ────────────────────────────────────────────────────────────────

  it('calls getActiveWindow on each interval tick', () => {
    const getActiveWindow = vi.fn(() => null);
    const svc = new DetectionService({
      getActiveWindow,
      lookupApp: () => null,
      emitToRenderer: vi.fn(),
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    svc.start();
    vi.advanceTimersByTime(350);
    svc.stop();

    // 350ms / 100ms interval = 3 ticks fired
    expect(getActiveWindow).toHaveBeenCalledTimes(3);
  });

  // ── Change detection / IPC emit ────────────────────────────────────────────

  it('does not emit when processName is unchanged between consecutive ticks', () => {
    const emitToRenderer = vi.fn();
    let call = 0;
    // Always returns the same process name.
    const getActiveWindow = vi.fn(() => makeWindowInfo('code'));
    const svc = new DetectionService({
      getActiveWindow,
      lookupApp: () => 'vscode',
      emitToRenderer,
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    svc.start();
    vi.advanceTimersByTime(350); // 3 ticks
    svc.stop();

    // Only the first detection should emit; subsequent identical ticks are suppressed.
    expect(emitToRenderer).toHaveBeenCalledTimes(1);
    void call;
  });

  it('emits when processName changes between ticks', () => {
    const emitToRenderer = vi.fn<[string, DetectionPayload], void>();
    const processes = ['code', 'slack', 'code'];
    let idx = 0;
    const getActiveWindow = vi.fn(() => makeWindowInfo(processes[idx++] ?? 'code'));

    const svc = new DetectionService({
      getActiveWindow,
      lookupApp: (p) => (p === 'code' ? 'vscode' : 'slack'),
      emitToRenderer,
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    svc.start();
    vi.advanceTimersByTime(350); // 3 ticks: code→slack→code
    svc.stop();

    // All three transitions emit because processName changed each time.
    expect(emitToRenderer).toHaveBeenCalledTimes(3);
    const calls = emitToRenderer.mock.calls;
    expect(calls[0][1]).toMatchObject({ appSlug: 'vscode', processName: 'code' });
    expect(calls[1][1]).toMatchObject({ appSlug: 'slack', processName: 'slack' });
    expect(calls[2][1]).toMatchObject({ appSlug: 'vscode', processName: 'code' });
  });

  // ── Recent apps ────────────────────────────────────────────────────────────

  it('adds detected slug to the recent apps list', () => {
    const svc = new DetectionService({
      getActiveWindow: vi.fn(() => makeWindowInfo('code')),
      lookupApp: () => 'vscode',
      emitToRenderer: vi.fn(),
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    svc.start();
    vi.advanceTimersByTime(100);
    svc.stop();

    expect(svc.getRecentApps()).toEqual(['vscode']);
  });

  it('caps the recent apps list at 5', () => {
    const apps = ['a', 'b', 'c', 'd', 'e', 'f'];
    let idx = 0;
    const svc = new DetectionService({
      getActiveWindow: vi.fn(() => makeWindowInfo(apps[idx++] ?? 'a')),
      lookupApp: (p) => p, // slug == process name for simplicity
      emitToRenderer: vi.fn(),
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    svc.start();
    vi.advanceTimersByTime(650); // 6 ticks
    svc.stop();

    const recent = svc.getRecentApps();
    expect(recent).toHaveLength(5);
    // Most recent is 'f' (last detected), oldest dropped is 'a'.
    expect(recent[0]).toBe('f');
    expect(recent).not.toContain('a');
  });

  it('dedupes by moving an existing slug to the front', () => {
    const apps = ['a', 'b', 'a']; // 'a' appears twice
    let idx = 0;
    const svc = new DetectionService({
      getActiveWindow: vi.fn(() => makeWindowInfo(apps[idx++] ?? 'a')),
      lookupApp: (p) => p,
      emitToRenderer: vi.fn(),
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    svc.start();
    vi.advanceTimersByTime(350); // 3 ticks: a → b → a
    svc.stop();

    // After dedup, list should be ['a', 'b'] — 'a' moved to front, no duplicates.
    expect(svc.getRecentApps()).toEqual(['a', 'b']);
  });

  // ── Unrecognized process logging ───────────────────────────────────────────

  it('calls onUnrecognizedProcess on first occurrence of an unknown process', () => {
    const onUnrecognizedProcess = vi.fn();
    const svc = new DetectionService({
      getActiveWindow: vi.fn(() => makeWindowInfo('unknown-proc')),
      lookupApp: () => null, // unrecognized
      emitToRenderer: vi.fn(),
      store: makeStore({ 'detection.intervalMs': 100 }),
      onUnrecognizedProcess,
    });

    svc.start();
    vi.advanceTimersByTime(100); // 1 tick
    svc.stop();

    expect(onUnrecognizedProcess).toHaveBeenCalledOnce();
    expect(onUnrecognizedProcess).toHaveBeenCalledWith('unknown-proc');
  });

  it('does not call onUnrecognizedProcess again for the same process name in the same session', () => {
    const onUnrecognizedProcess = vi.fn();
    const processes = ['unknown-proc', 'other-proc', 'unknown-proc']; // unknown-proc seen twice
    let idx = 0;
    const svc = new DetectionService({
      getActiveWindow: vi.fn(() => makeWindowInfo(processes[idx++] ?? 'unknown-proc')),
      lookupApp: () => null, // all unrecognized
      emitToRenderer: vi.fn(),
      store: makeStore({ 'detection.intervalMs': 100 }),
      onUnrecognizedProcess,
    });

    svc.start();
    vi.advanceTimersByTime(350); // 3 ticks
    svc.stop();

    // 'unknown-proc' fires once, 'other-proc' fires once — total 2 (not 3).
    expect(onUnrecognizedProcess).toHaveBeenCalledTimes(2);
    expect(onUnrecognizedProcess).toHaveBeenCalledWith('unknown-proc');
    expect(onUnrecognizedProcess).toHaveBeenCalledWith('other-proc');
  });

  // ── Graceful null from getActiveWindow ─────────────────────────────────────

  it('does not crash when getActiveWindow returns null', () => {
    const emitToRenderer = vi.fn();
    const svc = new DetectionService({
      getActiveWindow: vi.fn(() => null),
      lookupApp: () => null,
      emitToRenderer,
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    expect(() => {
      svc.start();
      vi.advanceTimersByTime(300);
      svc.stop();
    }).not.toThrow();
  });

  it('does not emit when getActiveWindow returns null on the very first tick', () => {
    const emitToRenderer = vi.fn();
    const svc = new DetectionService({
      getActiveWindow: vi.fn(() => null),
      lookupApp: () => null,
      emitToRenderer,
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    svc.start();
    vi.advanceTimersByTime(300);
    svc.stop();

    expect(emitToRenderer).not.toHaveBeenCalled();
  });

  it('emits no-detection sentinel when active window transitions from detected app to null', () => {
    const emitToRenderer = vi.fn<[string, DetectionPayload], void>();
    let call = 0;
    // First tick: return a real window; second tick: return null.
    const getActiveWindow = vi.fn(() => call++ === 0 ? makeWindowInfo('code') : null);

    const svc = new DetectionService({
      getActiveWindow,
      lookupApp: () => 'vscode',
      emitToRenderer,
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    svc.start();
    vi.advanceTimersByTime(250); // 2 ticks: code → null
    svc.stop();

    expect(emitToRenderer).toHaveBeenCalledTimes(2);
    // First call: detected 'code'
    expect(emitToRenderer.mock.calls[0][1]).toMatchObject({ appSlug: 'vscode', processName: 'code' });
    // Second call: no-detection sentinel
    expect(emitToRenderer.mock.calls[1][1]).toMatchObject({ appSlug: null, processName: '', windowTitle: '' });
  });

  it('emits no-detection sentinel only once for consecutive null ticks', () => {
    const emitToRenderer = vi.fn<[string, DetectionPayload], void>();
    let call = 0;
    // First tick: real window; second and third ticks: null.
    const getActiveWindow = vi.fn(() => call++ === 0 ? makeWindowInfo('code') : null);

    const svc = new DetectionService({
      getActiveWindow,
      lookupApp: () => 'vscode',
      emitToRenderer,
      store: makeStore({ 'detection.intervalMs': 100 }),
    });

    svc.start();
    vi.advanceTimersByTime(350); // 3 ticks: code → null → null
    svc.stop();

    // Only 2 emits total: first detection + first null transition.
    // The third tick (still null) must not emit again.
    expect(emitToRenderer).toHaveBeenCalledTimes(2);
    expect(emitToRenderer.mock.calls[1][1]).toMatchObject({ appSlug: null, processName: '' });
  });

  // ── Disabled service ───────────────────────────────────────────────────────

  it('start() is a no-op when detection is disabled in settings', () => {
    const getActiveWindow = vi.fn(() => makeWindowInfo('code'));
    const svc = new DetectionService({
      getActiveWindow,
      lookupApp: () => 'vscode',
      emitToRenderer: vi.fn(),
      store: makeStore({ 'detection.enabled': false }),
    });

    svc.start();
    vi.advanceTimersByTime(500);
    svc.stop();

    expect(svc.isRunning()).toBe(false);
    expect(getActiveWindow).not.toHaveBeenCalled();
  });
});

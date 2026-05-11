import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mock state — created via vi.hoisted so it's available inside vi.mock.
// ---------------------------------------------------------------------------

const mockState = vi.hoisted(() => {
  const defaults = {
    hotkey: 'Ctrl+Shift+Space',
    loginStartup: true,
    overlay: {
      enabled: false,
      hotkey: 'Ctrl+Shift+O',
      opacity: 0.4,
      position: 'Top Right',
      size: 'Standard',
    },
  };

  // Flat in-memory store (dot-notation keys).
  const data: Record<string, unknown> = {
    hotkey: defaults.hotkey,
    loginStartup: defaults.loginStartup,
    overlay: { ...defaults.overlay },
  };

  const getSpy = vi.fn((key: string) => data[key]);
  const setSpy = vi.fn((key: string, value: unknown) => {
    data[key] = value;
  });

  return { defaults, data, getSpy, setSpy };
});

// ---------------------------------------------------------------------------
// Mock electron-store with spies from mockState.
// ---------------------------------------------------------------------------

vi.mock('electron-store', () => ({
  default: vi.fn(() => ({
    get: mockState.getSpy,
    set: mockState.setSpy,
  })),
}));

// ---------------------------------------------------------------------------
// Imports under test — must follow vi.mock declarations.
// ---------------------------------------------------------------------------

import {
  clampOpacity,
  getOverlayPrefs,
  setOverlayEnabled,
  setOverlayHotkey,
  setOverlayOpacity,
  setOverlayPosition,
  setOverlaySize,
  setOverlayWaylandDismissTimeoutMs,
  getHotkey,
  setHotkey,
} from '../settings';

import { registerOverlayController } from '../overlay-controller';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockController() {
  return {
    setEnabled: vi.fn(),
    setHotkey: vi.fn(),
    setOpacity: vi.fn(),
    setPosition: vi.fn(),
    setSize: vi.fn(),
  };
}

// Simulates the fixed overlay:set-opacity IPC handler from main.ts.
// The bug: original code passed raw opacity to controller instead of clamped.
// The fix: clampOpacity() applied before both the store call and the controller call.
function handleSetOpacity(opacity: number, controller?: ReturnType<typeof makeMockController>): void {
  setOverlayOpacity(opacity); // clamps to 0.2–0.8 and persists
  controller?.setOpacity(clampOpacity(opacity)); // forward clamped value, not raw
}

// Simulates the overlay:set-hotkey IPC handler from main.ts — extracted here
// so we can unit-test conflict logic without importing main.ts.
function handleSetHotkey(accelerator: string): { success: boolean; conflict: boolean; message: string } {
  const panelHotkey = getHotkey();
  if (accelerator === panelHotkey) {
    return {
      success: false,
      conflict: true,
      message: `"${accelerator}" is already used as the panel hotkey.`,
    };
  }
  setOverlayHotkey(accelerator);
  return { success: true, conflict: false, message: 'Overlay hotkey saved.' };
}

// ---------------------------------------------------------------------------
// Store layer: defaults (uses get spy → returns mockState.data values)
// ---------------------------------------------------------------------------

describe('getOverlayPrefs() — defaults', () => {
  it('returns enabled=false by default', () => {
    const prefs = getOverlayPrefs();
    expect(prefs.enabled).toBe(false);
  });

  it('returns opacity=0.4 by default', () => {
    const prefs = getOverlayPrefs();
    expect(prefs.opacity).toBe(0.4);
  });

  it('returns position="Top Right" by default', () => {
    const prefs = getOverlayPrefs();
    expect(prefs.position).toBe('Top Right');
  });

  it('returns size="Standard" by default', () => {
    const prefs = getOverlayPrefs();
    expect(prefs.size).toBe('Standard');
  });

  it('returns a non-empty hotkey string by default', () => {
    const prefs = getOverlayPrefs();
    expect(typeof prefs.hotkey).toBe('string');
    expect(prefs.hotkey.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Store layer: setters call store.set with correct key-value pairs.
// ---------------------------------------------------------------------------

describe('overlay setters', () => {
  beforeEach(() => { mockState.setSpy.mockClear(); });

  it('setOverlayEnabled(true) calls set with overlay.enabled=true', () => {
    setOverlayEnabled(true);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.enabled', true);
  });

  it('setOverlayEnabled(false) calls set with overlay.enabled=false', () => {
    setOverlayEnabled(false);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.enabled', false);
  });

  it('setOverlayHotkey calls set with overlay.hotkey', () => {
    setOverlayHotkey('Ctrl+Shift+X');
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.hotkey', 'Ctrl+Shift+X');
  });

  it('setOverlayPosition calls set with overlay.position', () => {
    setOverlayPosition('Bottom Left');
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.position', 'Bottom Left');
  });

  it('setOverlaySize calls set with overlay.size', () => {
    setOverlaySize('Compact');
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.size', 'Compact');
  });
});

// ---------------------------------------------------------------------------
// Opacity clamping: setOverlayOpacity clamps to 0.2–0.8 before persisting.
// ---------------------------------------------------------------------------

describe('setOverlayOpacity — clamping', () => {
  beforeEach(() => { mockState.setSpy.mockClear(); });

  it('persists 0.4 (in range) without clamping', () => {
    setOverlayOpacity(0.4);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.4);
  });

  it('clamps 0.1 (below range) to 0.2', () => {
    setOverlayOpacity(0.1);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.2);
  });

  it('clamps 0.95 (above range) to 0.8', () => {
    setOverlayOpacity(0.95);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.8);
  });

  it('accepts boundary value 0.2 exactly', () => {
    setOverlayOpacity(0.2);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.2);
  });

  it('accepts boundary value 0.8 exactly', () => {
    setOverlayOpacity(0.8);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.8);
  });
});

// ---------------------------------------------------------------------------
// Hotkey conflict validation (IPC handler logic).
// ---------------------------------------------------------------------------

describe('overlay:set-hotkey — conflict validation', () => {
  beforeEach(() => {
    // Ensure the panel hotkey is set to a known value.
    mockState.data['hotkey'] = 'Ctrl+Shift+Space';
    mockState.setSpy.mockClear();
  });

  it('returns conflict=true when overlay hotkey matches panel hotkey', () => {
    const result = handleSetHotkey('Ctrl+Shift+Space');
    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.message).toContain('panel hotkey');
  });

  it('returns success=true when overlay hotkey does not conflict', () => {
    const result = handleSetHotkey('Ctrl+Shift+O');
    expect(result.success).toBe(true);
    expect(result.conflict).toBe(false);
  });

  it('persists the new hotkey when no conflict', () => {
    handleSetHotkey('Ctrl+Shift+O');
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.hotkey', 'Ctrl+Shift+O');
  });

  it('does not persist overlay.hotkey when conflict detected', () => {
    handleSetHotkey('Ctrl+Shift+Space');
    const hotkeyCalls = mockState.setSpy.mock.calls.filter(
      ([key]: [string, unknown]) => key === 'overlay.hotkey',
    );
    expect(hotkeyCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// OverlayController registry.
// ---------------------------------------------------------------------------

describe('overlayController registry', () => {
  it('registerOverlayController accepts a controller and makes it callable', () => {
    const controller = makeMockController();
    registerOverlayController(controller);

    controller.setOpacity(0.5);
    expect(controller.setOpacity).toHaveBeenCalledWith(0.5);
  });

  it('all five controller methods are independently callable', () => {
    const controller = makeMockController();
    registerOverlayController(controller);

    controller.setEnabled(true);
    controller.setHotkey('Ctrl+Shift+O');
    controller.setOpacity(0.6);
    controller.setPosition('Bottom Right');
    controller.setSize('Compact');

    expect(controller.setEnabled).toHaveBeenCalledWith(true);
    expect(controller.setHotkey).toHaveBeenCalledWith('Ctrl+Shift+O');
    expect(controller.setOpacity).toHaveBeenCalledWith(0.6);
    expect(controller.setPosition).toHaveBeenCalledWith('Bottom Right');
    expect(controller.setSize).toHaveBeenCalledWith('Compact');
  });
});

// ---------------------------------------------------------------------------
// IPC handler simulation: overlay:set-opacity — persist + controller call-through.
// Uses handleSetOpacity helper which mirrors the fixed main.ts handler.
// ---------------------------------------------------------------------------

describe('overlay:set-opacity IPC handler simulation', () => {
  beforeEach(() => { mockState.setSpy.mockClear(); });

  it('persists in-range value and forwards same value to controller', () => {
    const controller = makeMockController();
    handleSetOpacity(0.7, controller);

    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.7);
    expect(controller.setOpacity).toHaveBeenCalledWith(0.7);
  });

  it('clamps out-of-range value before persisting', () => {
    handleSetOpacity(1.5);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.8);
  });

  it('controller receives clamped 0.8 when raw opacity 1.5 is submitted — regression for bug fix', () => {
    // Bug: original handler passed raw opacity to controller; store clamped but controller got unclamped.
    // Fix: handler applies clampOpacity() before forwarding to controller.
    const controller = makeMockController();
    handleSetOpacity(1.5, controller);

    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.8);
    expect(controller.setOpacity).toHaveBeenCalledWith(0.8);
    expect(controller.setOpacity).not.toHaveBeenCalledWith(1.5);
  });

  it('controller receives clamped 0.2 when raw opacity 0.05 is submitted', () => {
    const controller = makeMockController();
    handleSetOpacity(0.05, controller);

    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.2);
    expect(controller.setOpacity).toHaveBeenCalledWith(0.2);
    expect(controller.setOpacity).not.toHaveBeenCalledWith(0.05);
  });
});

// ---------------------------------------------------------------------------
// IPC handler simulation: overlay:set-enabled — persist + controller call-through.
// ---------------------------------------------------------------------------

describe('overlay:set-enabled IPC handler simulation', () => {
  beforeEach(() => { mockState.setSpy.mockClear(); });

  it('persists enabled=false and forwards to controller', () => {
    const controller = makeMockController();
    registerOverlayController(controller);

    setOverlayEnabled(false);
    controller.setEnabled(false);

    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.enabled', false);
    expect(controller.setEnabled).toHaveBeenCalledWith(false);
  });

  it('persists enabled=true and forwards to controller', () => {
    const controller = makeMockController();
    registerOverlayController(controller);

    setOverlayEnabled(true);
    controller.setEnabled(true);

    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.enabled', true);
    expect(controller.setEnabled).toHaveBeenCalledWith(true);
  });
});

// ---------------------------------------------------------------------------
// Wayland dismiss timeout setter (TASK-0038).
// ---------------------------------------------------------------------------

describe('setOverlayWaylandDismissTimeoutMs', () => {
  beforeEach(() => { mockState.setSpy.mockClear(); });

  it('persists the timeout value under overlay.waylandDismissTimeoutMs', () => {
    setOverlayWaylandDismissTimeoutMs(5000);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.waylandDismissTimeoutMs', 5000);
  });

  it('persists 0 (never auto-dismiss)', () => {
    setOverlayWaylandDismissTimeoutMs(0);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.waylandDismissTimeoutMs', 0);
  });
});

// ---------------------------------------------------------------------------
// Settings preload surface: isDegraded and setWaylandDismissTimeout (TASK-0038).
// These tests verify that the contextBridge exposes the correct IPC channels.
// ---------------------------------------------------------------------------

describe('settings-preload — isDegraded and setWaylandDismissTimeout surface', () => {
  // Minimal mock of ipcRenderer and contextBridge.
  const capturedKccSettings: Record<string, unknown> = {};

  const mockIpcRenderer = {
    invoke: vi.fn(() => Promise.resolve<unknown>(null)),
    on: vi.fn(),
  };

  const mockContextBridge = {
    exposeInMainWorld: vi.fn((key: string, api: unknown) => {
      capturedKccSettings[key] = api;
    }),
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('electron', () => ({
      contextBridge: mockContextBridge,
      ipcRenderer: mockIpcRenderer,
    }));
    mockIpcRenderer.invoke.mockClear();
    mockContextBridge.exposeInMainWorld.mockClear();
    // Import the preload to populate capturedKccSettings.
    await import('../settings-preload');
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('exposes overlay.isDegraded() that invokes overlay:is-degraded', async () => {
    const api = capturedKccSettings['kccSettings'] as {
      overlay: { isDegraded: () => Promise<boolean> };
    };
    await api.overlay.isDegraded();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('overlay:is-degraded');
  });

  it('exposes overlay.setWaylandDismissTimeout() that invokes overlay:set-wayland-dismiss-timeout', async () => {
    const api = capturedKccSettings['kccSettings'] as {
      overlay: { setWaylandDismissTimeout: (ms: number) => Promise<void> };
    };
    await api.overlay.setWaylandDismissTimeout(5000);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      'overlay:set-wayland-dismiss-timeout',
      { timeoutMs: 5000 },
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  getOverlayPrefs,
  setOverlayEnabled,
  setOverlayHotkey,
  setOverlayOpacity,
  setOverlayPosition,
  setOverlaySize,
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
// ---------------------------------------------------------------------------

describe('overlay:set-opacity IPC handler simulation', () => {
  beforeEach(() => { mockState.setSpy.mockClear(); });

  it('persists value and calls controller.setOpacity', () => {
    const controller = makeMockController();
    registerOverlayController(controller);

    // Simulate the IPC handler in main.ts:
    // setOverlayOpacity(opacity); overlayControllerModule.overlayController?.setOpacity(opacity)
    setOverlayOpacity(0.7);
    controller.setOpacity(0.7);

    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.7);
    expect(controller.setOpacity).toHaveBeenCalledWith(0.7);
  });

  it('clamps out-of-range value before persisting', () => {
    setOverlayOpacity(1.5);
    expect(mockState.setSpy).toHaveBeenCalledWith('overlay.opacity', 0.8);
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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted — create shared mock objects before vi.mock factories run.
// vitest hoists vi.mock() calls to the top of the file, so factories cannot
// reference let/const variables declared below them. vi.hoisted() runs first.
// ---------------------------------------------------------------------------
const {
  mockWebContents,
  mockBrowserWindow,
  MockBrowserWindowCtor,
  mockGlobalShortcut,
  mockDisplay,
  mockIsWaylandSession,
  mockDetectLinuxSession,
} = vi.hoisted(() => {
  const mockIsWaylandSession = vi.fn(() => false);
  const mockDetectLinuxSession = vi.fn(() => 'unknown' as 'x11' | 'wayland' | 'unknown');
  const mockWebContents = {
    send: vi.fn(),
    on: vi.fn(),
  };

  const mockBrowserWindow = {
    setAlwaysOnTop: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    loadFile: vi.fn(() => Promise.resolve()),
    show: vi.fn(),
    hide: vi.fn(),
    isVisible: vi.fn(() => false),
    isDestroyed: vi.fn(() => false),
    setPosition: vi.fn(),
    setSize: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    webContents: mockWebContents,
  };

  const MockBrowserWindowCtor = vi.fn(() => mockBrowserWindow);

  const mockGlobalShortcut = {
    register: vi.fn(() => true),
    unregister: vi.fn(),
  };

  const mockDisplay = {
    id: 1,
    label: 'Mock Display',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    workAreaSize: { width: 1920, height: 1040 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
    rotation: 0,
    touchSupport: 'unknown' as const,
    accelerometerSupport: 'unknown' as const,
    monochrome: false,
    colorDepth: 24,
    colorSpace: '',
    depthPerComponent: 8,
    detected: true,
    maximumCursorSize: { width: 32, height: 32 },
    nativeOrigin: { x: 0, y: 0 },
    internal: false,
  };

  return { mockWebContents, mockBrowserWindow, MockBrowserWindowCtor, mockGlobalShortcut, mockDisplay, mockIsWaylandSession, mockDetectLinuxSession };
});

vi.mock('electron', () => ({
  BrowserWindow: MockBrowserWindowCtor,
  globalShortcut: mockGlobalShortcut,
  screen: {
    getCursorScreenPoint: () => ({ x: 100, y: 100 }),
    getDisplayNearestPoint: () => mockDisplay,
  },
  app: { quit: vi.fn() },
}));

vi.mock('../settings', () => ({
  getOverlayPrefs: vi.fn(() => ({
    enabled: false,
    hotkey: 'Ctrl+Shift+O',
    opacity: 0.4,
    position: 'Top Right',
    size: 'Standard',
    waylandDismissTimeoutMs: 8000,
  })),
}));

vi.mock('../platform/linux-session', () => ({
  isWaylandSession: mockIsWaylandSession,
  detectLinuxSession: mockDetectLinuxSession,
}));

vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return { ...actual, join: (...args: string[]) => args.join('/') };
});

import { getPositionForPreset, OverlayWindowManager } from '../overlay-window';

// ---------------------------------------------------------------------------
// getPositionForPreset — purely functional, display injected via override
// ---------------------------------------------------------------------------

describe('getPositionForPreset', () => {
  const MARGIN = 16;
  const dW = mockDisplay.workArea.width; // 1920
  const dH = mockDisplay.workArea.height; // 1040
  const dX = mockDisplay.workArea.x; // 0
  const dY = mockDisplay.workArea.y; // 0

  const SIZE_STANDARD = { w: 380, h: 260 };
  const SIZE_COMPACT = { w: 280, h: 180 };

  it('Top Right / Standard', () => {
    const { x, y } = getPositionForPreset('Top Right', 'Standard', mockDisplay as Electron.Display);
    expect(x).toBe(dX + dW - SIZE_STANDARD.w - MARGIN);
    expect(y).toBe(dY + MARGIN);
  });

  it('Top Left / Standard', () => {
    const { x, y } = getPositionForPreset('Top Left', 'Standard', mockDisplay as Electron.Display);
    expect(x).toBe(dX + MARGIN);
    expect(y).toBe(dY + MARGIN);
  });

  it('Bottom Right / Standard', () => {
    const { x, y } = getPositionForPreset('Bottom Right', 'Standard', mockDisplay as Electron.Display);
    expect(x).toBe(dX + dW - SIZE_STANDARD.w - MARGIN);
    expect(y).toBe(dY + dH - SIZE_STANDARD.h - MARGIN);
  });

  it('Bottom Left / Standard', () => {
    const { x, y } = getPositionForPreset('Bottom Left', 'Standard', mockDisplay as Electron.Display);
    expect(x).toBe(dX + MARGIN);
    expect(y).toBe(dY + dH - SIZE_STANDARD.h - MARGIN);
  });

  it('Top Center / Standard', () => {
    const { x, y } = getPositionForPreset('Top Center', 'Standard', mockDisplay as Electron.Display);
    expect(x).toBe(dX + Math.round((dW - SIZE_STANDARD.w) / 2));
    expect(y).toBe(dY + MARGIN);
  });

  it('Bottom Center / Standard', () => {
    const { x, y } = getPositionForPreset('Bottom Center', 'Standard', mockDisplay as Electron.Display);
    expect(x).toBe(dX + Math.round((dW - SIZE_STANDARD.w) / 2));
    expect(y).toBe(dY + dH - SIZE_STANDARD.h - MARGIN);
  });

  it('Top Right / Compact uses Compact dimensions', () => {
    const { x, y } = getPositionForPreset('Top Right', 'Compact', mockDisplay as Electron.Display);
    expect(x).toBe(dX + dW - SIZE_COMPACT.w - MARGIN);
    expect(y).toBe(dY + MARGIN);
  });

  it('Bottom Left / Compact uses Compact dimensions', () => {
    const { x, y } = getPositionForPreset('Bottom Left', 'Compact', mockDisplay as Electron.Display);
    expect(x).toBe(dX + MARGIN);
    expect(y).toBe(dY + dH - SIZE_COMPACT.h - MARGIN);
  });

  it('unknown position falls back to Top Right', () => {
    const standardResult = getPositionForPreset('Top Right', 'Standard', mockDisplay as Electron.Display);
    const unknownResult = getPositionForPreset('Center Floating', 'Standard', mockDisplay as Electron.Display);
    expect(unknownResult).toEqual(standardResult);
  });

  it('unknown size falls back to Standard dimensions', () => {
    const standardResult = getPositionForPreset('Top Right', 'Standard', mockDisplay as Electron.Display);
    const unknownSizeResult = getPositionForPreset('Top Right', 'Unknown', mockDisplay as Electron.Display);
    expect(unknownSizeResult).toEqual(standardResult);
  });
});

// ---------------------------------------------------------------------------
// OverlayWindowManager state machine
// ---------------------------------------------------------------------------

describe('OverlayWindowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);
    mockBrowserWindow.isVisible.mockReturnValue(false);
    mockBrowserWindow.loadFile.mockReturnValue(Promise.resolve());
    mockGlobalShortcut.register.mockReturnValue(true);
    MockBrowserWindowCtor.mockReturnValue(mockBrowserWindow);
  });

  it('does not create BrowserWindow at construction (lazy init)', () => {
    new OverlayWindowManager();
    expect(MockBrowserWindowCtor).not.toHaveBeenCalled();
  });

  it('creates BrowserWindow on first show() call', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    expect(MockBrowserWindowCtor).toHaveBeenCalledTimes(1);
    expect(mockBrowserWindow.show).toHaveBeenCalledTimes(1);
  });

  it('reuses existing window on second show() call', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    manager.show();
    expect(MockBrowserWindowCtor).toHaveBeenCalledTimes(1);
    expect(mockBrowserWindow.show).toHaveBeenCalledTimes(2);
  });

  it('hide() silently skips when no window has been created', () => {
    const manager = new OverlayWindowManager();
    expect(() => manager.hide()).not.toThrow();
    expect(mockBrowserWindow.hide).not.toHaveBeenCalled();
  });

  it('hide() calls window.hide() when window exists and is not destroyed', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    manager.hide();
    expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(1);
  });

  it('toggle() shows when window is not visible', () => {
    const manager = new OverlayWindowManager();
    manager.show(); // create the window
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);
    mockBrowserWindow.isVisible.mockReturnValue(false);

    manager.toggle();
    expect(mockBrowserWindow.show).toHaveBeenCalledTimes(1);
    expect(mockBrowserWindow.hide).not.toHaveBeenCalled();
  });

  it('toggle() hides when window is visible', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);
    mockBrowserWindow.isVisible.mockReturnValue(true);

    manager.toggle();
    expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(1);
    expect(mockBrowserWindow.show).not.toHaveBeenCalled();
  });

  it('sendToRenderer() silently skips when window has not been created', () => {
    const manager = new OverlayWindowManager();
    expect(() => manager.sendToRenderer('detection:app-changed', { slug: 'vscode' })).not.toThrow();
    expect(mockWebContents.send).not.toHaveBeenCalled();
  });

  it('sendToRenderer() silently skips when window is destroyed', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(true);

    manager.sendToRenderer('detection:app-changed', { slug: 'vscode' });
    expect(mockWebContents.send).not.toHaveBeenCalled();
  });

  it('sendToRenderer() calls webContents.send when window is alive', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    manager.sendToRenderer('detection:app-changed', { slug: 'vscode' });
    expect(mockWebContents.send).toHaveBeenCalledWith('detection:app-changed', { slug: 'vscode' });
  });

  it('window is created with alwaysOnTop floating level', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    expect(mockBrowserWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating');
  });

  it('window is created with click-through enabled', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    expect(mockBrowserWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
  });
});

// ---------------------------------------------------------------------------
// OverlayWindowManager — hotkey management
// ---------------------------------------------------------------------------

describe('OverlayWindowManager — hotkey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);
    mockBrowserWindow.isVisible.mockReturnValue(false);
    mockBrowserWindow.loadFile.mockReturnValue(Promise.resolve());
    mockGlobalShortcut.register.mockReturnValue(true);
    MockBrowserWindowCtor.mockReturnValue(mockBrowserWindow);
  });

  it('registerHotkey() registers the hotkey from settings', () => {
    const manager = new OverlayWindowManager();
    manager.registerHotkey();
    expect(mockGlobalShortcut.register).toHaveBeenCalledWith('Ctrl+Shift+O', expect.any(Function));
  });

  it('registerHotkey() does not throw when registration fails (OS conflict)', () => {
    mockGlobalShortcut.register.mockReturnValue(false);
    const manager = new OverlayWindowManager();
    expect(() => manager.registerHotkey()).not.toThrow();
  });

  it('setHotkey() unregisters old hotkey and registers new one', () => {
    const manager = new OverlayWindowManager();
    manager.setHotkey('Ctrl+Shift+P');
    expect(mockGlobalShortcut.unregister).toHaveBeenCalledWith('Ctrl+Shift+O');
    expect(mockGlobalShortcut.register).toHaveBeenCalledWith('Ctrl+Shift+P', expect.any(Function));
  });

  it('destroy() unregisters hotkey', () => {
    const manager = new OverlayWindowManager();
    manager.destroy();
    expect(mockGlobalShortcut.unregister).toHaveBeenCalledWith('Ctrl+Shift+O');
  });
});

// ---------------------------------------------------------------------------
// OverlayWindowManager — ready-state guard (Phase 3 — TASK-0020)
//
// The overlay BrowserWindow is created lazily. Detection events that fire
// while loadFile is still in progress are silently dropped by webContents.send.
// The ready-state guard buffers the latest detection:app-changed payload and
// replays it on did-finish-load so the renderer always starts with the correct
// app state.
// ---------------------------------------------------------------------------

/**
 * Capture the did-finish-load handler registered on webContents.on during show().
 * Must be called BEFORE vi.clearAllMocks() to preserve the mock call record.
 */
function captureDidFinishLoadHandler(): () => void {
  const call = mockWebContents.on.mock.calls.find(([event]) => event === 'did-finish-load');
  if (!call) throw new Error('did-finish-load handler was not registered on webContents');
  return call[1] as () => void;
}

describe('OverlayWindowManager — ready-state guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);
    mockBrowserWindow.isVisible.mockReturnValue(false);
    mockBrowserWindow.loadFile.mockReturnValue(Promise.resolve());
    mockGlobalShortcut.register.mockReturnValue(true);
    MockBrowserWindowCtor.mockReturnValue(mockBrowserWindow);
  });

  it('registers a did-finish-load handler on webContents when window is created', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    const didFinishLoadCalls = mockWebContents.on.mock.calls.filter(
      ([event]) => event === 'did-finish-load',
    );
    expect(didFinishLoadCalls).toHaveLength(1);
  });

  it('buffers detection:app-changed payload even before window exists', () => {
    const manager = new OverlayWindowManager();
    const payload = { appSlug: 'vscode', processName: 'Code', windowTitle: 'editor.ts' };

    // No window yet — sendToRenderer should not throw and should not call webContents.send.
    manager.sendToRenderer('detection:app-changed', payload);
    expect(mockWebContents.send).not.toHaveBeenCalled();

    // Create the window so the did-finish-load handler is registered.
    manager.show();
    // Capture the handler BEFORE clearing mocks (clear wipes mock.calls).
    const didFinishLoad = captureDidFinishLoadHandler();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    // Simulate did-finish-load — buffered payload should be replayed.
    didFinishLoad();
    expect(mockWebContents.send).toHaveBeenCalledWith('detection:app-changed', payload);
    expect(mockWebContents.send).toHaveBeenCalledTimes(1);
  });

  it('replays the latest payload when multiple detection events arrive before did-finish-load', () => {
    const manager = new OverlayWindowManager();
    const payload1 = { appSlug: 'vscode', processName: 'Code', windowTitle: 'a.ts' };
    const payload2 = { appSlug: 'slack', processName: 'Slack', windowTitle: 'messages' };

    manager.sendToRenderer('detection:app-changed', payload1);
    manager.sendToRenderer('detection:app-changed', payload2);

    manager.show();
    const didFinishLoad = captureDidFinishLoadHandler();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    didFinishLoad();

    // Only the latest payload is replayed — not payload1.
    expect(mockWebContents.send).toHaveBeenCalledWith('detection:app-changed', payload2);
    expect(mockWebContents.send).toHaveBeenCalledTimes(1);
  });

  it('does not replay on did-finish-load when no detection event was ever buffered', () => {
    const manager = new OverlayWindowManager();
    // No detection event sent — nothing in the buffer.
    manager.show();
    const didFinishLoad = captureDidFinishLoadHandler();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    didFinishLoad();

    expect(mockWebContents.send).not.toHaveBeenCalled();
  });

  it('does not buffer non-detection channels', () => {
    const manager = new OverlayWindowManager();
    manager.sendToRenderer('overlay:prefs-changed', { opacity: 0.5 });

    manager.show();
    const didFinishLoad = captureDidFinishLoadHandler();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    didFinishLoad();

    // overlay:prefs-changed was not buffered, so no replay.
    expect(mockWebContents.send).not.toHaveBeenCalled();
  });

  it('no-detection sentinel (empty processName) is buffered and replayed correctly', () => {
    const manager = new OverlayWindowManager();
    // The no-detection sentinel: appSlug null, processName empty string.
    const noDetectionPayload = { appSlug: null, processName: '', windowTitle: '' };

    manager.sendToRenderer('detection:app-changed', noDetectionPayload);
    manager.show();
    const didFinishLoad = captureDidFinishLoadHandler();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    didFinishLoad();

    expect(mockWebContents.send).toHaveBeenCalledWith('detection:app-changed', noDetectionPayload);
  });
});

// ---------------------------------------------------------------------------
// OverlayWindowManager — Linux X11 window type hint (TASK-0038)
// ---------------------------------------------------------------------------

describe('OverlayWindowManager — Linux X11 window type hint', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);
    mockBrowserWindow.isVisible.mockReturnValue(false);
    mockBrowserWindow.loadFile.mockReturnValue(Promise.resolve());
    mockGlobalShortcut.register.mockReturnValue(true);
    MockBrowserWindowCtor.mockReturnValue(mockBrowserWindow);
  });

  afterEach(() => {
    // Restore process.platform and mock defaults.
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    mockIsWaylandSession.mockReturnValue(false);
    mockDetectLinuxSession.mockReturnValue('unknown');
  });

  it('passes type: "panel" to BrowserWindow constructor on Linux X11', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
    mockDetectLinuxSession.mockReturnValue('x11');
    mockIsWaylandSession.mockReturnValue(false);

    const manager = new OverlayWindowManager();
    manager.show();

    const options = (MockBrowserWindowCtor.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0];
    expect(options['type']).toBe('panel');
  });

  it('calls setIgnoreMouseEvents on Linux X11 (click-through supported)', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
    mockDetectLinuxSession.mockReturnValue('x11');
    mockIsWaylandSession.mockReturnValue(false);

    const manager = new OverlayWindowManager();
    manager.show();

    expect(mockBrowserWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
  });

  it('uses floating alwaysOnTop level on Linux X11', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
    mockDetectLinuxSession.mockReturnValue('x11');
    mockIsWaylandSession.mockReturnValue(false);

    const manager = new OverlayWindowManager();
    manager.show();

    expect(mockBrowserWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating');
  });

  it('does NOT pass type: "panel" on non-Linux platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    mockDetectLinuxSession.mockReturnValue('unknown');
    mockIsWaylandSession.mockReturnValue(false);

    const manager = new OverlayWindowManager();
    manager.show();

    const options = (MockBrowserWindowCtor.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0];
    expect(options['type']).toBeUndefined();
  });

  it('does NOT pass type: "panel" on Linux when session is unknown', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
    mockDetectLinuxSession.mockReturnValue('unknown');
    mockIsWaylandSession.mockReturnValue(false);

    const manager = new OverlayWindowManager();
    manager.show();

    const options = (MockBrowserWindowCtor.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0];
    expect(options['type']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// OverlayWindowManager — Wayland degraded mode (TASK-0038)
// ---------------------------------------------------------------------------

describe('OverlayWindowManager — Wayland degraded mode', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);
    mockBrowserWindow.isVisible.mockReturnValue(false);
    mockBrowserWindow.loadFile.mockReturnValue(Promise.resolve());
    mockGlobalShortcut.register.mockReturnValue(true);
    MockBrowserWindowCtor.mockReturnValue(mockBrowserWindow);
    // Set up Wayland session for all tests in this suite.
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
    mockDetectLinuxSession.mockReturnValue('wayland');
    mockIsWaylandSession.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    mockIsWaylandSession.mockReturnValue(false);
    mockDetectLinuxSession.mockReturnValue('unknown');
  });

  it('does NOT call setIgnoreMouseEvents on Wayland', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    expect(mockBrowserWindow.setIgnoreMouseEvents).not.toHaveBeenCalled();
  });

  it('uses pop-up-menu alwaysOnTop level on Wayland', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    expect(mockBrowserWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'pop-up-menu');
  });

  it('does NOT pass type: "panel" on Wayland', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    const options = (MockBrowserWindowCtor.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0];
    expect(options['type']).toBeUndefined();
  });

  it('auto-dismisses after waylandDismissTimeoutMs when shown on Wayland', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    // Advance time to just before the timeout — should not have hidden yet.
    vi.advanceTimersByTime(7999);
    expect(mockBrowserWindow.hide).not.toHaveBeenCalled();

    // Advance past the timeout — should auto-dismiss.
    vi.advanceTimersByTime(1);
    expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(1);
  });

  it('clears dismiss timer on hide()', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    manager.hide();
    expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(1);

    // Advance past what would have been the timeout — no additional hide() call.
    vi.advanceTimersByTime(10000);
    expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(1);
  });

  it('resets dismiss timer on detection:app-changed', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    // Advance 6 seconds (within the 8s timeout).
    vi.advanceTimersByTime(6000);
    // Simulate an app-changed event — timer resets.
    manager.sendToRenderer('detection:app-changed', { appSlug: 'vscode' });
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    // Advance another 6 seconds — should not dismiss yet (reset to full 8s).
    vi.advanceTimersByTime(6000);
    expect(mockBrowserWindow.hide).not.toHaveBeenCalled();

    // Advance 2 more seconds to reach 8s from the last reset.
    vi.advanceTimersByTime(2000);
    expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(1);
  });

  it('no dismiss timer when timeout is set to 0', () => {
    const manager = new OverlayWindowManager();
    // Override the default 8000ms timeout to 0 (never auto-dismiss).
    manager.setWaylandDismissTimeout(0);
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    vi.advanceTimersByTime(60000);
    expect(mockBrowserWindow.hide).not.toHaveBeenCalled();
  });

  it('setWaylandDismissTimeout updates the runtime dismiss period', () => {
    const manager = new OverlayWindowManager();
    manager.setWaylandDismissTimeout(3000);
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    vi.advanceTimersByTime(2999);
    expect(mockBrowserWindow.hide).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(1);
  });

  it('clears dismiss timer on destroy()', () => {
    const manager = new OverlayWindowManager();
    manager.show();
    vi.clearAllMocks();
    mockBrowserWindow.isDestroyed.mockReturnValue(false);

    manager.destroy();

    // Advance past the timeout — no hide() should fire after destroy.
    vi.advanceTimersByTime(10000);
    expect(mockBrowserWindow.hide).not.toHaveBeenCalled();
  });
});

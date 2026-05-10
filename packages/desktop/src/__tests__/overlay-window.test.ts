import { describe, it, expect, vi, beforeEach } from 'vitest';

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
} = vi.hoisted(() => {
  const mockWebContents = {
    send: vi.fn(),
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

  return { mockWebContents, mockBrowserWindow, MockBrowserWindowCtor, mockGlobalShortcut, mockDisplay };
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
  })),
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

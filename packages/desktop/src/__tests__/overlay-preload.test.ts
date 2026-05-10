import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted — create shared mocks before vi.mock factories run.
// capturedApis is populated as a side effect of importing overlay-preload.ts
// (contextBridge.exposeInMainWorld runs at module load time).
// ---------------------------------------------------------------------------
const { mockIpcRenderer, mockContextBridge, capturedApis } = vi.hoisted(() => {
  const capturedApis: Record<string, unknown> = {};

  const mockIpcRenderer = {
    on: vi.fn(),
    removeListener: vi.fn(),
    invoke: vi.fn(() => Promise.resolve(null)),
  };

  const mockContextBridge = {
    exposeInMainWorld: vi.fn((key: string, api: unknown) => {
      capturedApis[key] = api;
    }),
  };

  return { mockIpcRenderer, mockContextBridge, capturedApis };
});

vi.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
}));

// Side-effect import: executes contextBridge.exposeInMainWorld('kccOverlay', {...})
// which populates capturedApis before the describe blocks run.
import '../overlay-preload';

// ---------------------------------------------------------------------------
// Minimal type matching the KccOverlayAPI surface exposed by the preload.
// ---------------------------------------------------------------------------
interface KccOverlayAPI {
  onAppChanged(callback: (payload: unknown) => void): () => void;
  getShortcutsForApp(slug: string): Promise<unknown>;
  getOverlayPrefs(): Promise<unknown>;
}

describe('overlay-preload', () => {
  // capturedApis is populated at import time — safe to read here.
  const api = capturedApis['kccOverlay'] as KccOverlayAPI;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── contextBridge API shape ──────────────────────────────────────────────────

  describe('API shape — window.kccOverlay matches KccOverlayAPI', () => {
    it('exposes kccOverlay with the three required functions', () => {
      expect(api).toBeDefined();
      expect(typeof api.onAppChanged).toBe('function');
      expect(typeof api.getShortcutsForApp).toBe('function');
      expect(typeof api.getOverlayPrefs).toBe('function');
    });
  });

  // ── onAppChanged ─────────────────────────────────────────────────────────────

  describe('onAppChanged', () => {
    it('registers ipcRenderer.on for detection:app-changed', () => {
      api.onAppChanged(vi.fn());
      expect(mockIpcRenderer.on).toHaveBeenCalledWith('detection:app-changed', expect.any(Function));
    });

    it('returns an unsubscribe function', () => {
      const unsubscribe = api.onAppChanged(vi.fn());
      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribe calls ipcRenderer.removeListener with the same registered handler', () => {
      const cb = vi.fn();
      const unsubscribe = api.onAppChanged(cb);
      // Capture the internal handler that was wired to ipcRenderer.on
      const [, registeredHandler] = mockIpcRenderer.on.mock.calls[0];
      unsubscribe();
      expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith(
        'detection:app-changed',
        registeredHandler,
      );
    });

    it('passes payload to callback, stripping the IPC event argument', () => {
      const cb = vi.fn();
      api.onAppChanged(cb);
      const [, registeredHandler] = mockIpcRenderer.on.mock.calls[0];
      const fakePayload = { slug: 'vscode', name: 'VS Code' };
      // ipcRenderer delivers (_event, payload) — the wrapper must strip _event
      registeredHandler({} /* fake IPC event */, fakePayload);
      expect(cb).toHaveBeenCalledWith(fakePayload);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // ── getShortcutsForApp ───────────────────────────────────────────────────────

  describe('getShortcutsForApp', () => {
    it('invokes shortcuts:get-by-app with the provided slug', async () => {
      await api.getShortcutsForApp('vscode');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('shortcuts:get-by-app', 'vscode');
    });

    it('returns the resolved value from ipcRenderer.invoke', async () => {
      const fakeData = [{ id: 1, key: 'Ctrl+S', description: 'Save' }];
      mockIpcRenderer.invoke.mockResolvedValueOnce(fakeData);
      const result = await api.getShortcutsForApp('vscode');
      expect(result).toEqual(fakeData);
    });
  });

  // ── getOverlayPrefs ──────────────────────────────────────────────────────────

  describe('getOverlayPrefs', () => {
    it('invokes overlay:get channel', async () => {
      await api.getOverlayPrefs();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('overlay:get');
    });

    it('returns the resolved value from ipcRenderer.invoke', async () => {
      const fakePrefs = {
        enabled: true,
        opacity: 0.4,
        position: 'Top Right',
        size: 'Standard',
        hotkey: 'Ctrl+Shift+O',
      };
      mockIpcRenderer.invoke.mockResolvedValueOnce(fakePrefs);
      const result = await api.getOverlayPrefs();
      expect(result).toEqual(fakePrefs);
    });
  });
});

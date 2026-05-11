import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted — mockAutoUpdater must be defined before vi.mock factories run.
// The same pattern used in sync-engine.test.ts for electron.net.
// ---------------------------------------------------------------------------
const { mockAutoUpdater } = vi.hoisted(() => ({
  mockAutoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

import { UpdateService } from '../update-service';
import type { UpdateStatus } from '../update-service';

// ---------------------------------------------------------------------------
// Helper: capture event listeners registered via autoUpdater.on()
// so tests can fire them manually.
// ---------------------------------------------------------------------------
type ListenerMap = Record<string, ((...args: unknown[]) => void) | undefined>;

function captureListeners(): ListenerMap {
  const listeners: ListenerMap = {};
  mockAutoUpdater.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
    listeners[event] = cb;
  });
  return listeners;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UpdateService', () => {
  let notify: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    notify = vi.fn();
    vi.useFakeTimers();
    // Clear any intervals left over from previous tests so they don't fire
    // when this test advances fake time.
    vi.clearAllTimers();
  });

  it('initial status is "idle"', () => {
    const svc = new UpdateService(notify);
    expect(svc.getStatus()).toBe('idle');
  });

  it('start() sets autoDownload and autoInstallOnAppQuit', () => {
    const svc = new UpdateService(notify);
    mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
    svc.start();

    expect(mockAutoUpdater.autoDownload).toBe(true);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
  });

  it('start() registers event listeners on autoUpdater', () => {
    const svc = new UpdateService(notify);
    mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
    svc.start();

    const registeredEvents = mockAutoUpdater.on.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(registeredEvents).toContain('checking-for-update');
    expect(registeredEvents).toContain('update-available');
    expect(registeredEvents).toContain('update-not-available');
    expect(registeredEvents).toContain('download-progress');
    expect(registeredEvents).toContain('update-downloaded');
    expect(registeredEvents).toContain('error');
  });

  it('start() fires checkForUpdates on launch', () => {
    mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
    const svc = new UpdateService(notify);
    svc.start();

    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });

  it('start() fires checkForUpdates again after 4 hours', () => {
    mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
    const svc = new UpdateService(notify);
    svc.start();

    // 1 call on start
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(3);
  });

  it('stop() clears the interval — no further checks after stop()', () => {
    mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
    const svc = new UpdateService(notify);
    svc.start();
    svc.stop();

    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    // Still only 1 call (the initial one) — interval was cleared
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('stop() calls removeAllListeners on autoUpdater', () => {
    mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
    const svc = new UpdateService(notify);
    svc.start();
    svc.stop();

    expect(mockAutoUpdater.removeAllListeners).toHaveBeenCalledOnce();
  });

  it('checkNow() delegates to autoUpdater.checkForUpdates()', () => {
    mockAutoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: {} });
    const svc = new UpdateService(notify);
    void svc.checkNow();

    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });

  it('restartAndInstall() delegates to autoUpdater.quitAndInstall()', () => {
    const svc = new UpdateService(notify);
    svc.restartAndInstall();

    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledOnce();
  });

  describe('status transitions', () => {
    it('checking-for-update event → status "checking" + notify fired', () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
      const listeners = captureListeners();
      const svc = new UpdateService(notify);
      svc.start();

      listeners['checking-for-update']?.();

      expect(svc.getStatus()).toBe<UpdateStatus>('checking');
      expect(notify).toHaveBeenCalledWith('update:status-changed', { status: 'checking' });
    });

    it('update-available event → status "available" + notify fired', () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
      const listeners = captureListeners();
      const svc = new UpdateService(notify);
      svc.start();

      listeners['update-available']?.();

      expect(svc.getStatus()).toBe<UpdateStatus>('available');
      expect(notify).toHaveBeenCalledWith('update:status-changed', { status: 'available' });
    });

    it('update-not-available event → status "idle" + notify fired', () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
      const listeners = captureListeners();
      const svc = new UpdateService(notify);
      svc.start();

      // First go to checking, then not-available resets to idle
      listeners['checking-for-update']?.();
      listeners['update-not-available']?.();

      expect(svc.getStatus()).toBe<UpdateStatus>('idle');
      expect(notify).toHaveBeenLastCalledWith('update:status-changed', { status: 'idle' });
    });

    it('download-progress event → status "downloading" + notify fired', () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
      const listeners = captureListeners();
      const svc = new UpdateService(notify);
      svc.start();

      listeners['download-progress']?.();

      expect(svc.getStatus()).toBe<UpdateStatus>('downloading');
      expect(notify).toHaveBeenCalledWith('update:status-changed', { status: 'downloading' });
    });

    it('update-downloaded event → status "ready" + notify fired', () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
      const listeners = captureListeners();
      const svc = new UpdateService(notify);
      svc.start();

      listeners['update-downloaded']?.();

      expect(svc.getStatus()).toBe<UpdateStatus>('ready');
      expect(notify).toHaveBeenCalledWith('update:status-changed', { status: 'ready' });
    });

    it('error event → status "error" + notify fired', () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
      const listeners = captureListeners();
      const svc = new UpdateService(notify);
      svc.start();

      listeners['error']?.(new Error('network failure'));

      expect(svc.getStatus()).toBe<UpdateStatus>('error');
      expect(notify).toHaveBeenCalledWith('update:status-changed', { status: 'error' });
    });

    it('full lifecycle: idle → checking → downloading → ready', () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(null);
      const listeners = captureListeners();
      const svc = new UpdateService(notify);
      svc.start();

      listeners['checking-for-update']?.();
      expect(svc.getStatus()).toBe<UpdateStatus>('checking');

      listeners['update-available']?.();
      expect(svc.getStatus()).toBe<UpdateStatus>('available');

      listeners['download-progress']?.();
      expect(svc.getStatus()).toBe<UpdateStatus>('downloading');

      listeners['update-downloaded']?.();
      expect(svc.getStatus()).toBe<UpdateStatus>('ready');

      // notify should have been called for each transition
      const notifyCalls = notify.mock.calls.map(
        (call: unknown[]) => (call[1] as { status: UpdateStatus }).status,
      );
      expect(notifyCalls).toEqual(['checking', 'available', 'downloading', 'ready']);
    });
  });
});

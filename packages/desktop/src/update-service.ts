import { autoUpdater } from 'electron-updater';
import type { UpdateCheckResult } from 'electron-updater';

// Status of the update lifecycle — shared with the renderer via IPC.
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

/**
 * UpdateService — wraps electron-updater for background update management.
 *
 * Pattern mirrors DetectionService / SyncEngine: all logic lives here,
 * main.ts stays thin, renderer is decoupled via the notify callback.
 *
 * Guards against running in dev mode (app.isPackaged = false) because
 * electron-updater requires a real GitHub Release + latest.yml to work.
 */
export class UpdateService {
  private readonly notify: (channel: string, payload: unknown) => void;
  private status: UpdateStatus = 'idle';
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** 4 hours in milliseconds — matches PRD requirement. */
  private static readonly CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

  constructor(notify: (channel: string, payload: unknown) => void) {
    this.notify = notify;
  }

  /** Current update lifecycle status (reads synchronously — no async). */
  getStatus(): UpdateStatus {
    return this.status;
  }

  /**
   * Register listeners, fire an initial check, and start the 4-hour interval.
   * Must only be called when app.isPackaged — dev builds have no GitHub Release.
   */
  start(): void {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.setStatus('checking');
    });

    autoUpdater.on('update-available', () => {
      this.setStatus('available');
    });

    autoUpdater.on('update-not-available', () => {
      this.setStatus('idle');
    });

    autoUpdater.on('download-progress', () => {
      this.setStatus('downloading');
    });

    autoUpdater.on('update-downloaded', () => {
      this.setStatus('ready');
    });

    autoUpdater.on('error', (err: Error) => {
      console.error('[kcc:updater] error:', err.message);
      this.setStatus('error');
    });

    // Initial check on launch.
    void autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('[kcc:updater] initial checkForUpdates failed:', err.message);
    });

    // Periodic 4-hour check.
    this.intervalId = setInterval(() => {
      void autoUpdater.checkForUpdates().catch((err: Error) => {
        console.error('[kcc:updater] periodic checkForUpdates failed:', err.message);
      });
    }, UpdateService.CHECK_INTERVAL_MS);
  }

  /**
   * Clear the interval and remove all autoUpdater listeners.
   * Called from app before-quit.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    autoUpdater.removeAllListeners();
  }

  /**
   * Trigger an immediate update check (called from tray "Check for updates" click
   * and from the settings panel button).
   */
  checkNow(): Promise<UpdateCheckResult | null> {
    return autoUpdater.checkForUpdates();
  }

  /**
   * Quit and install the downloaded update.
   * Called when user clicks "Restart to update" in the tray or settings panel.
   */
  restartAndInstall(): void {
    autoUpdater.quitAndInstall();
  }

  private setStatus(newStatus: UpdateStatus): void {
    this.status = newStatus;
    this.notify('update:status-changed', { status: newStatus });
  }
}

/**
 * DetectionService — the polling heart of Goal 4.
 *
 * On each interval tick it calls getActiveWindow(), passes the result through
 * lookupApp(), and emits a 'detection:app-changed' IPC event to the renderer
 * whenever the foreground process changes. It also maintains an in-memory
 * list of the last 5 unique detected app slugs (consumed by the TASK-0011
 * tray submenu) and calls a provided callback for each new unrecognized process.
 *
 * All dependencies are injected via the constructor — the class itself imports
 * only standard Node.js modules (no Electron, no native binaries) so it can
 * be unit-tested with Vitest in a plain Node environment.
 */

/** Shape of the window info returned by the native active-window detector. */
export interface ActiveWindowInfo {
  processName: string;
  windowTitle: string;
  bundleId?: string;
}

/** Payload emitted on the 'detection:app-changed' IPC channel. */
export interface DetectionPayload {
  /** Database app slug, or null when the process is unrecognized. */
  appSlug: string | null;
  /** Raw process executable name. */
  processName: string;
  /** Window title at time of detection. */
  windowTitle: string;
}

/**
 * Minimal store interface needed by DetectionService.
 * Compatible with electron-store's Store.get() signature when a defaultValue is always supplied.
 */
export interface DetectionServiceStore {
  get<T>(key: string, defaultValue: T): T;
}

export interface DetectionServiceOptions {
  /** Injected active window detector — production uses getActiveWindow from TASK-0009. */
  getActiveWindow: () => ActiveWindowInfo | null;
  /** Injected process-to-slug mapper — production uses lookupApp from TASK-0008. */
  lookupApp: (processName: string, bundleId?: string) => string | null;
  /**
   * Called when the detected app changes. Production implementation calls
   * BrowserWindow.webContents.send; test implementations are spies.
   */
  emitToRenderer: (channel: string, payload: DetectionPayload) => void;
  /** Settings store. Reads `detection.enabled` (bool) and `detection.intervalMs` (number). */
  store: DetectionServiceStore;
  /**
   * Called once per session for each new unrecognized process name (appSlug === null).
   * Production: appends to ~/.shortcutvault/unrecognized-processes.log.
   * Tests: pass a vi.fn() spy.
   * Defaults to a no-op — callers must provide a real writer for production.
   */
  onUnrecognizedProcess?: (processName: string) => void;
}

const DEFAULT_INTERVAL_MS = 1500;
const MAX_RECENT_APPS = 5;

export class DetectionService {
  private readonly getActiveWindowFn: () => ActiveWindowInfo | null;
  private readonly lookupAppFn: (processName: string, bundleId?: string) => string | null;
  private readonly emitToRenderer: (channel: string, payload: DetectionPayload) => void;
  private readonly onUnrecognizedProcess: (processName: string) => void;
  private readonly enabled: boolean;
  private readonly intervalMs: number;

  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  /** Last detected state — keyed on processName for change detection. */
  private lastDetected: { processName: string; appSlug: string | null; windowTitle: string } | null =
    null;
  /** Slugs of the last ≤5 unique detected apps, most recent first. */
  private recentApps: string[] = [];
  /** Process names already logged this session — prevents duplicate log entries. */
  private loggedProcesses = new Set<string>();

  constructor(options: DetectionServiceOptions) {
    this.getActiveWindowFn = options.getActiveWindow;
    this.lookupAppFn = options.lookupApp;
    this.emitToRenderer = options.emitToRenderer;
    this.onUnrecognizedProcess = options.onUnrecognizedProcess ?? (() => { /* no-op */ });
    // Read settings once at construction — dynamic reconfiguration deferred to a future goal.
    this.enabled = options.store.get<boolean>('detection.enabled', true);
    this.intervalMs = options.store.get<number>('detection.intervalMs', DEFAULT_INTERVAL_MS);
  }

  /**
   * Start the polling loop.
   * No-op if detection is disabled in settings or the service is already running.
   */
  start(): void {
    if (!this.enabled) return;
    if (this.intervalHandle !== null) return;

    this.intervalHandle = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  /**
   * Stop the polling loop and reset transient state.
   * Safe to call when not running.
   */
  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.lastDetected = null;
  }

  /** Returns true when the polling loop is active. */
  isRunning(): boolean {
    return this.intervalHandle !== null;
  }

  /** Returns a snapshot of the recent-apps list (slugs, most recent first). */
  getRecentApps(): string[] {
    return [...this.recentApps];
  }

  // ---------------------------------------------------------------------------
  // Private — polling internals
  // ---------------------------------------------------------------------------

  private tick(): void {
    const info = this.getActiveWindowFn();

    if (!info) {
      // Transition from a previously-detected app to no active window — emit
      // once so the overlay and panel can show "No app detected" (PRD Flow 3/5).
      // If lastDetected is already null there is nothing new to report.
      if (this.lastDetected !== null) {
        this.lastDetected = null;
        this.emitToRenderer('detection:app-changed', { appSlug: null, processName: '', windowTitle: '' });
      }
      return;
    }

    const { processName, windowTitle, bundleId } = info;
    const appSlug = this.lookupAppFn(processName, bundleId);

    // Emit IPC only when the foreground process actually changes. Keying on
    // processName (not appSlug) ensures transitions to/from unrecognized apps
    // are captured correctly even when both have appSlug === null.
    if (this.lastDetected?.processName === processName) return;

    this.lastDetected = { processName, appSlug, windowTitle };
    this.emitToRenderer('detection:app-changed', { appSlug, processName, windowTitle });

    if (appSlug !== null) {
      this.addToRecentApps(appSlug);
    } else {
      this.handleUnrecognizedProcess(processName);
    }
  }

  /** Inserts slug at the front of recentApps, deduping and capping at MAX_RECENT_APPS. */
  private addToRecentApps(slug: string): void {
    const existing = this.recentApps.indexOf(slug);
    if (existing !== -1) {
      // Move to front rather than adding a duplicate.
      this.recentApps.splice(existing, 1);
    }
    this.recentApps.unshift(slug);
    if (this.recentApps.length > MAX_RECENT_APPS) {
      this.recentApps.length = MAX_RECENT_APPS;
    }
  }

  /**
   * Notifies the caller about an unrecognized process. Each process name is
   * only reported once per session (session-level deduplication).
   */
  private handleUnrecognizedProcess(processName: string): void {
    if (this.loggedProcesses.has(processName)) return;
    this.loggedProcesses.add(processName);
    this.onUnrecognizedProcess(processName);
  }
}

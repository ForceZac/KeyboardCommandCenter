import { BrowserWindow, globalShortcut, screen } from 'electron';
import path from 'path';
import { getOverlayPrefs } from './settings';
import { detectLinuxSession, isWaylandSession } from './platform/linux-session';
import type { OverlayController } from './overlay-controller';

// ---------------------------------------------------------------------------
// Position / size constants
// ---------------------------------------------------------------------------

/** Pixel margin from the screen edge for all preset positions. */
const EDGE_MARGIN = 16;

/** Window dimensions for each size preset. */
const SIZE_MAP: Record<string, { width: number; height: number }> = {
  Compact: { width: 280, height: 180 },
  Standard: { width: 380, height: 260 },
};

/**
 * Compute {x, y} window position for a given position preset and size, anchored
 * to the display nearest the current cursor position (best approximation for the
 * active monitor without window-bounds data from the native module).
 */
export function getPositionForPreset(
  position: string,
  size: string,
  displayOverride?: Electron.Display,
): { x: number; y: number } {
  const { width: winW, height: winH } = SIZE_MAP[size] ?? SIZE_MAP['Standard'];

  const display = displayOverride ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x: dX, y: dY, width: dW, height: dH } = display.workArea;

  switch (position) {
    case 'Top Left':
      return { x: dX + EDGE_MARGIN, y: dY + EDGE_MARGIN };
    case 'Top Right':
      return { x: dX + dW - winW - EDGE_MARGIN, y: dY + EDGE_MARGIN };
    case 'Bottom Left':
      return { x: dX + EDGE_MARGIN, y: dY + dH - winH - EDGE_MARGIN };
    case 'Bottom Right':
      return { x: dX + dW - winW - EDGE_MARGIN, y: dY + dH - winH - EDGE_MARGIN };
    case 'Top Center':
      return { x: dX + Math.round((dW - winW) / 2), y: dY + EDGE_MARGIN };
    case 'Bottom Center':
      return { x: dX + Math.round((dW - winW) / 2), y: dY + dH - winH - EDGE_MARGIN };
    default:
      // Unknown preset → fall back to Top Right.
      return { x: dX + dW - winW - EDGE_MARGIN, y: dY + EDGE_MARGIN };
  }
}

// ---------------------------------------------------------------------------
// OverlayWindowManager
// ---------------------------------------------------------------------------

/**
 * Manages the overlay BrowserWindow: lazy creation, show/hide, hotkey, and
 * prefs forwarding to the renderer.
 *
 * Implements OverlayController so it can be registered via registerOverlayController()
 * in main.ts — the IPC handlers from TASK-0019 then call through to this class.
 */
export class OverlayWindowManager implements OverlayController {
  private window: BrowserWindow | null = null;
  private currentHotkey: string;
  private currentPosition: string;
  private currentSize: string;
  /**
   * Buffers the most recent `detection:app-changed` payload. When the overlay
   * BrowserWindow is created lazily (on first show()), detection events may
   * fire before `loadFile` completes. We store the latest payload here and
   * replay it on `did-finish-load` so the renderer always reflects the current
   * detected app — not a blank or stale state.
   */
  private lastDetectionPayload: unknown = null;

  /**
   * Wayland auto-dismiss timer. Fires hide() after waylandDismissTimeoutMs ms
   * of inactivity. Cleared on hide(), reset on each show() or detection event.
   */
  private _waylandDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private _waylandDismissTimeoutMs: number;

  constructor() {
    const prefs = getOverlayPrefs();
    this.currentHotkey = prefs.hotkey;
    this.currentPosition = prefs.position;
    this.currentSize = prefs.size;
    this._waylandDismissTimeoutMs = prefs.waylandDismissTimeoutMs ?? 8000;
  }

  // ---------------------------------------------------------------------------
  // BrowserWindow creation
  // ---------------------------------------------------------------------------

  private getOrCreateWindow(): BrowserWindow {
    if (this.window !== null && !this.window.isDestroyed()) {
      return this.window;
    }

    const { width: winW, height: winH } = SIZE_MAP[this.currentSize] ?? SIZE_MAP['Standard'];
    const { x, y } = getPositionForPreset(this.currentPosition, this.currentSize);

    // On Linux X11, set the window type hint to _NET_WM_WINDOW_TYPE_DOCK so X11
    // compositors (Mutter/KWin on X11) keep the overlay above other windows.
    const isX11 = process.platform === 'linux' && detectLinuxSession() === 'x11';

    this.window = new BrowserWindow({
      width: winW,
      height: winH,
      x,
      y,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      show: false,
      // 'panel' maps to _NET_WM_WINDOW_TYPE_DOCK on X11 — keeps overlay above
      // other windows and allows click-through under X11 compositors.
      ...(isX11 ? { type: 'panel' as const } : {}),
      webPreferences: {
        preload: OVERLAY_WINDOW_PRELOAD_WEBPACK_ENTRY,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (isWaylandSession()) {
      // On Wayland, setIgnoreMouseEvents is a no-op (Ozone/Wayland backend does
      // not implement mouse event forwarding via the Wayland protocol). Avoid
      // the misleading call and use a higher alwaysOnTop level for degraded mode.
      this.window.setAlwaysOnTop(true, 'pop-up-menu');
    } else {
      // Windows, macOS, and Linux X11: full click-through overlay.
      this.window.setAlwaysOnTop(true, 'floating');
      this.window.setIgnoreMouseEvents(true, { forward: true });
    }

    // Replay the last known detection state once the renderer is ready.
    // This handles the race between lazy window creation and detection events
    // that fire while loadFile is still in progress.
    this.window.webContents.on('did-finish-load', () => {
      if (this.lastDetectionPayload !== null && this.window !== null && !this.window.isDestroyed()) {
        this.window.webContents.send('detection:app-changed', this.lastDetectionPayload);
      }
    });

    // Load the Vite-built overlay renderer from packages/overlay/dist/.
    // __dirname in the webpack-compiled main process is packages/desktop/.webpack/main/.
    // Going up 3 levels reaches packages/, then we enter overlay/dist/.
    const overlayIndexPath = path.join(__dirname, '../../../overlay/dist/index.html');
    this.window.loadFile(overlayIndexPath).catch((err) => {
      console.error('[OverlayWindowManager] Failed to load overlay renderer:', err);
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    return this.window;
  }

  // ---------------------------------------------------------------------------
  // Wayland dismiss timer
  // ---------------------------------------------------------------------------

  /**
   * On Wayland, schedule an auto-dismiss after the configured timeout.
   * Called on show() and on each detection:app-changed event (resets the timer).
   * No-op on non-Wayland sessions or when timeoutMs is 0.
   */
  private maybeScheduleDismiss(): void {
    if (!isWaylandSession()) return;
    this.clearDismissTimer();
    if (this._waylandDismissTimeoutMs > 0) {
      this._waylandDismissTimer = setTimeout(() => {
        this.hide();
      }, this._waylandDismissTimeoutMs);
    }
  }

  private clearDismissTimer(): void {
    if (this._waylandDismissTimer !== null) {
      clearTimeout(this._waylandDismissTimer);
      this._waylandDismissTimer = null;
    }
  }

  /** Update the Wayland dismiss timeout at runtime (called from IPC handler). */
  setWaylandDismissTimeout(ms: number): void {
    this._waylandDismissTimeoutMs = ms;
  }

  // ---------------------------------------------------------------------------
  // Public show / hide / toggle / destroy
  // ---------------------------------------------------------------------------

  show(): void {
    const win = this.getOrCreateWindow();
    win.show();
    // On Wayland, start the auto-dismiss countdown.
    this.maybeScheduleDismiss();
  }

  hide(): void {
    this.clearDismissTimer();
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }

  toggle(): void {
    if (this.window !== null && !this.window.isDestroyed() && this.window.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Forward an IPC event to the overlay renderer webContents.
   *
   * Detection payloads are buffered unconditionally so that if the renderer
   * is not yet loaded (window loading or not yet created), the latest app
   * state is available for replay on `did-finish-load`.
   *
   * On Wayland, each detection event resets the auto-dismiss timer so the
   * overlay stays up while the user is actively looking at shortcuts.
   */
  sendToRenderer(channel: string, payload: unknown): void {
    // Buffer detection events for ready-state replay (Phase 3 — TASK-0020).
    // This runs regardless of whether the window exists yet.
    if (channel === 'detection:app-changed') {
      this.lastDetectionPayload = payload;
      // Reset dismiss timer — user is still active.
      this.maybeScheduleDismiss();
    }
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, payload);
    }
  }

  /**
   * Release the globalShortcut and destroy the BrowserWindow. Called on app quit.
   */
  destroy(): void {
    this.clearDismissTimer();
    if (this.currentHotkey) {
      globalShortcut.unregister(this.currentHotkey);
    }
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.destroy();
      this.window = null;
    }
  }

  // ---------------------------------------------------------------------------
  // OverlayController interface — called by IPC handlers in main.ts
  // ---------------------------------------------------------------------------

  setEnabled(enabled: boolean): void {
    if (enabled) {
      this.registerHotkey();
      this.show();
    } else {
      this.hide();
      this.unregisterHotkey();
    }
  }

  setHotkey(accelerator: string): void {
    this.unregisterHotkey();
    this.currentHotkey = accelerator;
    this.registerHotkey();
  }

  setOpacity(opacity: number): void {
    // Forward live opacity update to the renderer so it can adjust without a reload.
    if (this.window !== null && !this.window.isDestroyed()) {
      const prefs = getOverlayPrefs();
      this.window.webContents.send('overlay:prefs-changed', { ...prefs, opacity });
    }
  }

  setPosition(position: string): void {
    this.currentPosition = position;
    if (this.window !== null && !this.window.isDestroyed()) {
      const { x, y } = getPositionForPreset(position, this.currentSize);
      this.window.setPosition(x, y);
    }
  }

  setSize(size: string): void {
    this.currentSize = size;
    const dims = SIZE_MAP[size] ?? SIZE_MAP['Standard'];
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.setSize(dims.width, dims.height);
      const { x, y } = getPositionForPreset(this.currentPosition, size);
      this.window.setPosition(x, y);
      // Notify renderer so it can adapt layout if needed.
      const prefs = getOverlayPrefs();
      this.window.webContents.send('overlay:prefs-changed', { ...prefs, size });
    }
  }

  // ---------------------------------------------------------------------------
  // Hotkey helpers
  // ---------------------------------------------------------------------------

  /**
   * Register the overlay hotkey with globalShortcut.
   * Logs a warning (does not throw) if the accelerator is already claimed.
   */
  registerHotkey(): void {
    if (!this.currentHotkey) return;
    const registered = globalShortcut.register(this.currentHotkey, () => {
      this.toggle();
    });
    if (!registered) {
      console.warn(
        `[OverlayWindowManager] Failed to register overlay hotkey "${this.currentHotkey}". ` +
          'Another application may be using this shortcut.',
      );
    } else {
      console.log(`[OverlayWindowManager] Registered overlay hotkey: ${this.currentHotkey}`);
    }
  }

  private unregisterHotkey(): void {
    if (this.currentHotkey) {
      globalShortcut.unregister(this.currentHotkey);
    }
  }
}

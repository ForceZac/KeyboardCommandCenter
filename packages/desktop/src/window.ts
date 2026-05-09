import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';

export class PanelWindowManager {
  // Window is null until the first show request (lazy creation).
  private window: BrowserWindow | null = null;

  /**
   * Creates the BrowserWindow on first call, then reuses it.
   * Frameless, always-on-top, centered with a top-third vertical offset.
   */
  private getOrCreateWindow(): BrowserWindow {
    if (this.window !== null) {
      return this.window;
    }

    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize;

    const panelWidth = 680;
    const panelHeight = 420;

    this.window = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      x: Math.round((screenWidth - panelWidth) / 2),
      // Position at the top third of the screen — matches Spotlight/Alfred pattern.
      y: Math.round(screenHeight * 0.25),
      frame: false,
      transparent: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      webPreferences: {
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

    // Dismiss on focus loss — user clicked outside the panel.
    this.window.on('blur', () => {
      this.hide();
    });

    // Prevent the app from quitting if the panel is closed via OS controls.
    this.window.on('closed', () => {
      this.window = null;
    });

    // IPC: renderer sends 'hide-panel' when Escape is pressed.
    ipcMain.on('hide-panel', () => {
      this.hide();
    });

    return this.window;
  }

  show(): void {
    const win = this.getOrCreateWindow();
    win.showInactive(); // showInactive avoids stealing focus from the user's active app
    win.focus();
  }

  hide(): void {
    if (this.window !== null) {
      this.window.hide();
    }
  }

  toggle(): void {
    if (this.window !== null && this.window.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Log idle memory usage to console. Called after the app settles into the tray.
   * PRD target: <50MB RSS.
   */
  logMemoryUsage(): void {
    const mem = process.memoryUsage();
    const rssMb = (mem.rss / 1024 / 1024).toFixed(1);
    console.log(`[Memory] Idle RSS: ${rssMb} MB`);
  }
}

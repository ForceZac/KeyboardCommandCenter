import { BrowserWindow } from 'electron';

export class SettingsWindowManager {
  private window: BrowserWindow | null = null;

  /**
   * Show the settings window. Creates it on first call, then reuses (show/focus on subsequent calls).
   */
  show(): void {
    if (this.window !== null && !this.window.isDestroyed()) {
      this.window.show();
      this.window.focus();
      return;
    }

    this.window = new BrowserWindow({
      width: 480,
      height: 560,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: 'Keyboard Command Center — Settings',
      show: false,
      webPreferences: {
        preload: SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.window.loadURL(SETTINGS_WINDOW_WEBPACK_ENTRY);

    // Show once content is ready to avoid a flash of unstyled content.
    this.window.once('ready-to-show', () => {
      this.window?.show();
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    // Remove the default application menu from the settings window.
    this.window.setMenu(null);
  }
}

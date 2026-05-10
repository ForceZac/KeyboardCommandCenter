// Must be called before app.whenReady() — eliminates the GPU process (~20-40MB RAM savings).
import { app, ipcMain } from 'electron';
app.disableHardwareAcceleration();

import { TrayManager } from './tray';
import { PanelWindowManager } from './window';
import { HotkeyManager, bindHotkeyLifecycle } from './hotkey';
import { SettingsWindowManager } from './settings-window';
import { getLoginStartup, getHotkey, setLoginStartup } from './settings';
// Validate @kcc/core cross-package dependency. IApplication and IShortcut types will be
// used meaningfully in Goal 5 when real shortcut data is displayed in the panel.
import type { IApplication } from '@kcc/core';
void (null as unknown as IApplication); // tree-shaken at build time — type-only reference

// Enforce single-instance: if another instance is already running, quit immediately.
const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
  app.quit();
  process.exit(0);
}

let trayManager: TrayManager;
let panelManager: PanelWindowManager;
let hotkeyManager: HotkeyManager;
let settingsManager: SettingsWindowManager;

app.whenReady().then(() => {
  // Prevent the app from showing a dock icon on macOS — tray-only app.
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  panelManager = new PanelWindowManager();
  settingsManager = new SettingsWindowManager();

  trayManager = new TrayManager(
    () => { panelManager.show(); },
    () => { settingsManager.show(); },
  );
  trayManager.create();

  // HotkeyManager reads the persisted accelerator from electron-store on construction.
  hotkeyManager = new HotkeyManager(() => {
    panelManager.toggle();
  });
  hotkeyManager.register();
  bindHotkeyLifecycle(hotkeyManager);

  // Apply the saved login startup preference on every launch.
  app.setLoginItemSettings({ openAtLogin: getLoginStartup() });

  // IPC: panel renderer sends 'hide-panel' when Escape is pressed.
  ipcMain.on('hide-panel', () => {
    panelManager.hide();
  });

  // IPC: settings renderer — get current settings.
  ipcMain.handle('settings:get', () => ({
    hotkey: getHotkey(),
    loginStartup: getLoginStartup(),
  }));

  // IPC: settings renderer — change global hotkey binding.
  ipcMain.handle('settings:set-hotkey', (_event, accelerator: string) => {
    const result = hotkeyManager.changeBinding(accelerator);
    if (result.success) {
      return { success: true, conflict: false, message: `Hotkey set to ${accelerator}` };
    }
    return {
      success: false,
      conflict: true,
      message: `"${accelerator}" is already in use by another app.`,
    };
  });

  // IPC: settings renderer — toggle login startup preference.
  ipcMain.handle('settings:set-login-startup', (_event, enabled: boolean) => {
    setLoginStartup(enabled);
    app.setLoginItemSettings({ openAtLogin: enabled });
  });

  // Log idle memory usage after everything has settled.
  setTimeout(() => {
    panelManager.logMemoryUsage();
  }, 2000);
});

// On macOS, closing all windows should not quit the app (it lives in the menu bar).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  trayManager?.destroy();
});

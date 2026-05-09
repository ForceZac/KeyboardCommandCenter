// Must be called before app.whenReady() — eliminates the GPU process (~20-40MB RAM savings).
import { app } from 'electron';
app.disableHardwareAcceleration();

import { TrayManager } from './tray';
import { PanelWindowManager } from './window';
import { HotkeyManager, bindHotkeyLifecycle } from './hotkey';

// Enforce single-instance: if another instance is already running, quit immediately.
const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
  app.quit();
}

let trayManager: TrayManager;
let panelManager: PanelWindowManager;
let hotkeyManager: HotkeyManager;

app.whenReady().then(() => {
  // Prevent the app from showing a dock icon on macOS — tray-only app.
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  panelManager = new PanelWindowManager();

  trayManager = new TrayManager(() => {
    panelManager.show();
  });
  trayManager.create();

  hotkeyManager = new HotkeyManager(() => {
    panelManager.toggle();
  });
  hotkeyManager.register();
  bindHotkeyLifecycle(hotkeyManager);

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

// Must be called before app.whenReady() — eliminates the GPU process (~20-40MB RAM savings).
import { app, ipcMain } from 'electron';
app.disableHardwareAcceleration();

import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { TrayManager } from './tray';
import { PanelWindowManager } from './window';
import { SettingsWindowManager } from './settings-window';
import { HotkeyManager, bindHotkeyLifecycle } from './hotkey';
import { DetectionService } from './detection';
import type { DetectionServiceStore } from './detection';
// TASK-0009: real getActiveWindow loaded from native module at merge time.
import { getActiveWindow } from './platform/active-window';
// TASK-0008: real lookupApp and TASK-0011: getDisplayName from process map.
import { lookupApp, getDisplayName } from './process-map';
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

const store = new Store();

let trayManager: TrayManager;
let panelManager: PanelWindowManager;
let settingsWindowManager: SettingsWindowManager;
let hotkeyManager: HotkeyManager;
let detectionService: DetectionService;

// ---------------------------------------------------------------------------
// Unrecognized-process log writer (production implementation).
// DetectionService calls this once per session per unknown process name.
// ---------------------------------------------------------------------------
const logFilePath = path.join(
  app.getPath('home'),
  '.shortcutvault',
  'unrecognized-processes.log',
);
let logDirEnsured = false;

function writeUnrecognizedProcessLog(processName: string): void {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${processName}\n`;
  const logDir = path.dirname(logFilePath);

  const doWrite = (): void => {
    fs.appendFile(logFilePath, line, (err) => {
      if (err) {
        console.error('[kcc] Failed to write unrecognized process log:', err);
      }
    });
  };

  if (logDirEnsured) {
    doWrite();
  } else {
    fs.mkdir(logDir, { recursive: true }, (mkdirErr) => {
      if (mkdirErr) {
        console.error('[kcc] Failed to create log directory:', mkdirErr);
        return;
      }
      logDirEnsured = true;
      doWrite();
    });
  }
}

app.whenReady().then(() => {
  // Prevent the app from showing a dock icon on macOS — tray-only app.
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  panelManager = new PanelWindowManager();
  settingsWindowManager = new SettingsWindowManager();

  trayManager = new TrayManager(
    // onOpenPanel: open the shortcut panel
    () => { panelManager.show(); },
    // onOpenSettings: open the settings window
    () => { settingsWindowManager.show(); },
    // getRecentApps: live list from DetectionService — read at menu-open time
    () => detectionService.getRecentApps(),
    // getDisplayName: slug → human-readable name
    getDisplayName,
    // isDetectionEnabled: reads electron-store at menu-open time
    () => Boolean(store.get('detection.enabled', true)),
    // onOpenPanelWithApp: show panel and send the selected app slug to renderer
    (slug: string) => {
      panelManager.show();
      panelManager.sendToRenderer('detection:app-changed', { slug });
    },
  );
  trayManager.create();

  hotkeyManager = new HotkeyManager(() => {
    panelManager.toggle();
  });
  hotkeyManager.register();
  bindHotkeyLifecycle(hotkeyManager);

  // IPC: renderer sends 'hide-panel' when Escape is pressed.
  ipcMain.on('hide-panel', () => {
    panelManager.hide();
  });

  // Detection polling service (Goal 4 — TASK-0010).
  detectionService = new DetectionService({
    getActiveWindow,
    lookupApp,
    emitToRenderer: (channel, payload) => panelManager.sendToRenderer(channel, payload),
    store: store as DetectionServiceStore,
    onUnrecognizedProcess: writeUnrecognizedProcessLog,
  });

  // IPC: renderer or tray (TASK-0011) queries the in-memory recent-apps list.
  ipcMain.handle('detection:get-recent-apps', () => detectionService.getRecentApps());

  if (store.get('detection.enabled', true)) {
    detectionService.start();
  }

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
  detectionService?.stop();
  trayManager?.destroy();
});

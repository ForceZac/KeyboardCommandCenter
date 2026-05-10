// Must be called before app.whenReady() — eliminates the GPU process (~20-40MB RAM savings).
import { app, ipcMain } from 'electron';
app.disableHardwareAcceleration();

import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { PrismaClient } from '@prisma/client';
import { TrayManager } from './tray';
import { PanelWindowManager } from './window';
import { SettingsWindowManager } from './settings-window';
import { HotkeyManager, bindHotkeyLifecycle } from './hotkey';
import { DetectionService } from './detection';
import type { DetectionServiceStore, DetectionPayload } from './detection';
// TASK-0009: real getActiveWindow loaded from native module at merge time.
import { getActiveWindow } from './platform/active-window';
// TASK-0008: real lookupApp and TASK-0011: getDisplayName from process map.
import { lookupApp, getDisplayName } from './process-map';
// TASK-0012: shortcut data IPC layer.
import { ShortcutService, ShortcutCache } from './shortcut-service';
import type { ShortcutDb } from './shortcut-service';
// TASK-0019: overlay settings store + controller registry.
import {
  getHotkey,
  getOverlayPrefs,
  setOverlayEnabled,
  setOverlayHotkey,
  setOverlayOpacity,
  setOverlayPosition,
  setOverlaySize,
} from './settings';
import * as overlayControllerModule from './overlay-controller';

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
let shortcutService: ShortcutService;
let shortcutCache: ShortcutCache;

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

// ---------------------------------------------------------------------------
// Prefetch helper (TASK-0012).
// Called when detection:app-changed fires. Populates the cache before the
// user opens the panel so IPC responses are served from memory (<50ms).
// Fire-and-forget — no await, does not delay the IPC event to the renderer.
// ---------------------------------------------------------------------------

function prefetchShortcuts(slug: string): void {
  if (shortcutCache.has(slug)) return; // already cached — nothing to do
  shortcutService
    .getShortcutsForApp(slug)
    .then((data) => {
      shortcutCache.set(slug, data);
    })
    .catch((err) => {
      // getShortcutsForApp already catches DB errors and returns null, so this
      // path is a safety net for unexpected rejections.
      console.error('[kcc] prefetchShortcuts unexpected error:', err);
    });
}

app.whenReady().then(() => {
  // Prevent the app from showing a dock icon on macOS — tray-only app.
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  // TASK-0012: Shortcut data IPC layer — instantiate Prisma + service + cache.
  // PrismaClient is cast to ShortcutDb because its complex generic findUnique
  // signature cannot be matched structurally; the runtime shape is compatible.
  const prisma = new PrismaClient();
  shortcutCache = new ShortcutCache();
  shortcutService = new ShortcutService(prisma as unknown as ShortcutDb);

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

  // IPC: renderer requests shortcut data for a given app slug (TASK-0012).
  // Serves from cache when available; otherwise fetches from DB, caches, and returns.
  ipcMain.handle('shortcuts:get-by-app', async (_event, slug: string) => {
    if (shortcutCache.has(slug)) {
      return shortcutCache.get(slug) ?? null;
    }
    const data = await shortcutService.getShortcutsForApp(slug);
    shortcutCache.set(slug, data);
    return data;
  });

  // Detection polling service (Goal 4 — TASK-0010).
  // emitToRenderer is wrapped to trigger a prefetch whenever app-changed fires
  // with a recognized slug — so the cache is warm before the panel opens.
  detectionService = new DetectionService({
    getActiveWindow,
    lookupApp,
    emitToRenderer: (channel: string, payload: DetectionPayload) => {
      if (channel === 'detection:app-changed' && payload.appSlug) {
        prefetchShortcuts(payload.appSlug);
      }
      panelManager.sendToRenderer(channel, payload);
    },
    store: store as DetectionServiceStore,
    onUnrecognizedProcess: writeUnrecognizedProcessLog,
  });

  // IPC: renderer or tray (TASK-0011) queries the in-memory recent-apps list.
  ipcMain.handle('detection:get-recent-apps', () => detectionService.getRecentApps());

  // ---------------------------------------------------------------------------
  // Overlay settings IPC handlers (TASK-0019).
  // All persist to electron-store and forward to overlayController when available.
  // overlayController is null until TASK-0017 registers the overlay BrowserWindow.
  // ---------------------------------------------------------------------------

  ipcMain.handle('overlay:get', () => getOverlayPrefs());

  ipcMain.handle('overlay:set-enabled', (_event, { enabled }: { enabled: boolean }) => {
    setOverlayEnabled(enabled);
    overlayControllerModule.overlayController?.setEnabled(enabled);
  });

  ipcMain.handle('overlay:set-hotkey', (_event, { accelerator }: { accelerator: string }) => {
    // Conflict check: overlay hotkey must not match the panel hotkey.
    const panelHotkey = getHotkey();
    if (accelerator === panelHotkey) {
      return {
        success: false,
        conflict: true,
        message: `"${accelerator}" is already used as the panel hotkey.`,
      };
    }
    setOverlayHotkey(accelerator);
    overlayControllerModule.overlayController?.setHotkey(accelerator);
    return { success: true, conflict: false, message: 'Overlay hotkey saved.' };
  });

  ipcMain.handle('overlay:set-opacity', (_event, { opacity }: { opacity: number }) => {
    setOverlayOpacity(opacity); // clamped inside setOverlayOpacity
    overlayControllerModule.overlayController?.setOpacity(opacity);
  });

  ipcMain.handle('overlay:set-position', (_event, { position }: { position: string }) => {
    setOverlayPosition(position);
    overlayControllerModule.overlayController?.setPosition(position);
  });

  ipcMain.handle('overlay:set-size', (_event, { size }: { size: string }) => {
    setOverlaySize(size);
    overlayControllerModule.overlayController?.setSize(size);
  });

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

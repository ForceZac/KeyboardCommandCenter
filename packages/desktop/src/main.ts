// Must be called before app.whenReady() — eliminates the GPU process (~20-40MB RAM savings).
import { app, ipcMain, Notification } from 'electron';
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
// TASK-0037: getAllApps added for Wayland manual app selector IPC.
import { lookupApp, getDisplayName, getAllApps } from './process-map';
// TASK-0012: shortcut data IPC layer.
import { ShortcutService, ShortcutCache } from './shortcut-service';
import type { ShortcutDb } from './shortcut-service';
// TASK-0017/0019: overlay settings store, controller registry, and window manager.
import {
  clampOpacity,
  getHotkey,
  getOverlayPrefs,
  setOverlayEnabled,
  setOverlayHotkey,
  setOverlayOpacity,
  setOverlayPosition,
  setOverlaySize,
} from './settings';
import * as overlayControllerModule from './overlay-controller';
import { OverlayWindowManager } from './overlay-window';
// TASK-0023: desktop auth flow.
import { AuthStore } from './auth-store';
import {
  initAuth,
  handleDeepLinkCallback,
  openSignIn,
  signOut,
  getAuthState,
  authEvents,
} from './auth';
import type { AuthSignedInPayload } from './auth';
// TASK-0025: favorites sync engine + local cache.
import { SyncStore } from './sync-store';
import { SyncEngine } from './sync-engine';
// TASK-0033: auto-update service.
import { UpdateService } from './update-service';
import type { UpdateStatus } from './update-service';

// Enforce single-instance: if another instance is already running, quit immediately.
const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
  app.quit();
  process.exit(0);
}

// TASK-0023: Register shortcutvault:// custom protocol before app is ready.
// This must be called early so the OS associates the protocol with this executable.
app.setAsDefaultProtocolClient('shortcutvault');

// macOS: deep links arrive via 'open-url' on the already-running instance.
// The OS delivers this after the app is fully running, so initAuth() will have
// been called by the time this fires.
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLinkCallback(url);
});

// Windows: a second instance is launched with the URL in its argv; the
// single-instance lock above routes it here via 'second-instance'.
app.on('second-instance', (_event, argv) => {
  const deepLink = argv.find((arg) => arg.startsWith('shortcutvault://'));
  if (deepLink) {
    handleDeepLinkCallback(deepLink);
  }
});

const store = new Store();

let trayManager: TrayManager;
let panelManager: PanelWindowManager;
let settingsWindowManager: SettingsWindowManager;
let hotkeyManager: HotkeyManager;
let detectionService: DetectionService;
let shortcutService: ShortcutService;
let shortcutCache: ShortcutCache;
let overlayManager: OverlayWindowManager;
let syncEngine: SyncEngine;
let updateService: UpdateService;

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

  // TASK-0017: Overlay window manager — register as the OverlayController so
  // TASK-0019 IPC handlers can reach the real BrowserWindow.
  overlayManager = new OverlayWindowManager();
  overlayControllerModule.registerOverlayController(overlayManager);

  // TASK-0023: Initialize auth store (safeStorage available from this point on).
  const authStore = new AuthStore();
  initAuth(authStore);

  // TASK-0025: Initialize sync store and engine. SyncStore must be created after
  // app.whenReady() so safeStorage (used for encryption key derivation) is available.
  const syncStore = new SyncStore();
  syncEngine = new SyncEngine(syncStore, authStore);

  // Web app base URL for constructing the OAuth sign-in URL.
  // Reads NEXTAUTH_URL from the environment; falls back to local dev server.
  const webAppBaseUrl = process.env['NEXTAUTH_URL'] ?? 'http://localhost:3000';
  const buildSignInUrl = (): string =>
    `${webAppBaseUrl}/auth/signin?callbackUrl=${encodeURIComponent('shortcutvault://auth/callback')}`;

  // TASK-0033: UpdateService — instantiate before TrayManager so getUpdateStatus
  // is available when the tray menu is first built. start() is called after
  // tray setup (below) and only when app.isPackaged (dev builds have no release).
  updateService = new UpdateService((channel: string, payload: unknown) => {
    settingsWindowManager.sendToRenderer(channel, payload);
    // Refresh tray menu so "Restart to update" item appears when download completes.
    if (channel === 'update:status-changed') {
      const { status } = payload as { status: UpdateStatus };
      trayManager.refreshMenu(authStore.isAuthenticated());
      // TASK-0033: fire an OS notification so users know an update is ready
      // even when the tray menu is closed (which it almost always is during
      // a background download).
      if (status === 'ready') {
        new Notification({
          title: 'Keyboard Command Center',
          body: 'Update available — will apply on next restart.',
        }).show();
      }
    }
  });

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
    // TASK-0023: auth state and actions
    () => authStore.isAuthenticated(),
    () => { openSignIn(buildSignInUrl()); },
    () => { signOut(); },
    // TASK-0033: update actions
    () => { void updateService.checkNow(); },
    () => { updateService.restartAndInstall(); },
    () => updateService.getStatus(),
  );
  trayManager.create();

  // TASK-0023: Subscribe to auth state changes and push to settings window + tray.
  // TASK-0025: Also start/stop the sync engine on sign-in/sign-out.
  // Registered after both trayManager and settingsWindowManager are initialized.
  authEvents.on('auth:signed-in', (payload: AuthSignedInPayload) => {
    settingsWindowManager.sendToRenderer('auth:signed-in', payload);
    trayManager.refreshMenu(true);
    syncEngine.start();
  });
  authEvents.on('auth:signed-out', () => {
    settingsWindowManager.sendToRenderer('auth:signed-out', null);
    trayManager.refreshMenu(false);
    syncEngine.stop();
  });

  hotkeyManager = new HotkeyManager(() => {
    panelManager.toggle();
  });
  hotkeyManager.register();
  bindHotkeyLifecycle(hotkeyManager);

  // If overlay was enabled in the previous session, register its hotkey and show it.
  const overlayPrefs = getOverlayPrefs();
  if (overlayPrefs.enabled) {
    overlayManager.registerHotkey();
    overlayManager.show();
  } else {
    // Always register the overlay hotkey so the user can toggle the overlay on
    // even when overlay.enabled is false in the store.
    overlayManager.registerHotkey();
  }

  // IPC: renderer sends 'hide-panel' when Escape is pressed.
  ipcMain.on('hide-panel', () => {
    panelManager.hide();
  });

  // TASK-0023: Auth IPC handlers (settings window renderer → main process).
  ipcMain.handle('auth:get-state', () => getAuthState());
  ipcMain.handle('auth:open-signin', () => { openSignIn(buildSignInUrl()); });
  ipcMain.handle('auth:sign-out', () => { signOut(); });

  // TASK-0033: Update IPC handlers (settings window renderer → main process).
  ipcMain.handle('update:get-status', () => updateService.getStatus());
  ipcMain.handle('update:check-now', () => updateService.checkNow());
  ipcMain.handle('update:restart-and-install', () => { updateService.restartAndInstall(); });
  ipcMain.handle('app:get-version', () => app.getVersion());

  // TASK-0025: Sync IPC handlers (panel renderer → main process).
  // Cache reads (sync:getFavorites, sync:getCollections) return synchronously from
  // memory and complete in <10ms. Sync operations are fire-and-forget.
  // TASK-0026: thin boolean so the renderer can decide sign-in state without
  // inferring from an ambiguous empty-favorites result.
  ipcMain.handle('sync:isSignedIn', () => authStore.isAuthenticated());
  ipcMain.handle('sync:getFavorites', () => syncEngine.getFavorites());
  ipcMain.handle('sync:getCollections', () => syncEngine.getCollections());
  ipcMain.handle('sync:toggleFavorite', (_event, shortcutId: string) => {
    syncEngine.toggleFavorite(shortcutId);
  });
  ipcMain.handle('sync:addToCollection', (_event, shortcutId: string, collectionId: string) => {
    return syncEngine.addToCollection(shortcutId, collectionId);
  });
  ipcMain.handle('sync:removeFromCollection', (_event, shortcutId: string, collectionId: string) => {
    return syncEngine.removeFromCollection(shortcutId, collectionId);
  });
  ipcMain.handle('sync:forceSync', () => syncEngine.forceSync());

  // Renderer forwards its window.ononline event so main process can trigger
  // an unscheduled sync when connectivity is restored.
  ipcMain.on('sync:network-reconnected', () => {
    void syncEngine.triggerSync();
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
  // emitToRenderer also forwards detection:app-changed to the overlay renderer
  // so TASK-0020 can update overlay content on app switch.
  detectionService = new DetectionService({
    getActiveWindow,
    lookupApp,
    emitToRenderer: (channel: string, payload: DetectionPayload) => {
      if (channel === 'detection:app-changed' && payload.appSlug) {
        prefetchShortcuts(payload.appSlug);
      }
      panelManager.sendToRenderer(channel, payload);
      // TASK-0017: forward detection events to the overlay renderer.
      overlayManager.sendToRenderer(channel, payload);
    },
    store: store as DetectionServiceStore,
    onUnrecognizedProcess: writeUnrecognizedProcessLog,
  });

  // IPC: renderer or tray (TASK-0011) queries the in-memory recent-apps list.
  ipcMain.handle('detection:get-recent-apps', () => detectionService.getRecentApps());

  // TASK-0037: Wayland manual app selector — returns all known app slug+name pairs
  // from the process map, sorted alphabetically by name.
  ipcMain.handle('detection:get-all-apps', () => getAllApps());

  // TASK-0037: Wayland manual app selector — renderer sends the user-chosen slug.
  // DetectionService immediately emits detection:app-changed so the panel updates.
  ipcMain.handle('detection:set-manual-app', (_event, slug: string) => {
    detectionService.setManualApp(slug);
  });

  // ---------------------------------------------------------------------------
  // Overlay settings IPC handlers (TASK-0019).
  // All persist to electron-store and forward to overlayController when available.
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
    setOverlayOpacity(opacity); // clamps to 0.2–0.8 and persists
    overlayControllerModule.overlayController?.setOpacity(clampOpacity(opacity));
  });

  // Returns true on Windows and macOS where the overlay feature is supported.
  ipcMain.handle('overlay:is-supported', () => process.platform !== 'linux');

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

  // TASK-0033: Start the update service only in packaged builds — dev builds have
  // no GitHub Release + latest.yml, so autoUpdater would throw immediately.
  if (app.isPackaged) {
    updateService.start();
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
  updateService?.stop();
  trayManager?.destroy();
  overlayManager?.destroy();
});

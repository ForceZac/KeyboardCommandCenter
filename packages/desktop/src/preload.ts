import { contextBridge, ipcRenderer } from 'electron';
import type { DetectionPayload } from './detection';
import type { AppDetail, FavoriteEntry, CollectionSummary } from '@kcc/core';

// TASK-0037: Wayland manual app selector entry shape.
export interface AppEntry {
  slug: string;
  name: string;
}

// Expose a minimal, typed API to the renderer process.
// contextIsolation: true — renderer cannot access Node.js APIs directly.
contextBridge.exposeInMainWorld('kcc', {
  hidePanel: (): void => {
    ipcRenderer.send('hide-panel');
  },

  /**
   * Subscribe to active-app change events. The callback is called whenever the
   * foreground application changes. Returns an unsubscribe function.
   *
   * Payload: { appSlug: string | null, processName: string, windowTitle: string }
   * - appSlug is null when the process is unrecognized.
   */
  onAppChanged: (callback: (payload: DetectionPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: DetectionPayload): void => {
      callback(payload);
    };
    ipcRenderer.on('detection:app-changed', listener);
    // Return an unsubscribe function so the renderer can clean up.
    return () => {
      ipcRenderer.removeListener('detection:app-changed', listener);
    };
  },

  /**
   * Query the in-memory list of the last ≤5 detected app slugs, most recent first.
   * Consumed by the tray "Recent Apps" submenu (TASK-0011).
   */
  getRecentApps: (): Promise<string[]> => {
    return ipcRenderer.invoke('detection:get-recent-apps') as Promise<string[]>;
  },

  /**
   * Fetch shortcut data for the given app slug from the main process cache or DB.
   * Returns null when the slug is unknown or the database is unreachable.
   * Data includes all platform bindings; the renderer filters by OS at display time.
   *
   * Added by TASK-0012.
   */
  getShortcutsForApp: (slug: string): Promise<AppDetail | null> => {
    return ipcRenderer.invoke('shortcuts:get-by-app', slug) as Promise<AppDetail | null>;
  },

  /**
   * TASK-0025: Sync engine namespace — favorites and collections cache access.
   * Cache reads (getFavorites, getCollections) complete synchronously in <10ms.
   * All sync/write operations are async and do not block the UI thread.
   */
  sync: {
    /** Returns true when the user is signed in (TASK-0026). */
    isSignedIn: (): Promise<boolean> => {
      return ipcRenderer.invoke('sync:isSignedIn') as Promise<boolean>;
    },

    /** Returns the locally cached favorites list. Empty array when signed out. */
    getFavorites: (): Promise<FavoriteEntry[]> => {
      return ipcRenderer.invoke('sync:getFavorites') as Promise<FavoriteEntry[]>;
    },

    /** Returns the locally cached collections list. Empty array when signed out. */
    getCollections: (): Promise<CollectionSummary[]> => {
      return ipcRenderer.invoke('sync:getCollections') as Promise<CollectionSummary[]>;
    },

    /**
     * Toggles a shortcut in the default "My Favorites" collection.
     * Optimistic: the local cache updates immediately. No-op when signed out.
     */
    toggleFavorite: (shortcutId: string): Promise<void> => {
      return ipcRenderer.invoke('sync:toggleFavorite', shortcutId) as Promise<void>;
    },

    /**
     * Adds a shortcut to a specific (non-default) collection.
     * Returns { ok: boolean, error?: string }.
     */
    addToCollection: (shortcutId: string, collectionId: string): Promise<{ ok: boolean; error?: string }> => {
      return ipcRenderer.invoke('sync:addToCollection', shortcutId, collectionId) as Promise<{ ok: boolean; error?: string }>;
    },

    /**
     * Removes a shortcut from a specific (non-default) collection.
     * Returns { ok: boolean, error?: string }.
     */
    removeFromCollection: (shortcutId: string, collectionId: string): Promise<{ ok: boolean; error?: string }> => {
      return ipcRenderer.invoke('sync:removeFromCollection', shortcutId, collectionId) as Promise<{ ok: boolean; error?: string }>;
    },

    /** Forces an immediate sync cycle (push pending changes then pull remote state). */
    forceSync: (): Promise<void> => {
      return ipcRenderer.invoke('sync:forceSync') as Promise<void>;
    },
  },

  /**
   * TASK-0025: Forward the browser's network-online event to the main process
   * so the sync engine can trigger an unscheduled sync on reconnect.
   * Usage: window.addEventListener('online', () => window.kcc.notifyNetworkOnline())
   */
  notifyNetworkOnline: (): void => {
    ipcRenderer.send('sync:network-reconnected');
  },

  // ── TASK-0037: Wayland manual app selector IPC ──────────────────────────

  /**
   * Subscribe to Wayland detection-unavailable events.
   * Fired when the Rust layer cannot identify the focused window (unsupported
   * Wayland compositor or all DBus calls failed). Returns an unsubscribe fn.
   */
  onDetectionUnavailable: (callback: () => void): (() => void) => {
    const listener = (): void => { callback(); };
    ipcRenderer.on('detection:unavailable', listener);
    return () => { ipcRenderer.removeListener('detection:unavailable', listener); };
  },

  /**
   * Returns all known app slug+name pairs sorted alphabetically by name.
   * Used to populate the manual app selector dropdown on Wayland.
   */
  getAllApps: (): Promise<AppEntry[]> => {
    return ipcRenderer.invoke('detection:get-all-apps') as Promise<AppEntry[]>;
  },

  /**
   * Sends the user-selected app slug to the main process.
   * DetectionService immediately emits detection:app-changed so the panel updates.
   * The selection persists for the session (until app restart).
   */
  setManualApp: (slug: string): Promise<void> => {
    return ipcRenderer.invoke('detection:set-manual-app', slug) as Promise<void>;
  },
});

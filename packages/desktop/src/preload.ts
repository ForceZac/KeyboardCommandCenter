import { contextBridge, ipcRenderer } from 'electron';
import type { DetectionPayload } from './detection';
import type { AppDetail } from '@kcc/core';

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
});

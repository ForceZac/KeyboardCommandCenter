import { contextBridge, ipcRenderer } from 'electron';
import type { DetectionPayload } from './detection';

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
});

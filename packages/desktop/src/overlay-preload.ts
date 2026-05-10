import { contextBridge, ipcRenderer } from 'electron';

/**
 * Overlay preload — exposes window.kccOverlay to the overlay BrowserWindow renderer.
 *
 * Least-privilege surface: only the three channels the overlay renderer needs.
 * Types match KccOverlayAPI declared in packages/overlay/src/types.ts.
 */
contextBridge.exposeInMainWorld('kccOverlay', {
  /**
   * Subscribe to active-app change events from the detection service.
   * Returns an unsubscribe function that removes the listener.
   */
  onAppChanged(callback: (payload: unknown) => void): () => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (_event: any, payload: unknown) => callback(payload);
    ipcRenderer.on('detection:app-changed', handler);
    return () => {
      ipcRenderer.removeListener('detection:app-changed', handler);
    };
  },

  /**
   * Fetch shortcut data for the given app slug via the main-process cache / DB.
   * Returns null for unknown slugs or when the database is unreachable.
   */
  getShortcutsForApp(slug: string): Promise<unknown> {
    return ipcRenderer.invoke('shortcuts:get-by-app', slug);
  },

  /**
   * Read overlay preferences from electron-store.
   * Returns the current values including opacity, size, position, etc.
   */
  getOverlayPrefs(): Promise<unknown> {
    return ipcRenderer.invoke('overlay:get');
  },
});

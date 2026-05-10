// Type declarations for the API exposed by preload.ts via contextBridge.
// This file is included in tsconfig.renderer.json so the renderer's TypeScript
// knows the shape of window.kcc without importing from the main process.

/** Payload received on each active-app change event. */
interface DetectionPayload {
  /** Database app slug, or null when the process is unrecognized. */
  appSlug: string | null;
  /** Raw process executable name (e.g. "Code", "chrome"). */
  processName: string;
  /** Window title at time of detection. */
  windowTitle: string;
}

interface KccAPI {
  hidePanel: () => void;

  /**
   * Subscribe to active-app change events fired by the detection polling service.
   * Returns an unsubscribe function to remove the listener.
   */
  onAppChanged: (callback: (payload: DetectionPayload) => void) => () => void;

  /**
   * Returns the in-memory list of the last ≤5 detected app slugs (most recent first).
   * Used by the tray "Recent Apps" submenu (TASK-0011).
   */
  getRecentApps: () => Promise<string[]>;
}

declare global {
  interface Window {
    kcc: KccAPI;
  }
}

export {};

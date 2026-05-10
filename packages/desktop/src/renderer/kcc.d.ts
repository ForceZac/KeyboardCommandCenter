// Type declarations for the API exposed by preload.ts via contextBridge.
// This file is included in tsconfig.renderer.json so the renderer's TypeScript
// knows the shape of window.kcc without importing from the main process.

// AppDetail is defined in @kcc/core and available via tsconfig.renderer.json paths.
import type { AppDetail } from '@kcc/core';

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

  /**
   * Fetch shortcut data for the given app slug.
   * Served from the main process cache when available; otherwise queries the DB.
   * Returns null for unknown slugs or when the database is unreachable.
   * All platform bindings are included; the renderer filters by OS at display time.
   *
   * Added by TASK-0012.
   */
  getShortcutsForApp: (slug: string) => Promise<AppDetail | null>;
}

declare global {
  interface Window {
    kcc: KccAPI;
  }
}

export {};

// Type declarations for the API exposed by preload.ts via contextBridge.
// This file is included in tsconfig.renderer.json so the renderer's TypeScript
// knows the shape of window.kcc without importing from the main process.

// AppDetail, FavoriteEntry, and CollectionSummary are re-declared locally in
// types.ts (rootDir constraint prevents importing from @kcc/core directly in
// the renderer tsconfig context).
import type { AppDetail, FavoriteEntry, CollectionSummary } from './types';

/** TASK-0037: App entry used by the Wayland manual app selector. */
interface AppEntry {
  slug: string;
  name: string;
}

/** Payload received on each active-app change event. */
interface DetectionPayload {
  /** Database app slug, or null when the process is unrecognized. */
  appSlug: string | null;
  /** Raw process executable name (e.g. "Code", "chrome"). */
  processName: string;
  /** Window title at time of detection. */
  windowTitle: string;
}

/** TASK-0025/0026: sync engine API exposed to the panel renderer. */
interface SyncAPI {
  /** Returns true when the user is currently signed in (TASK-0026). */
  isSignedIn: () => Promise<boolean>;
  /** Returns the locally cached favorites list. Empty array when signed out. */
  getFavorites: () => Promise<FavoriteEntry[]>;
  /** Returns the locally cached collections list. Empty array when signed out. */
  getCollections: () => Promise<CollectionSummary[]>;
  /** Toggles a shortcut in/out of the default favorites collection (optimistic). */
  toggleFavorite: (shortcutId: string) => Promise<void>;
  /** Adds a shortcut to a specific (non-default) collection. */
  addToCollection: (shortcutId: string, collectionId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Removes a shortcut from a specific (non-default) collection. */
  removeFromCollection: (shortcutId: string, collectionId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Forces an immediate sync cycle. */
  forceSync: () => Promise<void>;
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
   * Fetch shortcut data for the given app slug from the main process cache or DB.
   * Returns null when the slug is unknown or the database is unreachable.
   * All platform bindings are included; the renderer filters by OS at display time.
   *
   * Added by TASK-0012.
   */
  getShortcutsForApp: (slug: string) => Promise<AppDetail | null>;

  /** Notify the main process that network connectivity was restored (TASK-0025). */
  notifyNetworkOnline: () => void;

  /** TASK-0025/0026: Favorites sync engine — cache reads and toggle writes. */
  sync: SyncAPI;

  // ── TASK-0037: Wayland manual app selector ─────────────────────────────────

  /**
   * Subscribe to Wayland detection-unavailable events.
   * Fired when the Rust layer cannot identify the focused window.
   * Returns an unsubscribe function to clean up the listener.
   */
  onDetectionUnavailable: (callback: () => void) => () => void;

  /**
   * Returns all known app slug+name pairs sorted alphabetically.
   * Used to populate the manual app selector on Wayland sessions.
   */
  getAllApps: () => Promise<AppEntry[]>;

  /**
   * Sends the user-chosen app slug to the main process.
   * Triggers an immediate detection:app-changed emission so the panel updates.
   */
  setManualApp: (slug: string) => Promise<void>;
}

declare global {
  interface Window {
    kcc: KccAPI;
  }
}

export {};

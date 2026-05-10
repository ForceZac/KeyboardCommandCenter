/**
 * types.ts — Overlay-specific type aliases and the KccOverlayAPI global declaration.
 *
 * Re-exports the core types needed by the overlay renderer. Also declares
 * window.kccOverlay, the IPC bridge exposed by overlay-preload.ts (TASK-0017).
 */
import type { AppDetail, ShortcutEntry, PlatformBinding } from '@kcc/core';

export type { AppDetail, ShortcutEntry, PlatformBinding };

/** Overlay display preferences stored in electron-store by TASK-0017. */
export interface OverlayPrefs {
  opacity: number;
  size: 'Compact' | 'Standard';
}

/** Payload received on each active-app change event from the detection service. */
export interface DetectionPayload {
  /** Database app slug, or null when the process is unrecognized. */
  appSlug: string | null;
  /** Raw process executable name (e.g. "Code", "chrome"). */
  processName: string;
  /** Window title at time of detection. */
  windowTitle: string;
}

/** Status of the overlay renderer's data state. */
export type OverlayStatus = 'idle' | 'loaded' | 'unrecognized';

/**
 * IPC bridge exposed by overlay-preload.ts via contextBridge.
 * Implemented by TASK-0017; consumed by this renderer.
 */
export interface KccOverlayAPI {
  /**
   * Subscribe to active-app change events. Returns an unsubscribe function.
   * Payload matches DetectionPayload.
   */
  onAppChanged(callback: (payload: DetectionPayload) => void): () => void;

  /**
   * Fetch shortcut data for the given app slug from the main-process cache or DB.
   * Returns null for unknown slugs or when the database is unreachable.
   */
  getShortcutsForApp(slug: string): Promise<AppDetail | null>;

  /**
   * Read overlay preferences from electron-store.
   * Returns defaults ({ opacity: 0.4, size: 'Standard' }) when the store is empty.
   */
  getOverlayPrefs(): Promise<OverlayPrefs>;
}

declare global {
  interface Window {
    kccOverlay: KccOverlayAPI;
  }
}

export {};

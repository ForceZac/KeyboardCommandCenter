/**
 * types.ts — Local re-declarations of @kcc/core types needed by the renderer.
 *
 * The renderer tsconfig has rootDir:"src/renderer" which prevents importing from
 * @kcc/core directly (the package lives outside rootDir). These declarations mirror
 * the authoritative types in packages/core/src/types.ts — if core types change,
 * update here too.
 *
 * Re-declared types: AppDetail, ShortcutEntry, PlatformBinding (runtime-relevant shapes only).
 */

/** A shortcut binding for a single platform. */
export interface PlatformBinding {
  platformSlug: string;
  /** Full chord display string, e.g. "Ctrl+K → Ctrl+C". Joined with ' → ' separator. */
  keyCombo: string;
}

/** One shortcut entry within an AppDetail context group. */
export interface ShortcutEntry {
  id: string;
  command: string;
  platforms: PlatformBinding[];
}

/**
 * AppDetail — response from getShortcutsForApp().
 * Shortcuts are grouped by context/scope (e.g. "Global", "Editor").
 */
export interface AppDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categorySlug: string;
  contexts: Record<string, ShortcutEntry[]>;
}

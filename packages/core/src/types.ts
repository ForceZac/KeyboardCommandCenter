/**
 * @kcc/core — domain types for KeyboardCommandCenter
 *
 * Hand-written interfaces kept free of @prisma/client so this package
 * can be imported by web, desktop, and overlay without pulling in the
 * Prisma runtime.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Canonical modifier key names. Seed scripts normalize to these before inserting. */
export type ModifierKey =
  | "Ctrl"
  | "Cmd"
  | "Alt"
  | "Option"
  | "Shift"
  | "Super"
  | "Win"
  | "Meta";

/** Supported OS platform slugs. */
export type PlatformSlug = "windows" | "macos" | "linux";

/**
 * Top-level category slugs matching the PRD taxonomy.
 * The seed script uses these values for the `slug` column.
 */
export type CategorySlug =
  | "creative"
  | "developer-tools"
  | "productivity"
  | "gaming"
  | "music"
  | "system"
  | "browsers";

/**
 * Context/scope string for a shortcut — where it is active within an app.
 * Values are app-defined (e.g. "Global", "Editor", "Normal Mode", "Insert Mode").
 * Using a string alias keeps this open-ended without an enum that diverges from real data.
 */
export type ShortcutContext = string;

// ---------------------------------------------------------------------------
// Model interfaces
// ---------------------------------------------------------------------------

export interface ICategory {
  id: string;
  name: string;
  slug: CategorySlug | string; // string fallback for values not yet in the union
}

export interface IPlatform {
  id: string;
  name: string;
  slug: PlatformSlug | string;
}

export interface IApplication {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
}

export interface IShortcut {
  id: string;
  applicationId: string;
  command: string;
  context: ShortcutContext | null;
}

export interface IShortcutKeyBinding {
  id: string;
  shortcutId: string;
  platformId: string;
}

export interface IShortcutKeyStep {
  id: string;
  bindingId: string;
  /** 1-based. Single shortcuts have stepOrder = 1. */
  stepOrder: number;
  /** Display string e.g. "Ctrl+Shift+P" */
  keyCombo: string;
  /** Base key e.g. "p" */
  key: string;
  /** Normalized modifier names e.g. ["Ctrl", "Shift"] */
  modifiers: ModifierKey[];
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

/** One key-press step within a platform binding. */
export interface KeyStepSummary {
  stepOrder: number;
  keyCombo: string;
  key: string;
  modifiers: string[];
}

/** A shortcut binding for a single platform, as returned by API routes. */
export interface PlatformBinding {
  platformSlug: string;
  /** Display string for the full chord, e.g. "Ctrl+K → Ctrl+C". */
  keyCombo: string;
  steps: KeyStepSummary[];
}

/**
 * SearchResult — one hit from GET /api/shortcuts/search.
 * Flattened for fast rendering: app name/slug inlined, bindings per platform.
 */
export interface SearchResult {
  id: string;
  command: string;
  context: string | null;
  appName: string;
  appSlug: string;
  platforms: PlatformBinding[];
}

/** AppSummary — one item from GET /api/apps. */
export interface AppSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categorySlug: string;
}

/** One shortcut entry within an AppDetail context group. */
export interface ShortcutEntry {
  id: string;
  command: string;
  platforms: PlatformBinding[];
}

/**
 * AppDetail — response from GET /api/apps/[slug].
 * Shortcuts are grouped by context/scope (e.g. "Global", "Editor").
 */
export interface AppDetail extends AppSummary {
  contexts: Record<string, ShortcutEntry[]>;
}

/** CategorySummary — one item from GET /api/categories. */
export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  appCount: number;
}

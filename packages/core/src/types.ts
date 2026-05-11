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

// ---------------------------------------------------------------------------
// Favorites / Collections types (Goal 7)
// ---------------------------------------------------------------------------

/**
 * A named collection of shortcuts belonging to a user.
 * isDefault=true marks the auto-created "My Favorites" collection.
 */
export interface ICollection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string; // ISO-8601
  updatedAt: string;
}

/** Collection summary returned by list endpoints — includes shortcut count. */
export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  shortcutCount: number;
}

// ---------------------------------------------------------------------------
// Community Submissions types (Goal 8)
// ---------------------------------------------------------------------------

export type SubmissionType = 'NEW_SHORTCUT' | 'CORRECTION' | 'APP_REQUEST';
export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Wire shape for a Submission as returned by GET /api/submissions
 * and GET /api/admin/submissions.
 */
export interface ISubmission {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  submitterId: string;
  appId: string | null;
  shortcutId: string | null;
  data: Record<string, unknown>;
  reviewerNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null; // ISO-8601
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

/**
 * Enriched submission shape returned by GET /api/admin/submissions.
 * Extends ISubmission with relational data for the admin review queue.
 */
export interface IAdminSubmission extends ISubmission {
  submitterName: string | null;
  submitterImage: string | null;
  appName: string | null;
  appSlug: string | null;
  originalShortcut: {
    command: string;
    keyCombo: string;
    context: string | null;
    platform: string;
  } | null;
}

export interface AdminSubmissionsResponse {
  submissions: IAdminSubmission[];
  totalPending: number;
}

/**
 * Body shape for POST /api/submissions.
 * `appId` is required for NEW_SHORTCUT and CORRECTION; null/absent for APP_REQUEST.
 * `shortcutId` is required for CORRECTION; absent otherwise.
 */
export interface SubmissionCreatePayload {
  type: SubmissionType;
  appId?: string | null;
  shortcutId?: string | null;
  data: Record<string, unknown>;
}

/**
 * Body shape for PATCH /api/admin/submissions/:id.
 */
export interface SubmissionAdminAction {
  action: 'approve' | 'reject' | 'edit-and-approve';
  reviewerNotes?: string;
  data?: Record<string, unknown>;
}

/** One entry in the GET /api/favorites response. */
export interface FavoriteEntry {
  collectionShortcutId: string;
  collectionId: string;
  shortcutId: string;
  addedAt: string; // ISO-8601 — maps to CollectionShortcut.createdAt
  shortcut: {
    id: string;
    command: string;
    context: string | null;
    appName: string;
    appSlug: string;
  };
}

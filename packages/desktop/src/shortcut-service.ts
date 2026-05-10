/**
 * ShortcutService — fetches shortcut data from PostgreSQL via an injected Prisma client.
 * ShortcutCache  — LRU in-memory cache (cap 5) for both positive and null results.
 *
 * Both classes are dependency-injected and carry no Electron imports so they are
 * unit-testable with Vitest in a plain Node environment. The IPC handler and prefetch
 * logic in main.ts wire these together with a real PrismaClient.
 *
 * TASK-0012 — Goal 5: Shortcut Panel UI (Desktop)
 */

import type {
  AppDetail,
  ShortcutEntry,
  PlatformBinding,
  KeyStepSummary,
} from '@kcc/core';

// ---------------------------------------------------------------------------
// Internal Prisma row shapes (returned by the application.findUnique query).
// Defined here so ShortcutService can be typed without importing @prisma/client.
// ---------------------------------------------------------------------------

interface PrismaKeyStep {
  stepOrder: number;
  keyCombo: string;
  key: string;
  modifiers: string[];
}

interface PrismaBinding {
  platform: { slug: string };
  steps: PrismaKeyStep[];
}

interface PrismaShortcut {
  id: string;
  command: string;
  context: string | null;
  bindings: PrismaBinding[];
}

interface PrismaAppRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: { slug: string };
  shortcuts: PrismaShortcut[];
}

// ---------------------------------------------------------------------------
// ShortcutDb — minimal interface for the injected database client.
// PrismaClient satisfies this interface; tests pass a simple mock.
// ---------------------------------------------------------------------------

export interface ShortcutDb {
  application: {
    /**
     * Accepts any Prisma findUnique args shape — the complex generic signature of
     * the real PrismaClient.application.findUnique cannot be matched structurally,
     * so callers cast as needed (see main.ts). The return type is what matters.
     */
    findUnique(args: { where: { slug: string }; include?: object }): Promise<PrismaAppRow | null>;
  };
}

// ---------------------------------------------------------------------------
// ShortcutCache — LRU cache, max CACHE_MAX entries, null-safe.
//
// Uses a Map for O(1) lookup. Insertion order tracks LRU — on a set() call we
// delete + re-insert the key to move it to "most recently used" position, then
// evict the oldest key (first in Map iteration order) when at capacity.
// ---------------------------------------------------------------------------

const CACHE_MAX = 5;

export class ShortcutCache {
  private readonly store = new Map<string, AppDetail | null>();

  has(slug: string): boolean {
    return this.store.has(slug);
  }

  get(slug: string): AppDetail | null | undefined {
    return this.store.get(slug);
  }

  set(slug: string, data: AppDetail | null): void {
    // Delete first to reset insertion order (treat as most recently used).
    this.store.delete(slug);
    // Evict oldest entry when at capacity.
    if (this.store.size >= CACHE_MAX) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }
    this.store.set(slug, data);
  }

  clear(): void {
    this.store.clear();
  }

  /** Number of cached entries (exposed for tests). */
  get size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// ShortcutService — queries the DB and shapes results into AppDetail.
// ---------------------------------------------------------------------------

export class ShortcutService {
  private readonly db: ShortcutDb;

  constructor(db: ShortcutDb) {
    this.db = db;
  }

  /**
   * Fetch all shortcuts for the given app slug, grouped by context/scope.
   *
   * Returns null when:
   * - slug is empty
   * - the slug does not exist in the database
   * - the database is unreachable (error is logged, not re-thrown)
   *
   * All platform bindings are included; the renderer (TASK-0013) filters by OS.
   */
  async getShortcutsForApp(slug: string): Promise<AppDetail | null> {
    if (!slug) return null;

    try {
      const app = await this.db.application.findUnique({
        where: { slug },
        include: {
          category: true,
          shortcuts: {
            include: {
              bindings: {
                include: {
                  platform: true,
                  steps: { orderBy: { stepOrder: 'asc' } },
                },
              },
            },
            orderBy: { command: 'asc' },
          },
        },
      });

      if (!app) return null;

      // Group shortcuts by context. Null context is normalized to 'Global'.
      const contexts: Record<string, ShortcutEntry[]> = {};
      for (const s of app.shortcuts) {
        const ctx = s.context ?? 'Global';
        if (!contexts[ctx]) contexts[ctx] = [];
        contexts[ctx].push({
          id: s.id,
          command: s.command,
          platforms: s.bindings.map((b): PlatformBinding => ({
            platformSlug: b.platform.slug,
            keyCombo: b.steps.map((step) => step.keyCombo).join(' → '),
            steps: b.steps.map((step): KeyStepSummary => ({
              stepOrder: step.stepOrder,
              keyCombo: step.keyCombo,
              key: step.key,
              modifiers: step.modifiers,
            })),
          })),
        });
      }

      return {
        id: app.id,
        name: app.name,
        slug: app.slug,
        description: app.description,
        categorySlug: app.category.slug,
        contexts,
      };
    } catch (err) {
      // DB unreachable or query failed — return null so the renderer shows the fallback state.
      console.error('[kcc] ShortcutService.getShortcutsForApp error:', err);
      return null;
    }
  }
}

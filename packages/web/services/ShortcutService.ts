import { prisma } from '../lib/prisma';
import type { SearchResult, PlatformBinding, KeyStepSummary, ShortcutEntry } from '@kcc/core';

export class ShortcutService {
  /**
   * Full-text search across shortcut commands and application names.
   * Primary path: PostgreSQL to_tsvector/plainto_tsquery via $queryRaw (uses GIN index).
   * Fallback: Prisma `contains` for local dev environments without the GIN index.
   *
   * @param query - Search string (must be non-empty; caller validates)
   * @param platform - Optional platform slug to filter results (e.g. "windows", "macos")
   */
  async search(query: string, platform?: string): Promise<SearchResult[]> {
    let shortcutIds: string[];

    try {
      // Parameterized query — Prisma $queryRaw uses tagged template literals,
      // so ${query} is passed as a bind parameter, preventing SQL injection.
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id
        FROM shortcuts s
        JOIN applications a ON s."applicationId" = a.id
        WHERE to_tsvector('english', s.command || ' ' || coalesce(a.name, ''))
              @@ plainto_tsquery('english', ${query})
        LIMIT 100
      `;
      shortcutIds = rows.map((r) => r.id);
    } catch (err) {
      // GIN index unavailable (e.g. test DB without the TASK-0002 migration).
      // Fall back to case-insensitive substring match so local dev still works.
      console.error('[ShortcutService] FTS query error — falling back to ILIKE:', err);
      shortcutIds = [];
    }

    let shortcuts;

    if (shortcutIds.length > 0) {
      shortcuts = await prisma.shortcut.findMany({
        where: { id: { in: shortcutIds } },
        include: {
          application: true,
          bindings: {
            include: {
              platform: true,
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
        },
      });
    } else {
      // Fallback: ILIKE search (also handles the zero-results case from FTS gracefully)
      shortcuts = await prisma.shortcut.findMany({
        where: {
          OR: [
            { command: { contains: query, mode: 'insensitive' } },
            { application: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        include: {
          application: true,
          bindings: {
            include: {
              platform: true,
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
        },
        take: 100,
      });
    }

    return shortcuts
      .filter((s) => {
        if (!platform) return true;
        return s.bindings.some((b) => b.platform.slug === platform);
      })
      .map((s) => ({
        id: s.id,
        command: s.command,
        context: s.context,
        appName: s.application.name,
        appSlug: s.application.slug,
        platforms: s.bindings
          .filter((b) => !platform || b.platform.slug === platform)
          .map((b): PlatformBinding => ({
            platformSlug: b.platform.slug,
            keyCombo: b.steps.map((step) => step.keyCombo).join(' → '),
            steps: b.steps.map((step): KeyStepSummary => ({
              stepOrder: step.stepOrder,
              keyCombo: step.keyCombo,
              key: step.key,
              modifiers: step.modifiers,
            })),
          })),
      }));
  }

  /**
   * Check for duplicate shortcuts before submission.
   *
   * - Exact match: same app + platform + keyCombo (case-insensitive).
   * - Fuzzy: same app, any platform, where the last key segment of the
   *   submitted combo appears in the stored keyCombo (excludes the exact match).
   *
   * @param appId - Application UUID
   * @param platformSlug - Platform slug (e.g. "windows", "macos", "linux") or "all"
   * @param keyCombo - Key combo string in normalized format, e.g. "Ctrl+Shift+P"
   */
  async checkDuplicate(
    appId: string,
    platformSlug: string,
    keyCombo: string,
  ): Promise<{ exact: ShortcutEntry | null; fuzzy: ShortcutEntry[] }> {
    const platform =
      platformSlug && platformSlug !== 'all'
        ? await prisma.platform.findUnique({ where: { slug: platformSlug } })
        : null;

    // Exact match: same app + (optionally) platform + keyCombo case-insensitive
    const exactStep = await prisma.shortcutKeyStep.findFirst({
      where: {
        keyCombo: { equals: keyCombo, mode: 'insensitive' },
        binding: {
          ...(platform ? { platformId: platform.id } : {}),
          shortcut: { applicationId: appId },
        },
      },
      include: {
        binding: {
          include: {
            shortcut: true,
            platform: true,
            steps: { orderBy: { stepOrder: 'asc' } },
          },
        },
      },
    });

    let exact: ShortcutEntry | null = null;
    if (exactStep) {
      const s = exactStep.binding.shortcut;
      exact = {
        id: s.id,
        command: s.command,
        platforms: [
          {
            platformSlug: exactStep.binding.platform.slug,
            keyCombo: exactStep.binding.steps.map((st) => st.keyCombo).join(' → '),
            steps: exactStep.binding.steps.map((st): KeyStepSummary => ({
              stepOrder: st.stepOrder,
              keyCombo: st.keyCombo,
              key: st.key,
              modifiers: st.modifiers as string[],
            })),
          },
        ],
      };
    }

    // Fuzzy: same app, any platform, key segment matches — exclude the exact match
    const baseKey = keyCombo.split('+').pop() ?? keyCombo;
    const fuzzySteps = await prisma.shortcutKeyStep.findMany({
      where: {
        keyCombo: { contains: baseKey, mode: 'insensitive' },
        binding: {
          shortcut: {
            applicationId: appId,
            ...(exact ? { id: { not: exact.id } } : {}),
          },
        },
      },
      include: {
        binding: {
          include: {
            shortcut: true,
            platform: true,
            steps: { orderBy: { stepOrder: 'asc' } },
          },
        },
      },
      take: 3,
    });

    // Deduplicate by shortcut id
    const fuzzyMap = new Map<string, ShortcutEntry>();
    for (const step of fuzzySteps) {
      const s = step.binding.shortcut;
      if (!fuzzyMap.has(s.id)) {
        fuzzyMap.set(s.id, {
          id: s.id,
          command: s.command,
          platforms: [
            {
              platformSlug: step.binding.platform.slug,
              keyCombo: step.binding.steps.map((st) => st.keyCombo).join(' → '),
              steps: step.binding.steps.map((st): KeyStepSummary => ({
                stepOrder: st.stepOrder,
                keyCombo: st.keyCombo,
                key: st.key,
                modifiers: st.modifiers as string[],
              })),
            },
          ],
        });
      }
    }

    return { exact, fuzzy: Array.from(fuzzyMap.values()) };
  }
}

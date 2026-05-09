import { prisma } from '../lib/prisma';
import type { AppSummary, AppDetail, ShortcutEntry, PlatformBinding, KeyStepSummary } from '@kcc/core';

export class AppService {
  /**
   * List all applications, optionally filtered by category slug.
   * Unknown category slugs return an empty array (not an error).
   */
  async listApps(category?: string): Promise<AppSummary[]> {
    const apps = await prisma.application.findMany({
      where: category ? { category: { slug: category } } : undefined,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    return apps.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      description: a.description,
      categorySlug: a.category.slug,
    }));
  }

  /**
   * Fetch a single application with all its shortcuts, grouped by context/scope.
   * Returns null when the slug does not exist (caller returns 404).
   *
   * Grouping is done in TypeScript after a single Prisma query to keep the
   * query simple and avoid a complex SQL GROUP BY across the nested relations.
   */
  async getApp(slug: string): Promise<AppDetail | null> {
    const app = await prisma.application.findUnique({
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

    // Group shortcuts by context. Null context is treated as "Global".
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
  }
}

import { prisma } from '../lib/prisma';
import type { CategorySummary } from '@kcc/core';

export class CategoryService {
  /** Return all categories with their application counts. */
  async listCategories(): Promise<CategorySummary[]> {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { applications: true } },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      appCount: c._count.applications,
    }));
  }
}

import { describe, it, expect } from 'vitest';
import { GET } from '../../app/api/categories/route';
import type { CategorySummary } from '@kcc/core';

const EXPECTED_SLUGS = [
  'creative',
  'developer-tools',
  'productivity',
  'gaming',
  'music',
  'system',
  'browsers',
];

describe('GET /api/categories', () => {
  it('returns all 7 categories', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const categories = (await res.json()) as CategorySummary[];
    expect(categories).toHaveLength(7);
  });

  it('includes all expected category slugs', async () => {
    const res = await GET();
    const categories = (await res.json()) as CategorySummary[];
    const slugs = categories.map((c) => c.slug);
    for (const slug of EXPECTED_SLUGS) {
      expect(slugs).toContain(slug);
    }
  });

  it('each category has a non-zero app count', async () => {
    const res = await GET();
    const categories = (await res.json()) as CategorySummary[];
    for (const cat of categories) {
      expect(cat.appCount).toBeGreaterThan(0);
    }
  });

  it('each category has required fields', async () => {
    const res = await GET();
    const categories = (await res.json()) as CategorySummary[];
    for (const cat of categories) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('slug');
      expect(typeof cat.appCount).toBe('number');
    }
  });

  it('categories are in alphabetical order', async () => {
    const res = await GET();
    const categories = (await res.json()) as CategorySummary[];
    for (let i = 1; i < categories.length; i++) {
      expect(
        categories[i].name.localeCompare(categories[i - 1].name)
      ).toBeGreaterThanOrEqual(0);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/apps/route';
import type { AppSummary } from '@kcc/core';

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/apps');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

describe('GET /api/apps', () => {
  it('returns all apps when no category filter is provided', async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const apps = (await res.json()) as AppSummary[];
    expect(Array.isArray(apps)).toBe(true);
    // Seed data must include 50+ apps
    expect(apps.length).toBeGreaterThanOrEqual(50);
  });

  it('returns apps matching a known category slug', async () => {
    const req = makeRequest({ category: 'developer-tools' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const apps = (await res.json()) as AppSummary[];
    expect(apps.length).toBeGreaterThan(0);
    for (const app of apps) {
      expect(app.categorySlug).toBe('developer-tools');
    }
  });

  it('returns apps in the creative category', async () => {
    const req = makeRequest({ category: 'creative' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const apps = (await res.json()) as AppSummary[];
    expect(apps.length).toBeGreaterThan(0);
    for (const app of apps) {
      expect(app.categorySlug).toBe('creative');
    }
  });

  it('returns empty array for an unknown category slug', async () => {
    const req = makeRequest({ category: 'nonexistent-category-xyz' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const apps = (await res.json()) as AppSummary[];
    expect(apps).toHaveLength(0);
  });

  it('each app has required fields', async () => {
    const req = makeRequest();
    const res = await GET(req);
    const apps = (await res.json()) as AppSummary[];
    for (const app of apps) {
      expect(app).toHaveProperty('id');
      expect(app).toHaveProperty('name');
      expect(app).toHaveProperty('slug');
      expect(app).toHaveProperty('categorySlug');
    }
  });

  it('apps are returned in alphabetical order by name', async () => {
    const req = makeRequest();
    const res = await GET(req);
    const apps = (await res.json()) as AppSummary[];
    for (let i = 1; i < apps.length; i++) {
      expect(apps[i].name.localeCompare(apps[i - 1].name)).toBeGreaterThanOrEqual(0);
    }
  });
});

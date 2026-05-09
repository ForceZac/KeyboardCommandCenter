import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/apps/[slug]/route';
import type { AppDetail } from '@kcc/core';

function makeRequest(slug: string): NextRequest {
  return new NextRequest(`http://localhost/api/apps/${slug}`);
}

function makeParams(slug: string) {
  return { params: { slug } };
}

describe('GET /api/apps/[slug]', () => {
  it('returns 404 for an unknown slug', async () => {
    const res = await GET(makeRequest('nonexistent-app-xyz'), makeParams('nonexistent-app-xyz'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns AppDetail for a known slug', async () => {
    // vs-code is expected to be in the seed data (developer-tools category)
    const res = await GET(makeRequest('vs-code'), makeParams('vs-code'));
    expect(res.status).toBe(200);
    const app = (await res.json()) as AppDetail;
    expect(app.slug).toBe('vs-code');
    expect(app).toHaveProperty('id');
    expect(app).toHaveProperty('name');
    expect(app).toHaveProperty('categorySlug');
    expect(app).toHaveProperty('contexts');
  });

  it('groups shortcuts by context', async () => {
    const res = await GET(makeRequest('vs-code'), makeParams('vs-code'));
    const app = (await res.json()) as AppDetail;
    // contexts is a Record<string, ShortcutEntry[]>
    expect(typeof app.contexts).toBe('object');
    const contextKeys = Object.keys(app.contexts);
    expect(contextKeys.length).toBeGreaterThan(0);

    for (const key of contextKeys) {
      const entries = app.contexts[key];
      expect(Array.isArray(entries)).toBe(true);
      for (const entry of entries) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('command');
        expect(Array.isArray(entry.platforms)).toBe(true);
      }
    }
  });

  it('each shortcut entry has platform bindings with steps', async () => {
    const res = await GET(makeRequest('vs-code'), makeParams('vs-code'));
    const app = (await res.json()) as AppDetail;
    let checked = 0;
    for (const entries of Object.values(app.contexts)) {
      for (const entry of entries) {
        for (const platform of entry.platforms) {
          expect(platform).toHaveProperty('platformSlug');
          expect(platform).toHaveProperty('keyCombo');
          expect(Array.isArray(platform.steps)).toBe(true);
          checked++;
          if (checked >= 5) return; // spot-check first 5 bindings
        }
      }
    }
  });

  it('shortcuts have at least 10 entries for a seeded app', async () => {
    const res = await GET(makeRequest('vs-code'), makeParams('vs-code'));
    const app = (await res.json()) as AppDetail;
    const total = Object.values(app.contexts).reduce(
      (sum, entries) => sum + entries.length,
      0
    );
    expect(total).toBeGreaterThanOrEqual(10);
  });
});

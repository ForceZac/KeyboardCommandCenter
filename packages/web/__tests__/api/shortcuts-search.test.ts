import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/shortcuts/search/route';
import type { SearchResult } from '@kcc/core';

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/shortcuts/search');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

describe('GET /api/shortcuts/search', () => {
  it('returns 400 when q param is missing', async () => {
    const req = makeRequest({});
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when q param is empty string', async () => {
    const req = makeRequest({ q: '' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when q param is whitespace-only', async () => {
    const req = makeRequest({ q: '   ' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns array of SearchResults for a known term', async () => {
    // "undo" is a common shortcut seeded across many apps
    const req = makeRequest({ q: 'undo' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const results = (await res.json()) as SearchResult[];
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    const first = results[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('command');
    expect(first).toHaveProperty('appName');
    expect(first).toHaveProperty('appSlug');
    expect(Array.isArray(first.platforms)).toBe(true);
  });

  it('returns results matching "save" across multiple apps', async () => {
    const req = makeRequest({ q: 'save' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const results = (await res.json()) as SearchResult[];
    expect(results.length).toBeGreaterThan(0);
    // Every result should mention "save" in command (case-insensitive)
    for (const r of results) {
      expect(r.command.toLowerCase()).toContain('save');
    }
  });

  it('filters results by platform when platform param is provided', async () => {
    const req = makeRequest({ q: 'undo', platform: 'windows' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const results = (await res.json()) as SearchResult[];
    for (const r of results) {
      // Every result must have at least one windows platform binding
      const hasPlatform = r.platforms.some((p) => p.platformSlug === 'windows');
      expect(hasPlatform).toBe(true);
    }
  });

  it('returns empty array for a query with no matches', async () => {
    const req = makeRequest({ q: 'xyzzy_nonexistent_command_12345' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const results = (await res.json()) as SearchResult[];
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });
});

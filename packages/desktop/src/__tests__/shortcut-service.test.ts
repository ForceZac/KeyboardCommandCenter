import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShortcutService, ShortcutCache } from '../shortcut-service';
import type { ShortcutDb } from '../shortcut-service';
import type { AppDetail } from '@kcc/core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFixtureApp() {
  return {
    id: 'app-1',
    name: 'VS Code',
    slug: 'vscode',
    description: 'Code editor',
    category: { slug: 'developer-tools' },
    shortcuts: [
      {
        id: 'sc-1',
        command: 'Save File',
        context: 'Global',
        bindings: [
          {
            platform: { slug: 'windows' },
            steps: [{ stepOrder: 1, keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] }],
          },
          {
            platform: { slug: 'macos' },
            steps: [{ stepOrder: 1, keyCombo: 'Cmd+S', key: 's', modifiers: ['Cmd'] }],
          },
        ],
      },
      {
        id: 'sc-2',
        command: 'Toggle Terminal',
        context: 'Editor',
        bindings: [
          {
            platform: { slug: 'windows' },
            steps: [{ stepOrder: 1, keyCombo: 'Ctrl+`', key: '`', modifiers: ['Ctrl'] }],
          },
        ],
      },
      {
        id: 'sc-3',
        command: 'Go to Definition',
        context: null, // should normalize to 'Global'
        bindings: [
          {
            platform: { slug: 'windows' },
            steps: [{ stepOrder: 1, keyCombo: 'F12', key: 'F12', modifiers: [] }],
          },
        ],
      },
    ],
  };
}

function makeMockDb(returnValue: unknown): ShortcutDb {
  return {
    application: {
      findUnique: vi.fn().mockResolvedValue(returnValue),
    },
  };
}

function makeAppDetail(slug = 'vscode'): AppDetail {
  return {
    id: '1',
    name: 'VS Code',
    slug,
    description: null,
    categorySlug: 'developer-tools',
    contexts: {},
  };
}

// ---------------------------------------------------------------------------
// ShortcutService
// ---------------------------------------------------------------------------

describe('ShortcutService', () => {
  it('returns grouped AppDetail for a known slug', async () => {
    const db = makeMockDb(makeFixtureApp());
    const service = new ShortcutService(db);

    const result = await service.getShortcutsForApp('vscode');

    expect(result).not.toBeNull();
    expect(result!.slug).toBe('vscode');
    expect(result!.name).toBe('VS Code');
    expect(result!.categorySlug).toBe('developer-tools');
  });

  it('groups shortcuts by context correctly', async () => {
    const db = makeMockDb(makeFixtureApp());
    const service = new ShortcutService(db);

    const result = await service.getShortcutsForApp('vscode');

    // sc-1 (Global) + sc-3 (null→Global) = 2 in Global; sc-2 = 1 in Editor
    expect(Object.keys(result!.contexts).sort()).toEqual(['Editor', 'Global']);
    expect(result!.contexts['Global']).toHaveLength(2);
    expect(result!.contexts['Editor']).toHaveLength(1);
    expect(result!.contexts['Editor'][0].command).toBe('Toggle Terminal');
  });

  it('normalizes null context to "Global"', async () => {
    const db = makeMockDb(makeFixtureApp());
    const service = new ShortcutService(db);

    const result = await service.getShortcutsForApp('vscode');

    const globalCommands = result!.contexts['Global'].map((s) => s.command);
    expect(globalCommands).toContain('Go to Definition');
  });

  it('includes all platform bindings in the response', async () => {
    const db = makeMockDb(makeFixtureApp());
    const service = new ShortcutService(db);

    const result = await service.getShortcutsForApp('vscode');
    const saveShortcut = result!.contexts['Global'].find((s) => s.command === 'Save File')!;

    expect(saveShortcut.platforms).toHaveLength(2);
    const win = saveShortcut.platforms.find((p) => p.platformSlug === 'windows')!;
    expect(win.keyCombo).toBe('Ctrl+S');
    expect(win.steps[0].modifiers).toEqual(['Ctrl']);
    const mac = saveShortcut.platforms.find((p) => p.platformSlug === 'macos')!;
    expect(mac.keyCombo).toBe('Cmd+S');
  });

  it('builds chord keyCombo from multiple steps joined by " → "', async () => {
    const fixture = makeFixtureApp();
    // Make sc-1 a two-step chord
    fixture.shortcuts[0].bindings[0].steps = [
      { stepOrder: 1, keyCombo: 'Ctrl+K', key: 'k', modifiers: ['Ctrl'] },
      { stepOrder: 2, keyCombo: 'Ctrl+C', key: 'c', modifiers: ['Ctrl'] },
    ];
    const db = makeMockDb(fixture);
    const service = new ShortcutService(db);

    const result = await service.getShortcutsForApp('vscode');
    const win = result!.contexts['Global']
      .find((s) => s.command === 'Save File')!
      .platforms.find((p) => p.platformSlug === 'windows')!;

    expect(win.keyCombo).toBe('Ctrl+K → Ctrl+C');
    expect(win.steps).toHaveLength(2);
  });

  it('returns null for an unknown slug (DB returns null)', async () => {
    const db = makeMockDb(null);
    const service = new ShortcutService(db);

    const result = await service.getShortcutsForApp('nonexistent');

    expect(result).toBeNull();
  });

  it('returns null and does not throw when the DB rejects', async () => {
    const db: ShortcutDb = {
      application: {
        findUnique: vi.fn().mockRejectedValue(new Error('Connection refused')),
      },
    };
    const service = new ShortcutService(db);

    const result = await service.getShortcutsForApp('vscode');

    expect(result).toBeNull();
  });

  it('returns null immediately for an empty slug without calling the DB', async () => {
    const db = makeMockDb(makeFixtureApp());
    const service = new ShortcutService(db);

    const result = await service.getShortcutsForApp('');

    expect(result).toBeNull();
    expect(db.application.findUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ShortcutCache
// ---------------------------------------------------------------------------

describe('ShortcutCache', () => {
  let cache: ShortcutCache;

  beforeEach(() => {
    cache = new ShortcutCache();
  });

  it('returns false for has() and undefined for get() on a miss', () => {
    expect(cache.has('vscode')).toBe(false);
    expect(cache.get('vscode')).toBeUndefined();
  });

  it('stores and retrieves an AppDetail entry', () => {
    const detail = makeAppDetail();
    cache.set('vscode', detail);

    expect(cache.has('vscode')).toBe(true);
    expect(cache.get('vscode')).toBe(detail);
  });

  it('caches null entries (unknown slug — so repeated misses skip the DB)', () => {
    cache.set('unknown', null);

    expect(cache.has('unknown')).toBe(true);
    expect(cache.get('unknown')).toBeNull();
  });

  it('evicts the oldest entry when capacity (5) is exceeded', () => {
    cache.set('a', null);
    cache.set('b', null);
    cache.set('c', null);
    cache.set('d', null);
    cache.set('e', null);
    expect(cache.size).toBe(5);

    cache.set('f', null); // should evict 'a'

    expect(cache.size).toBe(5);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('f')).toBe(true);
  });

  it('re-setting an existing key moves it to most-recently-used position', () => {
    cache.set('a', null);
    cache.set('b', null);
    cache.set('c', null);
    cache.set('d', null);
    cache.set('e', null);

    // Refresh 'a' — it should now be most recently used.
    cache.set('a', null);

    // Adding 'f' should evict 'b' (now the oldest), not 'a'.
    cache.set('f', null);

    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('f')).toBe(true);
    expect(cache.size).toBe(5);
  });

  it('size stays at 1 when the same key is set twice', () => {
    const detail = makeAppDetail();
    cache.set('vscode', detail);
    cache.set('vscode', detail);

    expect(cache.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cache + Service integration: null entries prevent repeated DB calls
// ---------------------------------------------------------------------------

describe('ShortcutCache + ShortcutService integration', () => {
  it('caching null prevents a second DB call for unknown slugs', async () => {
    const db = makeMockDb(null);
    const service = new ShortcutService(db);
    const cache = new ShortcutCache();

    // Simulate the IPC handler pattern: check cache → fetch → cache result.
    const getWithCache = async (slug: string): Promise<AppDetail | null> => {
      if (cache.has(slug)) return cache.get(slug) ?? null;
      const data = await service.getShortcutsForApp(slug);
      cache.set(slug, data);
      return data;
    };

    await getWithCache('unknown');
    await getWithCache('unknown'); // should hit cache

    expect(db.application.findUnique).toHaveBeenCalledTimes(1);
  });

  it('cache hit returns the stored AppDetail without calling the DB again', async () => {
    const db = makeMockDb(makeFixtureApp());
    const service = new ShortcutService(db);
    const cache = new ShortcutCache();

    const getWithCache = async (slug: string): Promise<AppDetail | null> => {
      if (cache.has(slug)) return cache.get(slug) ?? null;
      const data = await service.getShortcutsForApp(slug);
      cache.set(slug, data);
      return data;
    };

    const first = await getWithCache('vscode');
    const second = await getWithCache('vscode'); // cache hit

    expect(db.application.findUnique).toHaveBeenCalledTimes(1);
    expect(second).toBe(first); // same object reference
  });
});

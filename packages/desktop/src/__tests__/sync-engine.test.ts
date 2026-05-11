import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted — mockNet must be defined before vi.mock factories run.
// ---------------------------------------------------------------------------
const { mockNet } = vi.hoisted(() => ({
  mockNet: { isOnline: vi.fn(() => true) },
}));

vi.mock('electron', () => ({ net: mockNet }));

import { SyncEngine } from '../sync-engine';
import type { SyncStore, PendingChange } from '../sync-store';
import type { FavoriteEntry, CollectionSummary } from '@kcc/core';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/**
 * Creates a reactive mock SyncStore. Calls to setX update internal state,
 * and subsequent getX calls reflect those changes — unless a test overrides
 * a method with mockReturnValueOnce/mockReturnValue.
 */
function makeMockSyncStore() {
  const data = {
    favorites: [] as FavoriteEntry[],
    favoritedIds: {} as Record<string, string>,
    collections: [] as CollectionSummary[],
    pendingChanges: [] as PendingChange[],
    lastSyncAt: null as string | null,
  };

  const store: SyncStore = {
    getFavorites: vi.fn(() => data.favorites),
    setFavorites: vi.fn((v: FavoriteEntry[]) => { data.favorites = v; }),
    getFavoritedIds: vi.fn(() => data.favoritedIds),
    setFavoritedIds: vi.fn((v: Record<string, string>) => { data.favoritedIds = v; }),
    getCollections: vi.fn(() => data.collections),
    setCollections: vi.fn((v: CollectionSummary[]) => { data.collections = v; }),
    getPendingChanges: vi.fn(() => data.pendingChanges),
    setPendingChanges: vi.fn((v: PendingChange[]) => { data.pendingChanges = v; }),
    getLastSyncAt: vi.fn(() => data.lastSyncAt),
    setLastSyncAt: vi.fn((v: string | null) => { data.lastSyncAt = v; }),
    clear: vi.fn(() => {
      data.favorites = [];
      data.favoritedIds = {};
      data.collections = [];
      data.pendingChanges = [];
      data.lastSyncAt = null;
    }),
  } as unknown as SyncStore;

  return { store, data };
}

function makeMockAuthStore(token: string | null = 'test-token') {
  return { getToken: vi.fn(() => token) };
}

function makeFavoriteEntry(shortcutId: string, addedAt = '2026-01-01T00:00:00.000Z'): FavoriteEntry {
  return {
    collectionShortcutId: `cs-${shortcutId}`,
    collectionId: 'col-default',
    shortcutId,
    addedAt,
    shortcut: {
      id: shortcutId,
      command: `Command ${shortcutId}`,
      context: null,
      appName: 'VS Code',
      appSlug: 'vscode',
    },
  };
}

function makeCollectionSummary(id: string): CollectionSummary {
  return { id, name: `Collection ${id}`, description: null, isDefault: false, shortcutCount: 0 };
}

function makeFetchResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

/** Advance fake timers by 0ms — flushes pending microtasks from async functions. */
async function flushAsync(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncEngine', () => {
  let syncStoreResult: ReturnType<typeof makeMockSyncStore>;
  let syncStore: SyncStore;
  let authStore: ReturnType<typeof makeMockAuthStore>;
  let engine: SyncEngine;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockNet.isOnline.mockReturnValue(true);
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    syncStoreResult = makeMockSyncStore();
    syncStore = syncStoreResult.store;
    authStore = makeMockAuthStore('token-abc');
    engine = new SyncEngine(syncStore, authStore as unknown as import('../auth-store').AuthStore);
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  describe('start() / stop() lifecycle', () => {
    it('triggers an initial sync cycle on start()', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, []));
      engine.start();
      await flushAsync();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/favorites'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
        }),
      );
    });

    it('schedules syncs on the 15-minute interval after start()', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, []));
      engine.start();
      await flushAsync();
      const callsAfterStart = mockFetch.mock.calls.length;

      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterStart);
    });

    it('calling start() twice does not register a second interval', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, []));
      engine.start();
      engine.start(); // no-op
      await flushAsync();

      const before = mockFetch.mock.calls.length;
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
      const after = mockFetch.mock.calls.length;

      // One interval fires one syncCycle = 2 fetch calls (favorites + collections).
      // Two intervals would produce 4. Allow ≤2 new calls.
      expect(after - before).toBeLessThanOrEqual(2);
    });

    it('stop() prevents the interval from firing again', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, []));
      engine.start();
      await flushAsync();
      engine.stop();
      const callsAfterStop = mockFetch.mock.calls.length;

      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

      expect(mockFetch.mock.calls.length).toBe(callsAfterStop);
    });

    it('stop() clears the local cache', () => {
      engine.start();
      engine.stop();
      expect(syncStore.clear).toHaveBeenCalled();
    });
  });

  // ── Signed-out guard ─────────────────────────────────────────────────────

  describe('signed-out guard', () => {
    beforeEach(() => {
      engine = new SyncEngine(
        syncStore,
        makeMockAuthStore(null) as unknown as import('../auth-store').AuthStore,
      );
    });

    it('getFavorites() returns [] when signed out', () => {
      expect(engine.getFavorites()).toEqual([]);
    });

    it('getCollections() returns [] when signed out', () => {
      expect(engine.getCollections()).toEqual([]);
    });

    it('toggleFavorite() is a no-op when signed out', () => {
      engine.toggleFavorite('sc-1');
      expect(syncStore.setPendingChanges).not.toHaveBeenCalled();
    });

    it('start() does not call the API when signed out', async () => {
      engine.start();
      await flushAsync();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── toggleFavorite ────────────────────────────────────────────────────────

  describe('toggleFavorite', () => {
    it('adds shortcutId to favoritedIds with a timestamp (first toggle = add)', () => {
      engine.toggleFavorite('sc-1');
      expect(syncStore.setFavoritedIds).toHaveBeenCalledWith(
        expect.objectContaining({ 'sc-1': expect.any(String) }),
      );
    });

    it('queues an "add" pending change on first toggle', () => {
      engine.toggleFavorite('sc-1');
      expect(syncStore.setPendingChanges).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ shortcutId: 'sc-1', action: 'add' }),
        ]),
      );
    });

    it('removes shortcutId from favoritedIds when shortcut is already favorited', () => {
      // Pre-seed via the reactive data layer.
      syncStoreResult.data.favoritedIds = { 'sc-1': '2026-01-01T00:00:00.000Z' };
      syncStoreResult.data.favorites = [makeFavoriteEntry('sc-1')];

      engine.toggleFavorite('sc-1');

      const updatedIds = vi.mocked(syncStore.setFavoritedIds).mock.lastCall![0];
      expect(updatedIds).not.toHaveProperty('sc-1');
    });

    it('queues a "remove" pending change when shortcut is already favorited', () => {
      syncStoreResult.data.favoritedIds = { 'sc-1': '2026-01-01T00:00:00.000Z' };
      syncStoreResult.data.favorites = [makeFavoriteEntry('sc-1')];

      engine.toggleFavorite('sc-1');

      expect(syncStore.setPendingChanges).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ shortcutId: 'sc-1', action: 'remove' }),
        ]),
      );
    });

    it('rapid add-then-remove collapses to a single "remove" pending change', () => {
      // First toggle → add.
      engine.toggleFavorite('sc-1');

      // Now simulate that sc-1 is in favoritedIds (the setPendingChanges was called above).
      syncStoreResult.data.favoritedIds = { 'sc-1': '2026-01-01T00:00:00.000Z' };
      syncStoreResult.data.favorites = [makeFavoriteEntry('sc-1')];
      syncStoreResult.data.pendingChanges = [
        { shortcutId: 'sc-1', action: 'add', timestamp: '2026-01-01T00:00:00.000Z' },
      ];

      // Second toggle → remove (collapses the add).
      engine.toggleFavorite('sc-1');

      const lastPending = vi.mocked(syncStore.setPendingChanges).mock.lastCall![0];
      const sc1Changes = lastPending.filter((c: PendingChange) => c.shortcutId === 'sc-1');
      expect(sc1Changes).toHaveLength(1);
      expect(sc1Changes[0].action).toBe('remove');
    });
  });

  // ── pull merge logic ──────────────────────────────────────────────────────

  describe('pull — last-write-wins merge', () => {
    // No pending changes in these tests — push is a no-op, fetch goes straight to pull.

    it('populates local cache with server favorites when no pending changes', async () => {
      const serverFavorites = [makeFavoriteEntry('sc-1', '2026-01-01T10:00:00.000Z')];
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(200, serverFavorites))
        .mockResolvedValueOnce(makeFetchResponse(200, []));

      await engine.forceSync();

      const saved = vi.mocked(syncStore.setFavorites).mock.lastCall![0];
      expect(saved.some((f: FavoriteEntry) => f.shortcutId === 'sc-1')).toBe(true);
    });

    it('keeps local "add" when local timestamp is newer than server', async () => {
      const localTs = '2026-01-01T12:00:00.000Z'; // newer
      const serverTs = '2026-01-01T10:00:00.000Z';

      // Push sees no pending changes (one call → returns [] from data).
      // Pull sees the pending change (second call → returns [add]).
      vi.mocked(syncStore.getPendingChanges)
        .mockReturnValueOnce([])                     // push: no-op
        .mockReturnValueOnce([                        // pull: merge
          { shortcutId: 'sc-1', action: 'add', timestamp: localTs },
        ]);

      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(200, [makeFavoriteEntry('sc-1', serverTs)]))
        .mockResolvedValueOnce(makeFetchResponse(200, []));

      await engine.forceSync();

      // Local add wins — sc-1 stays in favorites.
      const saved = vi.mocked(syncStore.setFavorites).mock.lastCall![0];
      expect(saved.some((f: FavoriteEntry) => f.shortcutId === 'sc-1')).toBe(true);

      // Pending change is preserved for next push.
      const savedPending = vi.mocked(syncStore.setPendingChanges).mock.lastCall![0];
      expect(savedPending.some((c: PendingChange) => c.shortcutId === 'sc-1')).toBe(true);
    });

    it('drops pending "remove" when server timestamp is newer', async () => {
      const localTs = '2026-01-01T08:00:00.000Z'; // older
      const serverTs = '2026-01-01T10:00:00.000Z'; // newer

      vi.mocked(syncStore.getPendingChanges)
        .mockReturnValueOnce([])                     // push: no-op
        .mockReturnValueOnce([                        // pull: merge
          { shortcutId: 'sc-1', action: 'remove', timestamp: localTs },
        ]);

      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(200, [makeFavoriteEntry('sc-1', serverTs)]))
        .mockResolvedValueOnce(makeFetchResponse(200, []));

      await engine.forceSync();

      // Server wins — sc-1 is in favorites and the pending remove is dropped.
      const saved = vi.mocked(syncStore.setFavorites).mock.lastCall![0];
      expect(saved.some((f: FavoriteEntry) => f.shortcutId === 'sc-1')).toBe(true);

      const savedPending = vi.mocked(syncStore.setPendingChanges).mock.lastCall![0];
      expect(savedPending.some((c: PendingChange) => c.shortcutId === 'sc-1')).toBe(false);
    });

    it('removes a shortcut that the server no longer returns', async () => {
      syncStoreResult.data.favoritedIds = { 'sc-1': '2026-01-01T00:00:00.000Z' };
      syncStoreResult.data.favorites = [makeFavoriteEntry('sc-1')];

      // Server returns empty favorites.
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(200, []))
        .mockResolvedValueOnce(makeFetchResponse(200, []));

      await engine.forceSync();

      const saved = vi.mocked(syncStore.setFavorites).mock.lastCall![0];
      expect(saved.some((f: FavoriteEntry) => f.shortcutId === 'sc-1')).toBe(false);
    });

    it('updates lastSyncAt after a successful pull', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, []));
      await engine.forceSync();
      expect(syncStore.setLastSyncAt).toHaveBeenCalledWith(expect.any(String));
    });

    it('does not update cache when server returns 401', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(401));
      await engine.forceSync();
      expect(syncStore.setFavorites).not.toHaveBeenCalled();
    });
  });

  // ── push — drains pending changes ─────────────────────────────────────────

  describe('push', () => {
    it('POSTs to /api/favorites for a pending "add" change', async () => {
      syncStoreResult.data.pendingChanges = [
        { shortcutId: 'sc-1', action: 'add', timestamp: '2026-01-01T00:00:00.000Z' },
      ];
      // Responses: POST (push add), GET favorites (pull), GET collections (pull).
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(201, { ok: true }))
        .mockResolvedValueOnce(makeFetchResponse(200, []))
        .mockResolvedValueOnce(makeFetchResponse(200, []));

      await engine.forceSync();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/favorites'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ shortcutId: 'sc-1' }) }),
      );
    });

    it('DELETEs /api/favorites/:id for a pending "remove" change', async () => {
      syncStoreResult.data.pendingChanges = [
        { shortcutId: 'sc-1', action: 'remove', timestamp: '2026-01-01T00:00:00.000Z' },
      ];
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(204))
        .mockResolvedValueOnce(makeFetchResponse(200, []))
        .mockResolvedValueOnce(makeFetchResponse(200, []));

      await engine.forceSync();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/favorites/sc-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('clears pending changes after a successful push', async () => {
      // Use mockReturnValueOnce so push sees the pending change on its first
      // getPendingChanges call, and pull's second call falls back to the reactive
      // data (which setPendingChanges([]) will have updated to empty).
      vi.mocked(syncStore.getPendingChanges).mockReturnValueOnce([
        { shortcutId: 'sc-1', action: 'add', timestamp: '2026-01-01T00:00:00.000Z' },
      ]);
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(201, { ok: true })) // POST push
        .mockResolvedValueOnce(makeFetchResponse(200, []))           // GET favorites pull
        .mockResolvedValueOnce(makeFetchResponse(200, []));          // GET collections pull

      await engine.forceSync();

      // The last setPendingChanges call (from pull's merge) should carry 0 remaining.
      const lastPending = vi.mocked(syncStore.setPendingChanges).mock.lastCall![0];
      expect(lastPending).toHaveLength(0);
    });

    it('re-queues a pending change on a transient network error', async () => {
      syncStoreResult.data.pendingChanges = [
        { shortcutId: 'sc-1', action: 'add', timestamp: '2026-01-01T00:00:00.000Z' },
      ];
      // Network error on push; pull also fails.
      mockFetch.mockRejectedValue(new Error('Network error'));

      await engine.forceSync();

      const lastPending = vi.mocked(syncStore.setPendingChanges).mock.lastCall![0];
      expect(lastPending.some((c: PendingChange) => c.shortcutId === 'sc-1')).toBe(true);
    });

    it('drops a pending "add" and reverts local state on 403 (favorites limit)', async () => {
      syncStoreResult.data.pendingChanges = [
        { shortcutId: 'sc-1', action: 'add', timestamp: '2026-01-01T00:00:00.000Z' },
      ];
      syncStoreResult.data.favoritedIds = { 'sc-1': '2026-01-01T00:00:00.000Z' };
      syncStoreResult.data.favorites = [makeFavoriteEntry('sc-1')];

      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(403))              // POST: limit
        .mockResolvedValueOnce(makeFetchResponse(200, []))          // GET favorites pull
        .mockResolvedValueOnce(makeFetchResponse(200, []));         // GET collections pull

      await engine.forceSync();

      // sc-1 should be removed from local favoritedIds (optimistic revert).
      const updatedIds = vi.mocked(syncStore.setFavoritedIds).mock.lastCall![0];
      expect(updatedIds).not.toHaveProperty('sc-1');
    });

    it('stops pushing and re-queues remaining changes on 401', async () => {
      syncStoreResult.data.pendingChanges = [
        { shortcutId: 'sc-1', action: 'add', timestamp: '2026-01-01T00:00:00.000Z' },
        { shortcutId: 'sc-2', action: 'add', timestamp: '2026-01-01T00:00:00.000Z' },
      ];
      // First push call → 401; engine backs off.
      mockFetch.mockResolvedValueOnce(makeFetchResponse(401));

      await engine.forceSync();

      // Both sc-1 (the one that got 401) and sc-2 (not yet attempted) must be re-queued.
      const lastPending = vi.mocked(syncStore.setPendingChanges).mock.lastCall![0];
      expect(lastPending.some((c: PendingChange) => c.shortcutId === 'sc-1')).toBe(true);
      expect(lastPending.some((c: PendingChange) => c.shortcutId === 'sc-2')).toBe(true);
    });
  });

  // ── Network reconnect ─────────────────────────────────────────────────────

  describe('triggerSync', () => {
    it('runs a sync cycle when called online', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, []));
      await engine.triggerSync();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('does not call the API when offline', async () => {
      mockNet.isOnline.mockReturnValue(false);
      await engine.triggerSync();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── forceSync ─────────────────────────────────────────────────────────────

  describe('forceSync', () => {
    it('calls push before pull', async () => {
      const callOrder: string[] = [];
      syncStoreResult.data.pendingChanges = [
        { shortcutId: 'sc-1', action: 'add', timestamp: '2026-01-01T00:00:00.000Z' },
      ];
      mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
        callOrder.push(opts?.method === 'POST' ? 'push' : 'pull');
        return Promise.resolve(makeFetchResponse(200, []));
      });

      await engine.forceSync();

      expect(callOrder[0]).toBe('push');
      expect(callOrder).toContain('pull');
    });
  });

  // ── addToCollection / removeFromCollection ────────────────────────────────

  describe('addToCollection', () => {
    it('returns { ok: false, error: "Offline" } when offline', async () => {
      mockNet.isOnline.mockReturnValue(false);
      expect(await engine.addToCollection('sc-1', 'col-1')).toEqual({
        ok: false,
        error: 'Offline',
      });
    });

    it('returns { ok: false, error: "Not authenticated" } when signed out', async () => {
      const unauthEngine = new SyncEngine(
        syncStore,
        makeMockAuthStore(null) as unknown as import('../auth-store').AuthStore,
      );
      expect(await unauthEngine.addToCollection('sc-1', 'col-1')).toEqual({
        ok: false,
        error: 'Not authenticated',
      });
    });

    it('returns { ok: true } and refreshes collections on success', async () => {
      const col = makeCollectionSummary('col-1');
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(201))              // POST /api/collections/:id/shortcuts
        .mockResolvedValueOnce(makeFetchResponse(200, [col]));      // GET /api/collections

      const result = await engine.addToCollection('sc-1', 'col-1');

      expect(result).toEqual({ ok: true });
      expect(syncStore.setCollections).toHaveBeenCalledWith([col]);
    });

    it('returns { ok: false, error } on server error', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse(500));
      const result = await engine.addToCollection('sc-1', 'col-1');
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/500/);
    });
  });

  describe('removeFromCollection', () => {
    it('returns { ok: false, error: "Offline" } when offline', async () => {
      mockNet.isOnline.mockReturnValue(false);
      expect(await engine.removeFromCollection('sc-1', 'col-1')).toEqual({
        ok: false,
        error: 'Offline',
      });
    });

    it('returns { ok: true } when server returns 404 (shortcut already removed)', async () => {
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(404))             // DELETE: already gone
        .mockResolvedValueOnce(makeFetchResponse(200, []));        // GET /api/collections

      const result = await engine.removeFromCollection('sc-1', 'col-1');
      expect(result).toEqual({ ok: true });
    });

    it('returns { ok: true } and refreshes collections on success', async () => {
      const col = makeCollectionSummary('col-1');
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(204))             // DELETE
        .mockResolvedValueOnce(makeFetchResponse(200, [col]));     // GET /api/collections

      const result = await engine.removeFromCollection('sc-1', 'col-1');
      expect(result).toEqual({ ok: true });
      expect(syncStore.setCollections).toHaveBeenCalledWith([col]);
    });
  });
});

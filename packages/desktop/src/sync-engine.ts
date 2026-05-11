// TASK-0025: Sync engine — manages local favorites/collections cache and syncs with server.
// Runs entirely in the Electron main process. All sync operations are async and
// fire-and-forget from the renderer's perspective — no UI blocking.
import { net } from 'electron';
import type { AuthStore } from './auth-store';
import type { SyncStore, PendingChange } from './sync-store';
import type { FavoriteEntry, CollectionSummary } from '@kcc/core';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Web app base URL for API calls. Reads NEXTAUTH_URL from the environment;
// falls back to local dev server — same pattern as main.ts auth URL.
const WEB_APP_BASE_URL = process.env['NEXTAUTH_URL'] ?? 'http://localhost:3000';

export class SyncEngine {
  private syncStore: SyncStore;
  private authStore: AuthStore;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(syncStore: SyncStore, authStore: AuthStore) {
    this.syncStore = syncStore;
    this.authStore = authStore;
  }

  /**
   * Starts the sync engine: triggers an initial sync cycle and schedules
   * subsequent cycles every 15 minutes. Only call when the user is signed in.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    void this.syncCycle();
    this.syncInterval = setInterval(() => {
      void this.syncCycle();
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Stops the sync engine and clears all local cached data.
   * Called on sign-out so stale favorites are never shown to the next user.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.syncStore.clear();
  }

  // ---------------------------------------------------------------------------
  // Synchronous cache reads — must complete in <10ms.
  // electron-store keeps the parsed object in memory after init; these are
  // in-memory lookups, not disk reads.
  // ---------------------------------------------------------------------------

  /** Returns the cached favorites list. Empty array when signed out. */
  getFavorites(): FavoriteEntry[] {
    if (!this.isAuthenticated()) return [];
    return this.syncStore.getFavorites();
  }

  /** Returns the cached collections list. Empty array when signed out. */
  getCollections(): CollectionSummary[] {
    if (!this.isAuthenticated()) return [];
    return this.syncStore.getCollections();
  }

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  /**
   * Toggles a shortcut in the default "My Favorites" collection.
   * Applies an optimistic local change immediately, queues a pending change,
   * and fires a push in the background. No-op when signed out.
   */
  toggleFavorite(shortcutId: string): void {
    if (!this.isAuthenticated()) return;

    const favoritedIds = this.syncStore.getFavoritedIds();
    const isFavorited = shortcutId in favoritedIds;
    const timestamp = new Date().toISOString();

    if (isFavorited) {
      // Optimistic remove: update local cache immediately.
      const updated = { ...favoritedIds };
      delete updated[shortcutId];
      this.syncStore.setFavoritedIds(updated);
      this.syncStore.setFavorites(
        this.syncStore.getFavorites().filter((f) => f.shortcutId !== shortcutId),
      );
      this.queuePendingChange({ shortcutId, action: 'remove', timestamp });
    } else {
      // Optimistic add: record the id + timestamp. Full FavoriteEntry metadata
      // (command name, appName, etc.) arrives on the next pull cycle.
      const updated = { ...favoritedIds, [shortcutId]: timestamp };
      this.syncStore.setFavoritedIds(updated);
      this.queuePendingChange({ shortcutId, action: 'add', timestamp });
    }

    // Fire-and-forget — does not block the caller.
    void this.push();
  }

  /**
   * Adds a shortcut to a specific (non-default) collection.
   * Makes a direct API call and refreshes the collections cache on success.
   * Returns an error object if offline or the request fails.
   */
  async addToCollection(
    shortcutId: string,
    collectionId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const token = this.authStore.getToken();
    if (!token) return { ok: false, error: 'Not authenticated' };
    if (!net.isOnline()) return { ok: false, error: 'Offline' };

    try {
      const res = await fetch(
        `${WEB_APP_BASE_URL}/api/collections/${collectionId}/shortcuts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ shortcutId }),
        },
      );
      if (!res.ok) {
        return { ok: false, error: `Server returned ${res.status}` };
      }
      await this.pullCollections(token);
      return { ok: true };
    } catch (err) {
      console.error('[SyncEngine] addToCollection error:', err);
      return { ok: false, error: 'Network error' };
    }
  }

  /**
   * Removes a shortcut from a specific (non-default) collection.
   * Makes a direct API call and refreshes the collections cache on success.
   * Returns an error object if offline or the request fails.
   */
  async removeFromCollection(
    shortcutId: string,
    collectionId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const token = this.authStore.getToken();
    if (!token) return { ok: false, error: 'Not authenticated' };
    if (!net.isOnline()) return { ok: false, error: 'Offline' };

    try {
      const res = await fetch(
        `${WEB_APP_BASE_URL}/api/collections/${collectionId}/shortcuts/${encodeURIComponent(shortcutId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      // 404 is acceptable — shortcut wasn't in the collection.
      if (!res.ok && res.status !== 404) {
        return { ok: false, error: `Server returned ${res.status}` };
      }
      await this.pullCollections(token);
      return { ok: true };
    } catch (err) {
      console.error('[SyncEngine] removeFromCollection error:', err);
      return { ok: false, error: 'Network error' };
    }
  }

  /** Forces an immediate sync cycle (push pending changes then pull remote state). */
  async forceSync(): Promise<void> {
    await this.syncCycle();
  }

  /**
   * Called when the renderer forwards a network-online event via IPC.
   * Guards with net.isOnline() before making API calls.
   */
  async triggerSync(): Promise<void> {
    if (!net.isOnline()) return;
    await this.syncCycle();
  }

  // ---------------------------------------------------------------------------
  // Internal sync cycle: push before pull to prevent a pull from clobbering
  // a locally queued change that hasn't reached the server yet.
  // ---------------------------------------------------------------------------

  private async syncCycle(): Promise<void> {
    if (!this.isAuthenticated()) return;
    if (!net.isOnline()) return;
    await this.push();
    await this.pull();
  }

  private async pull(): Promise<void> {
    const token = this.authStore.getToken();
    if (!token) return;

    try {
      const [favorites, collections] = await Promise.all([
        this.pullFavorites(token),
        this.pullCollections(token),
      ]);

      if (favorites === null || collections === null) return;

      // Last-write-wins merge: compare server timestamps against local pending changes.
      const pending = this.syncStore.getPendingChanges();
      const pendingMap = new Map<string, PendingChange>(
        pending.map((c) => [c.shortcutId, c]),
      );

      const newFavoritedIds: Record<string, string> = {};
      const newFavorites: FavoriteEntry[] = [];

      for (const entry of favorites) {
        const localChange = pendingMap.get(entry.shortcutId);
        if (localChange) {
          if (localChange.timestamp > entry.addedAt) {
            // Local change is newer — keep local state.
            if (localChange.action === 'add') {
              newFavoritedIds[entry.shortcutId] = localChange.timestamp;
              newFavorites.push(entry);
            }
            // action === 'remove': local remove wins, exclude from newFavorites.
          } else {
            // Server is newer — drop the pending change, accept server state.
            pendingMap.delete(entry.shortcutId);
            newFavoritedIds[entry.shortcutId] = entry.addedAt;
            newFavorites.push(entry);
          }
        } else {
          // No pending local change — accept server state.
          newFavoritedIds[entry.shortcutId] = entry.addedAt;
          newFavorites.push(entry);
        }
      }

      // Remaining pending items (adds) that the server doesn't know about yet:
      // keep them in favoritedIds for optimistic display; they push next cycle.
      const remainingPending: PendingChange[] = [];
      for (const [shortcutId, change] of pendingMap) {
        remainingPending.push(change);
        if (change.action === 'add' && !(shortcutId in newFavoritedIds)) {
          // Keep the optimistic id but don't add a partial FavoriteEntry — the
          // next pull will bring the full server record after push succeeds.
          newFavoritedIds[shortcutId] = change.timestamp;
        }
      }

      this.syncStore.setFavorites(newFavorites);
      this.syncStore.setFavoritedIds(newFavoritedIds);
      this.syncStore.setPendingChanges(remainingPending);
      this.syncStore.setCollections(collections);
      this.syncStore.setLastSyncAt(new Date().toISOString());
    } catch (err) {
      console.error('[SyncEngine] pull error:', err);
    }
  }

  private async pullFavorites(token: string): Promise<FavoriteEntry[] | null> {
    try {
      const res = await fetch(`${WEB_APP_BASE_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        console.error('[SyncEngine] pullFavorites: 401 — token expired, backing off');
        return null;
      }
      if (!res.ok) {
        console.error('[SyncEngine] pullFavorites: server error', res.status);
        return null;
      }
      return (await res.json()) as FavoriteEntry[];
    } catch (err) {
      console.error('[SyncEngine] pullFavorites network error:', err);
      return null;
    }
  }

  private async pullCollections(token: string): Promise<CollectionSummary[] | null> {
    try {
      const res = await fetch(`${WEB_APP_BASE_URL}/api/collections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        console.error('[SyncEngine] pullCollections: 401 — token expired, backing off');
        return null;
      }
      if (!res.ok) {
        console.error('[SyncEngine] pullCollections: server error', res.status);
        return null;
      }
      const collections = (await res.json()) as CollectionSummary[];
      this.syncStore.setCollections(collections);
      return collections;
    } catch (err) {
      console.error('[SyncEngine] pullCollections network error:', err);
      return null;
    }
  }

  private async push(): Promise<void> {
    const token = this.authStore.getToken();
    if (!token) return;

    const pending = this.syncStore.getPendingChanges();
    if (pending.length === 0) return;

    const remaining: PendingChange[] = [];

    for (let i = 0; i < pending.length; i++) {
      const change = pending[i];
      try {
        let res: Response;
        if (change.action === 'add') {
          res = await fetch(`${WEB_APP_BASE_URL}/api/favorites`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ shortcutId: change.shortcutId }),
          });
        } else {
          res = await fetch(
            `${WEB_APP_BASE_URL}/api/favorites/${encodeURIComponent(change.shortcutId)}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            },
          );
        }

        if (res.status === 401) {
          console.error('[SyncEngine] push: 401 — token expired, backing off');
          // Re-queue this change and all subsequent ones not yet attempted.
          remaining.push(...pending.slice(i));
          break;
        }

        if (res.status === 403 && change.action === 'add') {
          // Favorites limit reached — drop the pending add and revert local cache.
          console.error('[SyncEngine] push: favorites limit reached for', change.shortcutId);
          const favIds = this.syncStore.getFavoritedIds();
          const updated = { ...favIds };
          delete updated[change.shortcutId];
          this.syncStore.setFavoritedIds(updated);
          this.syncStore.setFavorites(
            this.syncStore.getFavorites().filter((f) => f.shortcutId !== change.shortcutId),
          );
          continue; // Dropped — do not re-queue.
        }

        if (!res.ok && res.status !== 404) {
          // Transient error — retry next cycle.
          remaining.push(change);
        }
        // 2xx or 404 (already removed): change applied, do not re-queue.
      } catch (err) {
        console.error('[SyncEngine] push network error for', change.shortcutId, err);
        remaining.push(change);
      }
    }

    this.syncStore.setPendingChanges(remaining);
  }

  private queuePendingChange(change: PendingChange): void {
    const existing = this.syncStore.getPendingChanges();
    // Replace any prior pending change for the same shortcut with the latest action
    // (e.g. rapid toggle: add → remove collapses to a single remove).
    const filtered = existing.filter((c) => c.shortcutId !== change.shortcutId);
    this.syncStore.setPendingChanges([...filtered, change]);
  }

  private isAuthenticated(): boolean {
    return this.authStore.getToken() !== null;
  }
}

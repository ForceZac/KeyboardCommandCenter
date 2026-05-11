// TASK-0025: Sync cache store — electron-store wrapper for favorites/collections.
// Separate from auth-store.ts (auth lifecycle) and the settings store (preferences).
// Each concern owns its own JSON file to ensure independent clear/update semantics.
import { safeStorage } from 'electron';
import Store from 'electron-store';
import type { FavoriteEntry, CollectionSummary } from '@kcc/core';

export interface PendingChange {
  shortcutId: string;
  action: 'add' | 'remove';
  timestamp: string; // ISO-8601
}

interface SyncCacheSchema {
  favorites: FavoriteEntry[];
  // shortcutId → ISO timestamp (addedAt) — used for last-write-wins conflict resolution
  favoritedIds: Record<string, string>;
  collections: CollectionSummary[];
  pendingChanges: PendingChange[];
  lastSyncAt: string | null;
}

const defaults: SyncCacheSchema = {
  favorites: [],
  favoritedIds: {},
  collections: [],
  pendingChanges: [],
  lastSyncAt: null,
};

export class SyncStore {
  private store: Store<SyncCacheSchema>;

  constructor() {
    // Derive the encryption key by encrypting a per-install constant via safeStorage.
    // This ties the cache to the OS credential store — the JSON at rest is opaque.
    // The <10ms read requirement is met because electron-store keeps the parsed
    // object in memory after init; subsequent reads are in-memory lookups.
    let encryptionKey: string | undefined;
    if (safeStorage.isEncryptionAvailable()) {
      encryptionKey = safeStorage
        .encryptString('kcc-sync-cache-v1')
        .toString('base64');
    }

    this.store = new Store<SyncCacheSchema>({
      name: 'sync-cache',
      defaults,
      ...(encryptionKey ? { encryptionKey } : {}),
    });
  }

  getFavorites(): FavoriteEntry[] {
    return this.store.get('favorites');
  }

  setFavorites(favorites: FavoriteEntry[]): void {
    this.store.set('favorites', favorites);
  }

  getFavoritedIds(): Record<string, string> {
    return this.store.get('favoritedIds');
  }

  setFavoritedIds(ids: Record<string, string>): void {
    this.store.set('favoritedIds', ids);
  }

  getCollections(): CollectionSummary[] {
    return this.store.get('collections');
  }

  setCollections(collections: CollectionSummary[]): void {
    this.store.set('collections', collections);
  }

  getPendingChanges(): PendingChange[] {
    return this.store.get('pendingChanges');
  }

  setPendingChanges(changes: PendingChange[]): void {
    this.store.set('pendingChanges', changes);
  }

  getLastSyncAt(): string | null {
    return this.store.get('lastSyncAt');
  }

  setLastSyncAt(ts: string | null): void {
    this.store.set('lastSyncAt', ts);
  }

  /** Clears all cached data — called on sign-out to prevent stale state. */
  clear(): void {
    this.store.set('favorites', []);
    this.store.set('favoritedIds', {});
    this.store.set('collections', []);
    this.store.set('pendingChanges', []);
    this.store.set('lastSyncAt', null);
  }
}

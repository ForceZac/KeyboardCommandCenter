# Plan: TASK-0025 — Desktop Favorites Sync Engine & Offline Cache

**Branch:** goals/25-desktop-favorites-sync
**TRD:** research/plans/goals/25-desktop-favorites-sync-trd.md
**PRD:** research/agents/prds/goal-07-accounts-favorites.md

---

## Work breakdown

### Slice 1: SyncStore
Create `packages/desktop/src/sync-store.ts` — electron-store wrapper for the sync cache.
- Schema: `favorites` (FavoriteEntry[]), `favoritedIds` (Record<string, string> — shortcutId → ISO timestamp), `collections` (CollectionSummary[]), `pendingChanges` (PendingChange[]), `lastSyncAt` (string | null)
- Methods: get/set/clear for each field; typed, no raw store access from SyncEngine

### Slice 2: SyncEngine core
Create `packages/desktop/src/sync-engine.ts` — SyncEngine class.
- Constructor takes SyncStore + AuthStore (for token reads)
- `start()`: initializes Electron net online/offline listeners, sets 15-min interval, triggers initial sync if signed in
- `stop()`: clears interval, removes net listeners
- `getFavorites()`: returns local cache (SyncStore.getFavorites) — synchronous, <10ms
- `getCollections()`: returns local cache (SyncStore.getCollections) — synchronous, <10ms
- `toggleFavorite(shortcutId)`: applies optimistic local change + queues PendingChange; triggers async push
- `addToCollection(shortcutId, collectionId)`: calls server API directly (no offline queue needed for this — simpler); updates local cache on success
- `removeFromCollection(shortcutId, collectionId)`: same as addToCollection
- `forceSync()`: calls pull() then push() immediately
- Internal `syncCycle()`: push() then pull()
- Internal `pull()`: GET /api/favorites + GET /api/collections, merge with local using last-write-wins
- Internal `push()`: iterate pendingChanges, POST/DELETE /api/favorites, clear on success
- `isAuthenticated()`: reads AuthStore.getToken() !== null
- Network fetch uses Node.js native `fetch` (available in Electron 28 via Node 18+)

### Slice 3: Wire into main.ts
- Instantiate SyncStore and SyncEngine after AuthStore init
- On `auth:signed-in` event → call syncEngine.start()
- On `auth:signed-out` event → call syncEngine.stop() + clear cache
- Register IPC handlers: sync:getFavorites, sync:getCollections, sync:toggleFavorite, sync:addToCollection, sync:removeFromCollection, sync:forceSync

### Slice 4: Expose IPC in preload.ts
Add `kcc.sync` namespace to preload.ts:
- `getFavorites()`, `getCollections()`, `toggleFavorite(shortcutId)`, `addToCollection(shortcutId, collectionId)`, `removeFromCollection(shortcutId, collectionId)`, `forceSync()`

### Slice 5: Tests
Write Vitest unit tests for SyncEngine in `__tests__/sync-engine.test.ts`:
- start/stop lifecycle
- toggleFavorite optimistic update + pending queue
- pull merge logic (conflict resolution)
- push drains pending changes
- signed-out guard (no errors)
- forceSync triggers pull + push

---

## What's NOT in this slice
- Panel UI for favorites (TASK-0026)
- Collection CRUD in panel (read-only via getCollections)
- Real-time sync / WebSocket
- Guest favorites migration

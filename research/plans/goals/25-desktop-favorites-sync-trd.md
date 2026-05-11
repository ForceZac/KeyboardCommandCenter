# TRD: Desktop Favorites Sync Engine & Offline Cache

**Task:** TASK-0025
**Branch:** goals/25-desktop-favorites-sync
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**Date:** 2026-05-11

---

## What we're building

The desktop app (Electron main process) currently has no concept of the user's favorites or collections — those live only in the PostgreSQL database, accessible via the web app's API. TASK-0025 adds a sync engine that maintains a local encrypted copy of the user's favorites and collections on disk, syncs with the server on app start / network reconnection / every 15 minutes, and exposes IPC handlers so the panel renderer can read favorites from local cache and queue local changes. This maps to PRD Flow 7 (offline behavior and sync) and is the foundation TASK-0026 (panel favorites UI) builds on.

## Technical components needed

**New desktop components:**

- `sync-store.ts` — Typed electron-store wrapper for the sync cache. Persists favorites (`FavoriteEntry[]`), a shortcut-id → timestamp index for conflict resolution (`favoritedIds: Record<string, string>`), collections (`CollectionSummary[]`), a pending-changes queue (`PendingChange[]`), and the last successful sync timestamp. Separate store file (`sync-cache`) from the auth store (`auth`) and settings store — each concern owns its own JSON file.

- `sync-engine.ts` — SyncEngine class. Manages the sync lifecycle (start/stop), drives pull/push cycles, exposes synchronous cache-read methods (`getFavorites`, `getCollections`) and the `toggleFavorite` write path. Reads the session token from `AuthStore` for all API calls. Uses Electron's `net` module for online/offline events and Node.js native `fetch` (available in Electron 28 / Node 18+) for HTTP requests — no new network library needed.

**Modified desktop components:**

- `main.ts` — Instantiates `SyncStore` and `SyncEngine` after `AuthStore` init. Wires `auth:signed-in` → `syncEngine.start()` and `auth:signed-out` → `syncEngine.stop()`. Registers six IPC handlers in the `sync:` namespace.

- `preload.ts` — Adds a `kcc.sync` namespace exposing the six IPC channels to the panel renderer via `contextBridge`. Required because `contextIsolation: true` — the renderer cannot call `ipcRenderer` directly.

**New backend components:** None — all server-side API routes were delivered in TASK-0022 (`GET/POST/DELETE /api/favorites`, `GET /api/collections`).

**Schema changes:** No schema changes — all data is stored locally in electron-store.

**API changes:** No new API endpoints. The sync engine is a consumer of the existing web API.

## Key architectural decisions

- **Separate SyncStore file:** Keeping favorites cache in its own store file (`sync-cache`) rather than extending the settings store or auth store. Auth lifecycle and sync cache are independent — clearing the cache on sign-out must not affect settings, and vice versa.

- **Synchronous cache reads:** `getFavorites()` and `getCollections()` read directly from the electron-store in-memory representation (electron-store caches the JSON in memory after first read). This meets the <10ms requirement without any async overhead. Sync I/O is acceptable here because electron-store's in-memory cache avoids disk reads on every call.

- **PendingChange queue with timestamps:** Local changes are queued with ISO timestamps. On pull, the engine applies last-write-wins: if a remote change on the same shortcut has a newer `addedAt` than the local pending change's timestamp, the remote state wins and the pending change is dropped. If the local change is newer, it stays in the queue and gets pushed.

- **Push before pull in sync cycle:** The engine pushes local pending changes before pulling remote state. This prevents a pull from clobbering a locally queued change that hasn't reached the server yet.

- **Electron `net` module for connectivity:** `net.isOnline()` is polled on app start; `app.on('network:online')` / `app.on('network:offline')` events trigger reconnect sync. These are Electron's built-in network APIs — no external library needed.

- **No blocking of the UI thread:** All sync operations are `async` and run in the main process. IPC handler responses for cache reads return synchronously from memory; sync operations are fire-and-forget from the renderer's perspective.

- **Token in Authorization header:** All API calls include `Authorization: Bearer <token>` using the decrypted token from `AuthStore.getToken()`. If the token is null (signed out), the sync engine is a no-op — no errors thrown, no API calls made.

- **Signed-out guard:** `SyncEngine.start()` is only called on `auth:signed-in`. `SyncEngine.stop()` clears the local cache (signed out → no stale favorites visible). If the token expires mid-session and a 401 is returned from the API, the engine logs the error and backs off (does not retry automatically — the user will need to re-authenticate).

## Test coverage plan

- **Unit tests (Vitest):** `__tests__/sync-engine.test.ts`
  - SyncEngine lifecycle: start() initializes timers and triggers pull; stop() clears timers and listeners
  - toggleFavorite: optimistic local update, pending change queued with timestamp
  - pull merge: shortcut present on server + not locally queued → added to cache; shortcut removed on server → removed from cache; local pending change newer than server timestamp → pending change kept; server state newer → pending change dropped
  - push: pending changes POSTed/DELETEd to server; successful push clears pending queue; 401 response logs and does not throw
  - Signed-out guard: getFavorites/getCollections return empty; toggleFavorite no-ops gracefully when not authenticated

- **No E2E tests:** No renderer UI is introduced in this task. E2E tests for favorites interaction belong in TASK-0026 when the panel UI is built.

## Out of scope (technical)

- Panel UI for favorites view or favorite toggle icons (TASK-0026)
- Collection CRUD in the panel (read-only via getCollections)
- Real-time sync via WebSocket
- Guest favorites migration to account on sign-in
- Collection reordering or ordering API
- `addToCollection` / `removeFromCollection` API calls — these IPC handlers are exposed so TASK-0026 can call them, but the sync semantics (queuing, conflict resolution) for collection membership changes are simpler: direct API call, update cache on success, no offline queue needed for collection membership in v1. The IPC handlers will make the API call and refresh the local cache; if offline, they return an error that the UI can handle.

## Risks and open questions

- **electron-store safeStorage for sync cache:** The auth store uses safeStorage for token encryption. The sync cache (favorites list, collections) contains user data but is not as sensitive as auth tokens — it's what the server would return publicly to any authenticated request. Using an unencrypted electron-store for sync data is acceptable for v1. If the PRD requirement changes to encrypt all user data at rest, the `sync-store.ts` wrapper can add safeStorage encryption without changing the SyncEngine interface.

- **`fetch` availability in Electron 28 main process:** Node 18+ (used by Electron 28) includes native `fetch` globally. No `node-fetch` import needed. This should be verified at build time; if not available in the main process context, the fallback is `https.get` from Node's built-in `https` module.

- **Rate limiting on the favorites API:** The web API has a 1000-favorite soft limit enforced server-side. The sync engine will receive a 403 response if this limit is hit during a push. The engine should log the error and remove the offending pending change from the queue (to avoid infinite retry), then pull the current server state.

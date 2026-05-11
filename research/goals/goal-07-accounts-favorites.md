# Goal 07 — User Accounts & Favorites Sync

**Roadmap phase:** Phase 2 — User Identity & Personalization
**PRD:** KeyboardCommandCenter/research/agents/prds/goal-07-accounts-favorites.md

Goal 7 introduces user identity and personalization to Keyboard Command Center. It solves the core retention problem: users who discover shortcuts through the web or desktop panel have no way to save, organize, or recall them across sessions. Goal 7 ships GitHub and Google OAuth sign-in, a favorites and collections data model, a desktop auth flow via browser OAuth and deep link callback, a web UI for heart icons and collections management, a desktop sync engine for offline-first favorites access, and a desktop panel favorites view. It also unblocks Goal 8 (community contributions), which requires identity for attribution and moderation.

---

## TASK-0021: Auth Schema & NextAuth Integration
**PR:** #21 | **Branch:** goals/21-auth-schema-nextauth | **Approved:** 2026-05-10

### What shipped
Added the NextAuth.js Auth.js integration to the web app: User, Account, Session, and VerificationToken Prisma models with migration, GitHub and Google OAuth providers configured in `lib/auth.ts` using PrismaAdapter. A `SessionProvider` wraps the app in `providers.tsx`, and a global header in `layout.tsx` renders `SignInButton` (unauthenticated) or `UserMenu` (avatar initials + display name + dropdown with sign-out) via the server-side `auth()` call. Middleware gates `/api/favorites/*` and `/api/submissions/*` with 401 for unauthenticated requests.

### Key technical decisions
- JWT strategy with PrismaAdapter: session stored in DB, token passed to client for display only
- Auth.js createUser event: foundation for the default "My Favorites" collection hook used in TASK-0022
- Middleware 401 gates on favorites and submissions routes established here, not in each route handler

### Codebase areas touched
- **Backend:** `database/` (migration 20260510000000_add-auth-schema), `packages/web/lib/auth.ts`, `packages/web/app/api/auth/[...nextauth]/route.ts`, `packages/web/middleware.ts`, `packages/web/lib/env.ts`
- **Frontend:** `packages/web/components/SignInButton.tsx`, `packages/web/components/UserMenu.tsx`, `packages/web/app/layout.tsx`, `packages/web/providers.tsx`
- **Tests:** `SignInButton.test.tsx`, `UserMenu.test.tsx` (Vitest/jsdom), `auth.spec.ts` (Playwright — unauthenticated state + 401 middleware guards)

### Reviewer notes
DB-dependent Vitest tests were skipped in CI (no DATABASE_URL). Playwright tests cover unauthenticated state and middleware guards; full sign-in flow requires a live OAuth provider and is covered by manual smoke test.

---

## TASK-0022: Favorites Data Model & CRUD API
**PR:** #22 | **Branch:** goals/22-favorites-data-model-api | **Approved:** 2026-05-10 (Round 4)

### What shipped
Collection and CollectionShortcut Prisma models added with migration (20260510000001_add-favorites-schema). `userId` denormalized on `CollectionShortcut` for efficient per-user queries without joining through Collection. Auth.js `createUser` event auto-creates a default "My Favorites" collection on first sign-in. `FavoritesService` (add/remove/list with 1000-item limit, upsert idempotency) and `CollectionsService` (CRUD with 50-collection limit, default-collection guard) in the web app service layer. Eight API routes with auth gates and IDOR-safe ownership checks.

### Key technical decisions
- `userId` denormalized on `CollectionShortcut`: avoids N+1 join on per-user shortcut queries at the cost of one extra column — correct for read-heavy favorites access
- `LimitReachedError` custom error class in `lib/errors.ts`: business-domain errors use typed error classes, not `ErrnoException` (required after round-1 changes-requested)
- Upsert idempotency on `addFavorite`: duplicate favorites return 201 without error rather than 409, matching optimistic UI expectations

### Codebase areas touched
- **Backend:** `database/` (migration, schema), `packages/web/lib/favorites-service.ts`, `packages/web/lib/collections-service.ts`, `packages/web/app/api/favorites/`, `packages/web/app/api/collections/`, `packages/web/lib/errors.ts`
- **Frontend:** none (backend-only task)
- **Tests:** `favorites.test.ts`, `collections.test.ts`, `createUser-event.test.ts` (26 Vitest unit tests; DB-dependent paths skipped without DATABASE_URL)

### Reviewer notes
Took 4 rounds: round 1 flagged vitest include pattern too broad (picked up integration tests) and wrong error type for limit errors; rounds 2–3 flagged remaining test-config issues. Final round approved cleanly. The vitest unit config pattern is now scoped correctly.

---

## TASK-0023: Desktop Auth Flow — Browser OAuth & Deep Link Callback
**PR:** #23 | **Branch:** goals/23-desktop-auth-flow | **Approved:** 2026-05-11 (Round 1)

### What shipped
Two new Electron main-process modules: `auth-store.ts` (AuthStore class — token encrypted at rest via `safeStorage`, stored in a separate `electron-store` JSON file from settings) and `auth.ts` (coordination module — `handleDeepLinkCallback`, `parseTokenPayload`, `openSignIn`, `signOut`, `getAuthState`, and an internal `authEvents` EventEmitter). `shortcutvault://` custom protocol registered via `app.setAsDefaultProtocolClient()` before `whenReady`. Deep link delivery handled on macOS via `open-url` event and on Windows via `second-instance` argv parsing — both route to `handleDeepLinkCallback`. Tray menu rebuilt dynamically on auth state change (`TrayManager.refreshMenu`). Settings window gains an Account section with signed-in (avatar initials + display name + Sign out button) and signed-out ("Sign in" button) states, updated live via IPC push from main.

### Key technical decisions
- `safeStorage.isEncryptionAvailable()` checked before every encrypt/decrypt — never writes plain text even if safeStorage is unavailable (TRD risk mitigation)
- Token payload decoded locally from base64url JWT segment for display only — no `/api/me` round-trip; signature verification deferred to subsequent API calls (TASK-0025) which will detect 401 and re-auth
- `auth.ts` module keeps auth logic out of `main.ts`, consistent with `tray.ts`, `hotkey.ts`, `overlay-controller.ts` domain separation
- `AuthStore` separate from `SettingsStore`: auth lifecycle (sign in/out) and user preferences (hotkey, startup) are independent concerns
- `shell.openExternal` for OAuth launch: delegates to user's default browser where OS-level auth sessions (Google/GitHub) exist — Electron's Chromium doesn't share those sessions

### Codebase areas touched
- **Backend (Electron main):** `packages/desktop/src/auth.ts` (new), `packages/desktop/src/auth-store.ts` (new), `packages/desktop/src/main.ts` (protocol registration, deep link listeners, IPC handlers, auth event subscriptions), `packages/desktop/src/tray.ts` (auth callbacks, `refreshMenu`), `packages/desktop/src/settings-window.ts` (`sendToRenderer` added)
- **Frontend (Electron renderer):** `packages/desktop/src/settings-preload.ts` (auth namespace on `kccSettings` contextBridge), `packages/desktop/src/renderer/settings.ts` (Account section, `renderAuthState`, push subscriptions), `packages/desktop/src/renderer/settings.html` (Account fieldset), `packages/desktop/src/renderer/settings.css` (`.auth-avatar`, `.account-row`)
- **Tests:** `tray.test.ts` updated — 5 new tests covering Sign in/Sign out menu states and click handler delegation; 252/252 pass; typecheck clean across all three tsconfig targets

### Reviewer notes
PR was merged before review completed (solo project). `parseTokenPayload` is a pure function with zero Electron dependencies — unit tests are absent because the TRD scoped automated testing to typecheck only, but this should be addressed in a future pass (flag when writing the TASK-0025 TRD). No Playwright E2E — Electron auth callback requires a live browser session; manual smoke test is the gate, consistent with TASK-0007 precedent.

---

## TASK-0025: Desktop Favorites Sync Engine & Offline Cache
**PR:** #25 | **Branch:** goals/25-desktop-favorites-sync | **Approved:** 2026-05-11 (Round 2)

### What shipped
`SyncStore` — a typed electron-store wrapper (`sync-cache` JSON file, safeStorage encrypted) that persists favorites, a shortcut-id → ISO timestamp index for LWW conflict resolution, collections, a pending-changes queue, and the last sync timestamp. `SyncEngine` — a main-process service class that starts on `auth:signed-in`, stops and clears cache on `auth:signed-out`, drives push-before-pull sync cycles (on startup and every 15 minutes via `setInterval`), and exposes six IPC handlers (`sync:getFavorites`, `sync:getCollections`, `sync:toggleFavorite`, `sync:addToCollection`, `sync:removeFromCollection`, `sync:forceSync`). `preload.ts` updated with a `kcc.sync` namespace (all six handlers) and `kcc.notifyNetworkOnline()` for forwarding the renderer's `window.ononline` event to the main process.

### Key technical decisions
- Push before pull in every sync cycle: prevents a pull from overwriting a locally queued change that hasn't reached the server yet
- Last-write-wins per shortcut using ISO-8601 timestamps: server wins if its `addedAt` is newer than the local pending change's timestamp; pending change survives and pushes next cycle if local is newer
- Pending-change collapse: `queuePendingChange` replaces any prior pending entry for the same shortcut — rapid add→remove collapses to a single "remove" change
- safeStorage encryption via `safeStorage.encryptString('kcc-sync-cache-v1').toString('base64')` as the electron-store key: ties the cache to the OS credential store; `isEncryptionAvailable()` guard present
- Network reconnect via renderer IPC: `window.ononline` fires in the renderer; `kcc.notifyNetworkOnline()` wraps `ipcRenderer.send('sync:network-reconnected')`; main calls `syncEngine.triggerSync()` guarded by `net.isOnline()`
- `addToCollection`/`removeFromCollection` make direct API calls and refresh the collections cache on success; no offline queue for collection membership in v1

### Codebase areas touched
- **Backend (Electron main):** `packages/desktop/src/sync-store.ts` (new), `packages/desktop/src/sync-engine.ts` (new), `packages/desktop/src/main.ts` (SyncStore + SyncEngine init, auth event wiring, IPC handler registration), `packages/desktop/src/preload.ts` (kcc.sync namespace + notifyNetworkOnline)
- **Frontend:** None — this task is main-process only
- **Tests:** `packages/desktop/src/__tests__/sync-engine.test.ts` — 36 Vitest unit tests covering lifecycle, signed-out guard, toggleFavorite, LWW merge, push drain (including 401/403 error paths), triggerSync, forceSync, and collection operations. All 288 desktop tests pass.

### Reviewer notes
The renderer-side `window.addEventListener('online', () => kcc.notifyNetworkOnline())` listener is TASK-0026's responsibility — the IPC infrastructure is complete. Minor inconsistency: `pullCollections()` writes to the store internally (load-bearing for `addToCollection`/`removeFromCollection` callers) AND `pull()` redundantly writes the same returned value. Not a functional issue but worth cleaning up. TASK-0026 (panel favorites UI) is now unblocked.

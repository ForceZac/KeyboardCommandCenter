# Plan: TASK-0022 — Favorites Data Model & CRUD API

**Branch:** goals/22-favorites-data-model-api
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**TRD:** research/plans/goals/22-favorites-data-model-api-trd.md

---

## Objective

Add the Collection and CollectionShortcut Prisma models, generate a migration, and implement the favorites and collections API routes. The "My Favorites" default collection is auto-created when a new user signs up via the Auth.js `createUser` event callback. All routes enforce session authentication and server-side limits (50 collections / 1000 favorites per user).

**NOT done here:**
- Web UI components (favorites heart icons, collections page) — TASK-0024
- Desktop Electron auth flow or token storage — TASK-0023
- Desktop sync engine or local cache — future task
- Collection reordering, import/export, guest favorites migration

---

## Work breakdown

### Phase 1 — Schema & Migration
1. Extend `database/schema.prisma`:
   - `Collection` model: id, userId, name, description, isDefault, createdAt, updatedAt; relation to User
   - `CollectionShortcut` model: id, userId, collectionId, shortcutId, createdAt; unique on (collectionId, shortcutId)
   - Add inverse relations to `User` and `Shortcut`
2. Run `npx prisma migrate dev --name add_favorites_schema` from `database/` to generate migration SQL

### Phase 2 — Auth.js Event Hook (auto-create default collection)
3. Update `packages/web/lib/auth.ts` — add `events.createUser` callback that calls `prisma.collection.create(...)` to insert "My Favorites" (isDefault: true) for the new userId

### Phase 3 — Service Layer
4. Create `packages/web/services/FavoritesService.ts`:
   - `getFavorites(userId)` — returns shortcuts in default collection with collection info
   - `addFavorite(userId, shortcutId)` — upserts into default collection; enforces 1000 limit
   - `removeFavorite(userId, shortcutId)` — deletes from default collection
5. Create `packages/web/services/CollectionsService.ts`:
   - `listCollections(userId)` — returns all collections with shortcut counts
   - `createCollection(userId, name, description?)` — enforces 50-collection limit
   - `updateCollection(userId, collectionId, patch)` — renames or updates description; blocks default rename only if product decides (not in scope — just update freely)
   - `deleteCollection(userId, collectionId)` — blocks deletion of isDefault collection
   - `getCollectionShortcuts(userId, collectionId)` — returns shortcuts in a specific collection; verifies ownership

### Phase 4 — API Routes
6. `packages/web/app/api/favorites/route.ts` — GET (list), POST (add)
7. `packages/web/app/api/favorites/[shortcutId]/route.ts` — DELETE (remove)
8. `packages/web/app/api/collections/route.ts` — GET (list), POST (create)
9. `packages/web/app/api/collections/[id]/route.ts` — PATCH (update), DELETE (delete)
10. `packages/web/app/api/collections/[id]/shortcuts/route.ts` — GET (list shortcuts in collection)

Each route: read session via `auth()`, return 401 if missing, delegate to service, handle `AppError` for 403/404/400, catch-all 500.

### Phase 5 — Shared Types (packages/core)
11. Add `Collection`, `CollectionSummary`, `FavoriteEntry` types to `packages/core/src/types.ts` (or a new `favorites.ts` file)

### Phase 6 — Tests
12. Vitest request-level tests for each route (mock `auth()` + `prisma`):
    - `favorites.test.ts` — GET 401 (no session), GET 200, POST 201, POST 403 (over limit), DELETE 204
    - `collections.test.ts` — GET 200, POST 201, POST 403 (over limit), PATCH 200, DELETE 204, DELETE 400 (default)
    - `collections-shortcuts.test.ts` — GET 200, GET 401

---

## Build order rationale

Schema first — all service and route code depends on the Prisma models existing.
Auth event hook next — wires default collection creation close to the User model work.
Services before routes — thin controllers depend on services.
Shared types alongside services — routes and future UI both need them.
Tests last — cover each route in isolation with mocked Prisma.

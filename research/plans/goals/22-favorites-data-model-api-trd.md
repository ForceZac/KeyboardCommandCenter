# TRD: Favorites Data Model & CRUD API

**Task:** TASK-0022
**Branch:** goals/22-favorites-data-model-api
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**Date:** 2026-05-10

---

## What we're building

This task adds the persistence layer and REST API for the favorites and collections features defined in PRD Goal 7 (Flows 1 context, Flow 3 prerequisites, and Flow 5). We need two new Prisma models — `Collection` and `CollectionShortcut` — to store named groups of shortcuts per user, and a set of API routes that let clients add/remove individual favorites and perform CRUD on named collections. A "My Favorites" default collection is auto-created when a user first signs up, via the Auth.js `createUser` event hook added to `lib/auth.ts`. All routes enforce authentication (401) and server-side limits (50 collections / 1000 favorites per user, 403 on violation).

---

## Technical components needed

**Schema changes:**
- `collections` table — stores userId, name, description, isDefault flag, timestamps; belongs to User; one unique default per user (enforced at service level, not DB constraint, to allow future multi-default scenarios)
- `collection_shortcuts` join table — userId, collectionId, shortcutId, createdAt (for last-write-wins sync in a later task); unique on (collectionId, shortcutId); belongs to Collection and Shortcut; userId is denormalized here for efficient per-user queries without joins through Collection

**Modified backend components:**
- `database/schema.prisma` — add Collection and CollectionShortcut models and their inverse relations on User and Shortcut
- `packages/web/lib/auth.ts` — add `events.createUser` callback to auto-create the default "My Favorites" collection when a new User row is created via OAuth

**New backend components:**
- `FavoritesService` (`packages/web/services/FavoritesService.ts`) — owns all DB queries for the per-user default-collection favorites: list, add (with limit check), remove
- `CollectionsService` (`packages/web/services/CollectionsService.ts`) — owns all DB queries for named-collection CRUD: list, create (with limit check), update, delete (blocked for isDefault), list shortcuts in a collection
- `GET /api/favorites` — returns shortcuts in the user's default collection with collection metadata
- `POST /api/favorites` — adds a shortcut to the default collection; 403 if ≥1000 favorites
- `DELETE /api/favorites/:shortcutId` — removes a shortcut from the default collection
- `GET /api/collections` — returns all collections for the user with shortcut counts
- `POST /api/collections` — creates a named collection; 403 if ≥50 collections
- `PATCH /api/collections/:id` — renames or updates description; 404 if not found or not owned
- `DELETE /api/collections/:id` — deletes a collection; 400 if it is the default; 404 if not found or not owned
- `GET /api/collections/:id/shortcuts` — returns shortcuts in a specific collection; 404 if not found or not owned

**New frontend components:**
- None — this task is backend-only. UI is TASK-0024.

**New shared types (packages/core):**
- `Collection` — id, userId, name, description, isDefault, shortcutCount, createdAt, updatedAt
- `FavoriteEntry` — shortcutId + shortcut details + collectionId + addedAt
- `CollectionSummary` — id, name, description, isDefault, shortcutCount

**API changes:**
- `GET /api/favorites` — paginated list of favorited shortcuts with collection info
- `POST /api/favorites` — body: `{ shortcutId }` → 201 on success, 403 on limit
- `DELETE /api/favorites/:shortcutId` → 204 on success, 404 if not favorited
- `GET /api/collections` → 200 list
- `POST /api/collections` — body: `{ name, description? }` → 201 on success, 403 on limit
- `PATCH /api/collections/:id` — body: `{ name?, description? }` → 200
- `DELETE /api/collections/:id` → 204, 400 if default, 404 if not found
- `GET /api/collections/:id/shortcuts` → 200 list

---

## Key architectural decisions

- **Auth.js `createUser` event for default collection creation** — rather than Prisma middleware (which runs on every create of any model), the `createUser` event fires only when a new User record is created via Auth.js. This is more targeted, keeps the trigger co-located with auth config, and requires no middleware ordering concerns.
- **Denormalized `userId` on CollectionShortcut** — avoids a join through Collection for per-user queries like "is this shortcut favorited by this user?" which will be needed in the favorites UI (TASK-0024). The PRD explicitly calls for this in the schema scope.
- **Service-layer limit enforcement, not DB constraints** — limits (50 collections, 1000 favorites) are business rules that may change; a service-level check with a 403 response is easier to adjust than a CHECK constraint. A race condition on concurrent creates is acceptable given the solo-user nature of v1.
- **Thin controllers** — route handlers read the session, call the relevant service method, map exceptions to HTTP status codes, and return JSON. No business logic in route files.
- **No soft delete** — collections and favorites are hard-deleted. The PRD has no requirement for an undo or recovery flow.
- **`@kcc/core` types** — Collection/Favorite types go in `packages/core` per the separation-of-concerns rules so the future desktop sync engine (TASK-0025+) can import them without depending on `packages/web`.

---

## Test coverage plan

- **Vitest request/service tests:**
  - `favorites.test.ts` — covers GET 200/401, POST 201/401/403 (limit), DELETE 204/401/404
  - `collections.test.ts` — covers GET 200, POST 201/403, PATCH 200/404, DELETE 204/400 (default)/404
  - `collections-shortcuts.test.ts` — GET 200/401/404
  - `createUser-event.test.ts` — verifies default collection is created when the Auth.js event fires
- **No Playwright E2E for this task** — no UI changes. The API will be covered by E2E tests in TASK-0024 (Favorites Web UI) when the full flow is testable end-to-end.

---

## Out of scope (technical)

- Web UI: heart icons, collections page, optimistic updates — TASK-0024
- Desktop auth flow, electron-store token storage — TASK-0023
- Desktop local favorites cache and sync engine — future task
- Adding shortcuts to a specific named collection (not the default) via the API — this is included in the scope per the backlog (POST /api/collections/:id/shortcuts is not listed; the UI task handles collection assignment via the existing add endpoint with a collectionId param). Actually — re-reading the backlog scope carefully: only the routes listed are in scope. No `POST /api/collections/:id/shortcuts` endpoint; shortcuts are added to collections via the favorites endpoints with a collection target. Collection detail is GET only.
- Guest favorites migration or anonymous-to-authenticated merging
- Sync conflict resolution timestamps being consumed (stored but not acted on until sync engine task)

---

## Risks and open questions

- **Prisma migrate dev** requires a live DATABASE_URL — migration SQL will be written and committed, but `prisma migrate dev` won't run in CI without a real database. This is consistent with how TASK-0021 handled it (migration file committed, applied on the real DB by the developer).
- **`createUser` event firing on every OAuth sign-in vs. only first-time sign-in** — Auth.js fires `createUser` only when a new User record is created (not on every sign-in), so duplicate default collections are not a risk.
- **Race condition on collection limit** — two simultaneous POST /api/collections requests could both pass the ≤49 check and both insert. Acceptable for v1 solo-user context; a DB-level constraint or atomic counter can address this if it becomes an issue.

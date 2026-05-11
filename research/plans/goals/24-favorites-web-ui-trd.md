# TRD: Favorites Web UI — Heart Icons, Collections Page & Optimistic Updates

**Task:** TASK-0024  
**Branch:** goals/24-favorites-web-ui  
**PRD:** research/agents/prds/goal-07-accounts-favorites.md  
**Date:** 2026-05-11

---

## What we're building

TASK-0022 shipped the favorites data model, API routes, and service layer.
TASK-0023 shipped the desktop auth flow. This task completes the web-app side of
Goal 7: surfacing favorites in the UI. We are adding a heart-icon toggle to every
shortcut row on per-app pages, a dropdown to assign shortcuts to named collections,
a "My Collections" management page, and a collection detail view — all backed by
the existing API routes from TASK-0022. The PRD covers this scope in Flows 3 and 5.

One gap was found in the TASK-0022 API surface: `GET /api/collections/:id/shortcuts`
exists, but there is no `POST` (add shortcut to a specific collection) or `DELETE`
(remove shortcut from a specific collection). These are needed for the dropdown and
collection detail remove button, so they will be added as part of this task before
writing any UI code.

---

## Technical components needed

**New backend components:**
- `CollectionsService.addShortcutToCollection` — adds a shortcut to a named (non-default)
  collection; checks collection ownership and uses upsert for idempotency
- `CollectionsService.removeShortcutFromCollection` — removes a shortcut from a named
  collection; returns false if not present
- `POST /api/collections/:id/shortcuts` — add shortcut to a specific collection (needs
  `{ shortcutId }` body); 404 if collection not found or not owned; 409 if shortcut
  already in the collection (or upsert silently — TRD recommends upsert/204)
- `DELETE /api/collections/:id/shortcuts/:shortcutId` — remove a shortcut from a
  specific collection; 404 if not present

**Modified backend components:**
- `app/api/collections/[id]/shortcuts/route.ts` — add `POST` handler alongside the
  existing `GET`

**New frontend components:**
- `FavoriteToggle` — client component: heart icon button + optional collection dropdown.
  Reads state from `useFavorites`. Calls `addFavorite`/`removeFavorite` for the default
  collection. Dropdown lists all named collections with per-collection add/remove.
  Shows sign-in prompt for unauthenticated users.
- `useFavorites` hook — TanStack Query query + mutation wrappers for
  `GET/POST/DELETE /api/favorites`. Exposes `isFavorited(shortcutId)`, `toggle`,
  `addToCollection`, `removeFromCollection`. Optimistic update: mutate cache before
  awaiting the API call, roll back on error.
- `useCollections` hook — TanStack Query for `GET /api/collections`; exposes `create`,
  `rename`, `remove` mutations with optimistic list updates.
- `useCollectionDetail` hook — TanStack Query for `GET /api/collections/:id/shortcuts`;
  exposes `removeShortcut` mutation.
- `CollectionsPageClient` — client shell for `/collections`. Grid of collection cards.
  "New Collection" button opens inline modal. Rename/delete actions on each card.
  Renders nothing (redirect) if unauthenticated.
- `CollectionDetailPageClient` — client shell for `/collections/:id`. List of shortcuts
  with individual remove buttons. Breadcrumb back to My Collections.
- `CollectionCard` (atom) — displays name, description, shortcut count, edit icon,
  delete button (disabled for default collection).

**Modified frontend components:**
- `lib/api.ts` — add typed methods for all favorites + collections endpoints
- `ShortcutRow` — add `FavoriteToggle` on the right side of each row. Toggle is visible
  on row hover (CSS `group-hover`). No structural changes to how shortcuts are rendered.
- `ContextGroup` — pass `shortcut.id` down to `ShortcutRow` (it already receives the
  full `ShortcutEntry` which contains `id`, so this is a small prop threading change)
- `UserMenu` — add "My Collections" link in the dropdown (only visible when signed in)

**Schema changes:**
- No schema changes. Collections and CollectionShortcut tables were added in TASK-0022.

**API changes:**
- `POST /api/collections/:id/shortcuts` — add shortcut to a specific collection
- `DELETE /api/collections/:id/shortcuts/:shortcutId` — remove shortcut from a specific
  collection

**New pages (Next.js App Router):**
- `/collections` — My Collections page (authenticated only)
- `/collections/:id` — Collection detail page (authenticated only)

---

## Key architectural decisions

- **Optimistic UI via TanStack Query:** The favorite toggle fills instantly on click and
  updates the server in the background. On error, `onError` rolls back via
  `queryClient.setQueryData`. This keeps the `<100ms perceived latency` requirement
  without blocking on network. No client-side state outside of Query's cache.
- **`isFavorited` from cached shortcut IDs:** `useFavorites` fetches the full favorites
  list once and exposes `isFavorited(id)` as a derived Set lookup. The component
  renders the filled/unfilled icon from this derived value. Re-renders are bounded
  to the shortcut page since `useFavorites` is only mounted there.
- **FavoriteToggle is auth-aware:** When `useSession()` returns no session, clicking
  the icon shows a modal prompting sign-in instead of calling the API. No 401 errors
  surface to the user.
- **Collection dropdown uses the same `useFavorites` query cache:** The dropdown shows
  a checkmark next to collections that contain the current shortcut. This requires
  knowing membership per-collection. Rather than a per-collection fetch, `useFavorites`
  also fetches `/api/collections` (via `useCollections`) and the UI computes membership
  client-side — acceptable for the collection counts in scope (max 50 collections,
  max 1000 favorites). No extra server round-trips per shortcut row.
- **Server component shells for pages:** `/collections` and `/collections/:id` use
  server component shells to read the session server-side (preventing auth flash),
  then pass auth status to the client shell for interactive parts.
- **No new backend service classes:** The backend additions (2 methods + 2 route
  handlers) extend existing `CollectionsService` rather than introducing new
  service classes. Scope is narrow.
- **No `GET /api/favorites` caching on shortcut page re-render:** The shortcut page
  (per-app) is a server component. It does not prefetch favorites. `useFavorites` runs
  client-side after hydration. This means there is a brief flicker (icon shows
  unfavorited then fills) on first load. This is acceptable for v1 — a future task can
  add server-side prefetch.

---

## Test coverage plan

- **Unit tests (Vitest):**
  - `CollectionsService.addShortcutToCollection` — adds correctly, returns correct
    result; 404 path for unknown collection
  - `CollectionsService.removeShortcutFromCollection` — removes correctly; false for
    missing shortcut
  - `useFavorites` hook — `isFavorited` returns correct values; `toggle` calls correct
    API and rolls back on simulated error
  - `FavoriteToggle` — renders unfilled when not favorited; renders filled when
    favorited; renders sign-in prompt for unauthenticated user

- **E2E (Playwright):**
  - Favorite a shortcut on an app page; verify icon is filled; reload page and verify
    icon is still filled (persisted)
  - Unfavorite: click filled icon, verify it empties
  - Unauthenticated user: click heart icon → sign-in prompt appears
  - Navigate to "My Collections"; create a collection; verify it appears in the list
  - Rename a collection; verify name updated
  - Delete a non-default collection; verify it disappears
  - Add shortcut to a named collection via dropdown; navigate to collection detail;
    verify shortcut appears
  - Remove shortcut from collection detail; verify it disappears

---

## Out of scope (technical)

- Desktop panel favorites view — TASK-0026
- Desktop sync engine — TASK-0025
- Collection reordering / drag-and-drop
- Guest favorites migration (unauthenticated → account)
- Public/shared collections
- Import/export
- Server-side prefetch of favorites state for per-app pages (minor flash is acceptable)
- Correction for the 1000-favorite upsert edge case noted in FavoritesService comments

---

## Risks and open questions

- **Tailwind group-hover for the toggle:** `ShortcutRow` needs `group` on its wrapper
  div and `group-hover:opacity-100` on the toggle (currently hidden via `opacity-0`).
  This is a minor DOM change to an existing component — low risk, but needs smoke test
  to ensure it doesn't break existing row layout on narrow viewports.
- **FavoriteToggle render on every row:** Per-app pages can have 200+ shortcut rows.
  Each mounts a `FavoriteToggle` that reads from the same TanStack Query cache.
  Reads are O(1) Set lookups. No extra network calls per row. Render cost is minimal
  since the component is simple. No pagination or virtualization needed for the icon.
- **Collection membership detection in dropdown:** Computing "which collections contain
  this shortcut" requires iterating all collections and checking CollectionShortcut
  records. Currently `FavoriteEntry` only returns shortcuts in the default collection.
  The dropdown will need a separate fetch or a richer response. Resolution: `useCollections`
  fetches collection summaries (no shortcut membership). For the dropdown checkmark,
  we call `GET /api/collections/:id/shortcuts` on-demand when the dropdown opens — lazy
  fetch, acceptable latency.

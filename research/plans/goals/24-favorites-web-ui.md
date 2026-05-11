# Plan: TASK-0024 — Favorites Web UI

**Task:** TASK-0024  
**Branch:** goals/24-favorites-web-ui  
**PRD:** research/agents/prds/goal-07-accounts-favorites.md

---

## Work breakdown

### Phase 1 — Backend gap: add-to-collection API
The existing `POST /api/collections/:id/shortcuts` route only has a GET handler.
Adding a shortcut to a specific (non-default) collection and removing one from a
specific collection are both needed for the dropdown and the collection detail page.

1. Add `addShortcutToCollection(userId, collectionId, shortcutId)` to `CollectionsService`
2. Add `removeShortcutFromCollection(userId, collectionId, shortcutId)` to `CollectionsService`
3. Add `POST` handler to `app/api/collections/[id]/shortcuts/route.ts`
4. Add `DELETE` handler to `app/api/collections/[id]/shortcuts/[shortcutId]/route.ts` (new file)

### Phase 2 — API client
Extend `packages/web/lib/api.ts` with typed methods:
- `fetchFavorites()` — GET /api/favorites
- `addFavorite(shortcutId)` — POST /api/favorites
- `removeFavorite(shortcutId)` — DELETE /api/favorites/:shortcutId
- `fetchCollections()` — GET /api/collections
- `createCollection(name, description?)` — POST /api/collections
- `updateCollection(id, patch)` — PATCH /api/collections/:id
- `deleteCollection(id)` — DELETE /api/collections/:id
- `fetchCollectionShortcuts(id)` — GET /api/collections/:id/shortcuts
- `addToCollection(collectionId, shortcutId)` — POST /api/collections/:id/shortcuts
- `removeFromCollection(collectionId, shortcutId)` — DELETE /api/collections/:id/shortcuts/:shortcutId

### Phase 3 — Custom hooks
- `useFavorites()` — TanStack Query: fetches favorite shortcut IDs; exposes `isFavorited(id)`,
  `toggle(shortcutId)` with optimistic mutation, rollback on error
- `useCollections()` — fetches user's collections list; exposes `create`, `rename`, `remove`
  mutations with optimistic updates
- `useCollectionDetail(collectionId)` — fetches shortcuts in a specific collection;
  exposes `removeShortcut` mutation

### Phase 4 — FavoriteToggle component
`components/FavoriteToggle.tsx` — client component:
- Heart icon button (filled when favorited, outline when not)
- Tooltip: "Add to My Favorites" / "Remove from My Favorites"
- Dropdown trigger (chevron next to the heart): lists user's named collections
  with checkmarks for collections that already contain this shortcut; clicking
  a collection adds/removes it from that collection
- Shows sign-in prompt dialog when unauthenticated user clicks

### Phase 5 — Wire FavoriteToggle into per-app pages
- Update `ShortcutRow` to accept an optional `shortcutId` prop and render
  `<FavoriteToggle>` on the right side (visible on row hover)
- `ShortcutRow` already receives `shortcut.id` via the `ShortcutEntry` type
- Update `ContextGroup` to pass `shortcut.id` down to `ShortcutRow`

### Phase 6 — UserMenu: "My Collections" link
Add "My Collections" link in the dropdown inside `UserMenu.tsx`.

### Phase 7 — My Collections page
`app/collections/page.tsx` (server component shell) +
`app/collections/CollectionsPageClient.tsx` (client):
- Requires auth — redirect to sign-in if unauthenticated (via middleware or page check)
- Grid of `CollectionCard` components: name, description, shortcut count, edit/delete actions
- "New Collection" button → inline modal form (name + optional description)
- Rename: inline edit on the card
- Delete: confirm dialog; disabled for default collection

### Phase 8 — Collection detail page
`app/collections/[id]/page.tsx` (server shell) +
`app/collections/[id]/CollectionDetailPageClient.tsx` (client):
- List of shortcuts in the collection (reuses `ShortcutRow` display, without the toggle
  to prevent circular complexity — just shows a remove button)
- "Remove" button on each row calls `removeShortcut` mutation with optimistic update
- Breadcrumb: "My Collections → <name>"

### Phase 9 — Tests
- Vitest unit tests for new API client functions (mocked fetch)
- Vitest component tests for `FavoriteToggle` (unauthenticated render, authenticated render,
  toggle state, optimistic UI rollback path)
- Playwright E2E: favorite a shortcut, verify it persists on page reload;
  create a collection, add shortcut to it via dropdown, verify on collection detail

## Order of operations

1. Phase 1 (backend gap) — unit tests for new service methods
2. Phase 2 (API client) — no tests needed beyond existing fetch infrastructure
3. Phase 3 (hooks) — vitest
4. Phases 4+5 (FavoriteToggle + ShortcutRow wiring)
5. Phase 6 (UserMenu link)
6. Phases 7+8 (pages)
7. Phase 9 (E2E)
8. Commit each phase separately; push after each commit

## Key files to modify

- `packages/web/services/CollectionsService.ts` — add 2 methods
- `packages/web/app/api/collections/[id]/shortcuts/route.ts` — add POST handler
- `packages/web/lib/api.ts` — add favorites + collections client methods
- `packages/web/components/ShortcutRow.tsx` — add FavoriteToggle
- `packages/web/components/UserMenu.tsx` — add My Collections link

## Key files to create

- `packages/web/app/api/collections/[id]/shortcuts/[shortcutId]/route.ts`
- `packages/web/components/FavoriteToggle.tsx`
- `packages/web/hooks/useFavorites.ts`
- `packages/web/hooks/useCollections.ts`
- `packages/web/hooks/useCollectionDetail.ts`
- `packages/web/app/collections/page.tsx`
- `packages/web/app/collections/CollectionsPageClient.tsx`
- `packages/web/app/collections/[id]/page.tsx`
- `packages/web/app/collections/[id]/CollectionDetailPageClient.tsx`
- `packages/web/e2e/favorites.spec.ts`

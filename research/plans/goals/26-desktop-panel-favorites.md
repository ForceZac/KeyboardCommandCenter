# Plan: TASK-0026 — Desktop Panel Favorites View & Favorite Toggle

**Branch:** goals/26-desktop-panel-favorites
**TRD:** research/plans/goals/26-desktop-panel-favorites-trd.md
**PRD:** research/agents/prds/goal-07-accounts-favorites.md

---

## Work breakdown

### Slice 1: IPC — expose isSignedIn
Add `sync:isSignedIn` IPC handler in `main.ts` that calls `syncEngine.isAuthenticated()`.
Expose as `window.kcc.sync.isSignedIn()` in `preload.ts`.
No new types needed — boolean return.

### Slice 2: HTML structure update
Update `index.html` to add view tab buttons beneath the app-header.
- Add `#view-tabs` container with two buttons: `#tab-app-shortcuts` and `#tab-my-favorites`
- `#shortcuts-container` remains (App Shortcuts view)
- Add `#favorites-container` (hidden by default — My Favorites view)

### Slice 3: CSS additions
Add styles to `app.css`:
- `.view-tabs` bar layout (flex row, flush below header)
- `.tab` button base style (no chrome, themed)
- `.tab.active` underline/highlight
- `.shortcut-row .fav-btn` hover-reveal heart button
- `.fav-btn.favorited` filled state
- `.favorites-section-header` collection name heading in favorites view
- `.fav-row-app` app-name chip/label on favorites rows
- `.favorites-empty` unauthenticated prompt styling

### Slice 4: shortcut-list.ts — add favorite toggle button to rows
Modify `renderShortcutRow()` to accept an optional `isFavorited: boolean` and `shortcutId: string`.
Add a `<button class="fav-btn" data-shortcut-id="${id}" aria-label="Toggle favorite">` to each row.
Filled vs unfilled state set via `.favorited` class.
Pre-lowercased `data-cmd`/`data-combo` unchanged so search still works.

### Slice 5: favorites-list.ts — new renderer module
Create `packages/desktop/src/renderer/favorites-list.ts`.
- `renderFavoritesView(collections: CollectionSummary[], favorites: FavoriteEntry[], searchQuery: string): string`
- Groups FavoriteEntry[] by collectionId, matches to CollectionSummary for display name
- Each section: `<div class="favorites-section">` with a `<div class="favorites-section-header">` and rows
- Each row: command + key combo + app-name chip + fav-btn (always filled in favorites view)
- `data-cmd` / `data-app` attributes for search filter
- Offline: renders from cache with no special indicator (cache is always current)
- Empty (no favorites): show "No saved favorites yet" message

### Slice 6: favorites-list.ts — unauthenticated state
`renderSignInPrompt(): string` — renders "Sign in to save favorites. Use Sign In from the tray menu." message block.
Called by `index.ts` when `isSignedIn` returns false and the My Favorites tab is active.

### Slice 7: index.ts — wire tab switching and favorites view
- Grab `#tab-app-shortcuts`, `#tab-my-favorites`, `#favorites-container` elements
- Add click listeners for both tabs; track `currentView: 'app-shortcuts' | 'favorites'`
- On switch to My Favorites: call `renderFavoritesView` and inject into `#favorites-container`, show it, hide `#shortcuts-container`
- On switch to App Shortcuts: reverse, re-render current app if needed
- On app-changed event: stay on current tab; update App Shortcuts content; if on favorites tab, no re-render needed
- Wire `document.addEventListener('click', delegated)` in `#favorites-container` for `.fav-btn` clicks (same delegation pattern as fallback recent-apps)

### Slice 8: Favorite toggle interaction
In `index.ts` (or a new `favorites-toggle.ts`), handle `.fav-btn` click:
1. Read `data-shortcut-id` from the button
2. Immediately toggle `.favorited` class on the button (optimistic UI)
3. Call `await window.kcc.sync.toggleFavorite(shortcutId)`
4. SyncEngine is always optimistic — no failure path to revert (per TASK-0025 design)
5. If in App Shortcuts view: only update the clicked row's icon
6. If in Favorites view: after toggle, re-render the favorites list (shortcut will disappear from the unfavorited state)

### Slice 9: Search filter extension
Modify `search.ts` to handle both views:
- Current: filters `.shortcut-row` elements by `data-cmd` / `data-combo`
- Addition: when favorites view is active, also filter `.fav-row` elements by `data-cmd` / `data-app`
- `applyFilter()` takes the active view as a parameter, or reads a DOM data attribute
- No-results message remains shared

### Slice 10: Tests
Vitest unit tests in `__tests__/favorites-list.test.ts`:
- `renderFavoritesView` with multiple collections, multiple favorites
- `renderFavoritesView` with empty favorites (shows empty message)
- `renderSignInPrompt` renders sign-in copy
- Correct grouping by collection
- App name rendered per row
- `data-cmd` / `data-app` attributes present on rows

Vitest tests in `__tests__/shortcut-list.test.ts` (additive):
- `renderShortcutRow` with `isFavorited=true` → `.favorited` class on button
- `renderShortcutRow` with `isFavorited=false` → no `.favorited` class
- `data-shortcut-id` attribute present on fav-btn

Playwright E2E (`e2e/panel-favorites.spec.ts`):
- Tab toggle switches view (App Shortcuts ↔ My Favorites)
- Favorite icon visible on hover on a shortcut row
- Clicking favorite icon fills it (optimistic UI)
- Favorites view renders collections and shortcuts
- Search filters favorites view results
- Unauthenticated: My Favorites tab shows sign-in prompt

---

## What's NOT in this slice
- Collection CRUD in the panel (read-only; manage collections on web)
- Adding/removing from specific collections in the panel
- Drag-and-drop or collection reordering
- Sync engine or API logic (TASK-0025 — already shipped)
- Web favorites UI (TASK-0024 — already shipped)
- Desktop auth flow (TASK-0023 — already shipped)

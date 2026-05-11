# TRD: Desktop Panel Favorites View & Favorite Toggle

**Task:** TASK-0026
**Branch:** goals/26-desktop-panel-favorites
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**Date:** 2026-05-11

---

## What we're building

TASK-0025 shipped the sync engine — it can cache and sync favorites but the panel UI has no way to display or interact with them. This task wires that engine into the panel renderer: adding a two-tab toggle (App Shortcuts / My Favorites) at the top of the panel, a hover-reveal favorite-toggle button on each shortcut row in App Shortcuts view, and a full Favorites view that renders cached shortcuts grouped by collection. All reads come from the synchronous in-memory cache (`sync:getFavorites`, `sync:getCollections`) so the panel never blocks on the network. Writes go through `sync:toggleFavorite` which is optimistic by design (TASK-0025). PRD Flows 4 and 6 define the UX contract.

---

## Technical components needed

**New IPC channel:**
- `sync:isSignedIn` handler in `main.ts` — reads `syncEngine.isAuthenticated()` and returns a boolean; needed so the renderer can decide whether to render the My Favorites tab or a sign-in prompt. No new type.

**Modified Electron preload (`packages/desktop/src/preload.ts`):**
- Expose `window.kcc.sync.isSignedIn()` — proxies the new `sync:isSignedIn` channel

**Modified panel HTML (`packages/desktop/src/renderer/index.html`):**
- Add `#view-tabs` container with two `<button>` elements (`#tab-app-shortcuts`, `#tab-my-favorites`) between the app-header and search input
- Add `#favorites-container` `<div>` (hidden by default) alongside the existing `#shortcuts-container`

**Modified CSS (`packages/desktop/src/renderer/app.css`):**
- Tab bar styles (`.view-tabs`, `.tab`, `.tab.active`)
- Favorite toggle button (`.fav-btn` hover-reveal, `.fav-btn.favorited` filled state)
- Favorites view collection heading (`.favorites-section-header`)
- App name label on favorites rows (`.fav-row-app`)
- Empty / unauthenticated state message blocks

**Modified `packages/desktop/src/renderer/shortcut-list.ts`:**
- `renderShortcutRow()` gains two new parameters: `shortcutId: string` and `isFavorited: boolean`
- Adds a `<button class="fav-btn" data-shortcut-id="…">` to each row; `.favorited` class added when `isFavorited` is true
- Existing `data-cmd` / `data-combo` attributes unchanged — search filter is unaffected

**New `packages/desktop/src/renderer/favorites-list.ts`:**
- `renderFavoritesView(collections: CollectionSummary[], favorites: FavoriteEntry[]): string` — groups FavoriteEntry[] by collectionId, renders one `<div class="favorites-section">` per collection containing a heading and shortcut rows; each row includes the app name (from `FavoriteEntry.shortcut.appName`), command name, key combo (from first platform binding via `renderKeyComboHTML`), and a filled `.fav-btn`; `data-cmd` and `data-app` attributes on each row for search filtering
- `renderSignInPrompt(): string` — static HTML block prompting the user to sign in via the tray menu
- `renderNoFavorites(): string` — empty state shown when signed in but no favorites saved yet

**Modified `packages/desktop/src/renderer/index.ts`:**
- Track `currentView: 'app-shortcuts' | 'favorites'` state variable
- Tab click handlers: on My Favorites tab click, call `window.kcc.sync.isSignedIn()` and either render the favorites list or the sign-in prompt into `#favorites-container`; show/hide the two containers accordingly
- Delegated click listener on `#favorites-container` and `#shortcuts-container` for `.fav-btn` buttons — reads `data-shortcut-id`, calls `window.kcc.sync.toggleFavorite(id)`, immediately toggles `.favorited` on the clicked button (optimistic); if the click was in the favorites view, re-renders the favorites list so the unfavorited shortcut disappears
- On app-changed event: always re-render `#shortcuts-container` content regardless of which tab is active; do not reset the active tab
- `renderShortcutList()` call updated to pass `favoritedIds` set (obtained from `getFavorites()`) so each row knows its filled state at render time

**Modified `packages/desktop/src/renderer/search.ts`:**
- `applyFilter()` extended to handle both views: when favorites view is active, filter `.fav-row` elements by `data-cmd` and `data-app` instead of `.shortcut-row` by `data-cmd` and `data-combo`; view state communicated via a parameter or DOM query

**Schema changes:** No schema changes — all persistence via TASK-0025 SyncStore.

**API changes:** No new API endpoints — all data served from existing `sync:getFavorites` / `sync:getCollections` IPC channels from TASK-0025.

---

## Key architectural decisions

- **Synchronous cache reads only:** The renderer never awaits a network call for favorites data. `getFavorites()` and `getCollections()` both return from the in-memory electron-store cache in <10ms. This is the design guarantee from TASK-0025 — the panel stays fast.

- **Optimistic toggle, no revert logic:** `toggleFavorite` is always optimistic and never throws locally (TASK-0025 design). The renderer updates the icon immediately and does not need an error path. If a sync cycle later discovers a conflict, the sync engine resolves it server-side and the next `getFavorites()` call (on next panel open or forced sync) reflects reality.

- **Re-render on view switch, not on every toggle:** The favorites list is rendered fresh each time the My Favorites tab is activated and after each toggle in the favorites view. This avoids keeping a shadow state in the renderer and keeps the logic simple — the in-memory cache is cheap to re-read.

- **Delegated event listeners (existing pattern):** Following the same pattern as the fallback recent-apps click handler in `index.ts`. One delegated listener on each container rather than attaching individual listeners to every button, which would be re-attached on each render.

- **No new shared types in @kcc/core:** `FavoriteEntry` and `CollectionSummary` from TASK-0025 already carry everything needed. The renderer re-declares types locally in `types.ts` per existing rootDir constraint.

- **FavoriteEntry key combo source:** `FavoriteEntry` stores `shortcut.id`, `shortcut.command`, `shortcut.appName`, and `shortcut.appSlug` but not platform bindings. Favorites rows in the panel will display the command name and app name only; key combo display is not available from the favorites cache shape (would require an additional IPC lookup per shortcut, which adds latency and complexity). This is acceptable — the favorites view is a quick-reference list, not a full keybinding display. Key combos remain visible in App Shortcuts view.

- **Sign-in detection via `sync:isSignedIn`:** Adding a dedicated IPC channel rather than inferring from an empty `getFavorites()` result, which would be ambiguous (a newly signed-in user with zero favorites would also return empty). The channel is a thin boolean check against AuthStore — one line in main.ts.

---

## Test coverage plan

- **Vitest unit tests:**
  - `favorites-list.test.ts` — `renderFavoritesView` with multi-collection favorites, empty favorites, sign-in prompt render, correct grouping, app name and data attributes on rows
  - Additive tests in `shortcut-list.test.ts` — `renderShortcutRow` favorite button presence, `.favorited` class with `isFavorited=true`, `data-shortcut-id` attribute

- **Playwright E2E (`e2e/panel-favorites.spec.ts`):**
  - Tab toggle renders correct view (App Shortcuts ↔ My Favorites)
  - Favorite icon visible on hover on a shortcut row in App Shortcuts view
  - Clicking favorite icon fills it immediately (optimistic UI, <100ms)
  - My Favorites tab renders collections and shortcut rows
  - Search filters the My Favorites view (matches on command name and app name)
  - Unauthenticated: My Favorites tab shows sign-in prompt, not shortcut list
  - No regressions on existing App Shortcuts view (search, keycaps, fallback states)

---

## Out of scope (technical)

- Adding or removing shortcuts from specific named collections in the panel (collection assignment stays on the web app — PRD Out of scope for this task)
- Collection CRUD (create, rename, delete) in the panel
- Key combo display in favorites rows (would require per-shortcut IPC lookups — deferred)
- Guest (unauthenticated) favorites stored locally before sign-in (PRD Open Questions — desktop guest flow is out of scope for this task)
- Drag-and-drop or reorder in the panel
- Real-time sync or push notifications for favorites changes

---

## Risks and open questions

- **FavoriteEntry platform bindings:** The current `FavoriteEntry` type (from TASK-0025) does not include platform binding data (key combos). Favorites rows in the panel will show command + app name but not the key combo. If the Reviewer considers key combos a must-have in the favorites view, the `FavoriteEntry` type and sync engine pull logic would need a `platforms` array added — a non-trivial TASK-0025 change that would need a separate task. Flagging here so the Reviewer can weigh in before coding.

- **Panel dimensions:** The panel is 680×420px. Adding a tab bar (estimated 36px) above the search input compresses the shortcut list area. If this feels cramped in testing, the height may need to increase slightly in `window.ts`. Not a blocker — can adjust during build.

- **Auth IPC surface from TASK-0023:** `sync:isSignedIn` is proposed as a new channel on the sync namespace. Confirm this doesn't conflict with the existing auth channels from TASK-0023 before writing code.

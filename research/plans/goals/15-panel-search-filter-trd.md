# TRD: Panel Search/Filter Input

**Task:** TASK-0015
**Branch:** goals/15-panel-search-filter
**PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
**Date:** 2026-05-10

---

## What we're building

TASK-0015 adds a real-time search/filter input to the shortcut panel (PRD Flow 2). When the user types in the input, the already-rendered shortcut rows are shown or hidden via DOM attribute toggling — no re-render, no IPC round-trip. Context group headings with all rows hidden disappear from view. A "No matching shortcuts" message surfaces when nothing matches. The input is auto-focused each time a new app's shortcuts load, so the user can immediately start filtering without a mouse click.

This sits strictly within the `packages/desktop` renderer layer, touching no IPC, no main-process code, and no Prisma/database logic. It depends on the shortcut list rendered by TASK-0013 (`shortcut-list.ts`) being in the DOM.

---

## Technical components needed

**New frontend components (desktop renderer):**
- `renderer/search.ts` — filter module; exposes `initSearch(input, container, noResults)` and `applyFilter(query, container, noResults)` and `resetFilter(input, container, noResults)`. Operates on the live DOM produced by `shortcut-list.ts`.

**Modified frontend components:**
- `renderer/index.html` — add `#search-container` (with `#search-input`) between `#app-header` and `#shortcuts-container`, and `#no-results` div below `#shortcuts-container`.
- `renderer/app.css` — styles for `#search-container`, `#search-input`, `#no-results`. Dark theme consistent with existing panel.
- `renderer/shortcut-list.ts` — add `data-cmd` and `data-combo` attributes to each `.shortcut-row` element so the filter can match without reading rendered HTML content.
- `renderer/index.ts` — call `initSearch(...)` on DOMContentLoaded; call `resetFilter(...)` and focus `#search-input` in `handleAppChanged` after each successful app load.

**New tests:**
- `__tests__/search.test.ts` — jsdom-based unit tests covering all acceptance criteria.

**Schema changes:** No schema changes.

**API changes:** No new endpoints or IPC changes.

---

## Key architectural decisions

- **DOM-visibility filtering over re-render:** Matching rows are shown; non-matching rows get the HTML `hidden` attribute. This avoids regenerating HTML strings on every keystroke, meeting the <50ms performance target for 200+ shortcuts without virtualization. The initial render (done by TASK-0013) happens once per app-changed event; the filter operates on that stable DOM.

- **Data attributes hold pre-lowercased text:** `data-cmd` stores the lowercased `shortcut.command` and `data-combo` stores the lowercased `binding.keyCombo` string (the raw chord string from the IPC response, e.g. `"ctrl+k → ctrl+c"`). Using the raw keyCombo avoids parsing rendered HTML; lowercasing at render time means the filter comparison is a single `includes(lowerQuery)` call per row, no per-keystroke string allocation.

- **`hidden` attribute over `display:none` via CSS class:** The HTML `hidden` attribute is spec-standard, doesn't require class toggling boilerplate, and is queryable via `el.hidden`. The filter logic stays clean.

- **Context group hiding via parent walk:** After updating row visibility, the filter iterates `.context-group` elements and hides any whose `.shortcut-row` children are all hidden. This is a one-pass O(n) walk over groups (not rows), keeping keystroke latency low.

- **No dependencies added:** The search module is vanilla TypeScript — no libraries, no new npm packages. It compiles under the existing `tsconfig.renderer.json`.

- **Auto-focus on app-changed, not just on load:** The panel window persists across app switches. Focusing only on `DOMContentLoaded` would miss subsequent app-changed events. `handleAppChanged` calls `resetFilter` then `searchInput.focus()` after each successful render.

---

## Test coverage plan

- **Unit tests (`__tests__/search.test.ts`, jsdom):**
  - Filter hides non-matching rows, shows matching rows
  - Matching against `data-cmd` (command description substring)
  - Matching against `data-combo` (key combo substring)
  - Case-insensitive match (uppercase query vs lowercase data attribute)
  - Context group heading hidden when all its `.shortcut-row` children are hidden
  - Context group remains visible when at least one row matches
  - "No matching shortcuts" message shows when zero rows match
  - "No matching shortcuts" message hidden when at least one row matches
  - Clearing the filter (empty query) restores all rows and hides the message
  - `resetFilter` clears input value and makes all rows visible

- **E2E tests:** Not applicable — the panel renderer runs in Electron, which is not accessible to Playwright in the CI environment. This exception is established (same precedent as TASK-0013 and TASK-0007).

---

## Out of scope (technical)

- Fuzzy matching or ranked results
- Keyboard navigation within filter results (arrow keys to move between matching rows)
- Debouncing the input event (200+ shortcuts filter in <50ms; debounce adds latency for no benefit at this scale)
- Any IPC, main-process, or database changes
- Overlay mode (Goal 6)
- User accounts (Goal 7)

---

## Risks and open questions

- **TASK-0013 not yet merged to main:** TASK-0015's branch forks from main, which does not yet include TASK-0013's `shortcut-list.ts` with the rendered DOM this task filters. The branch will need to either cherry-pick TASK-0013 or wait for the PR merge before the code compiles correctly. The plan is to develop and test against the same DOM structure TASK-0013 produces, verifying locally with its types. When the owner merges TASK-0013, this branch will rebase cleanly. **Mitigation:** the filter module (`search.ts`) operates on the DOM interface (`HTMLElement`, `querySelectorAll`) and does not import from `shortcut-list.ts`, so it will compile independently. The `data-cmd`/`data-combo` attributes added to `shortcut-list.ts` will conflict with TASK-0013's version if both branches modify that file — this merge must be handled carefully.

- **Panel layout height:** Adding the search input row inside the fixed 420px panel reduces visible shortcut rows. The search input is expected to be ~40px tall (padding + input). With the existing app header (~45px), that leaves ~335px for the shortcut list, which comfortably shows 10+ rows. No layout concerns.

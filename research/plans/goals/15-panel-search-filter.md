# Plan: TASK-0015 — Panel Search/Filter Input

**Branch:** goals/15-panel-search-filter
**PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
**Date:** 2026-05-10

---

## What we're building

A real-time search/filter input inside the shortcut panel, positioned between the app header and the shortcut list. User types → matching shortcuts stay visible → non-matching rows hide. Context group headings with no matching rows also hide. A "No matching shortcuts" message appears when nothing matches. Input is auto-focused whenever a new app loads.

---

## Work breakdown

### Phase 1 — HTML structure
- Add `#search-container` div (with `<input id="search-input">`) to `index.html` between `#app-header` and `#shortcuts-container`
- Add `#no-results` div inside `#shortcuts-container` (or just below it) for the empty-filter message

### Phase 2 — CSS styling
- Style `#search-container` and `#search-input` to match the dark panel theme
- Style `#no-results` message (centered, muted text)
- Ensure layout flex column still fits within 420px panel height

### Phase 3 — Add data attributes to shortcut rows
- In `shortcut-list.ts`, add `data-cmd` and `data-combo` attributes to `.shortcut-row`
- Values are pre-lowercased for O(1) comparison during filter
- `data-combo` holds the raw `keyCombo` string (e.g. "ctrl+k → ctrl+c") — no need to parse HTML

### Phase 4 — search.ts module
- `initSearch(input, container, noResults)` — attaches `input` event listener
- `applyFilter(query, container, noResults)` — iterates `.shortcut-row` nodes, toggles `hidden` attribute based on substring match; hides `.context-group` when all its rows are hidden; shows/hides `#no-results`
- `resetFilter(input, container, noResults)` — clears query, shows all rows

### Phase 5 — Wire in index.ts
- Grab `#search-input` and `#no-results` on DOMContentLoaded
- Call `initSearch(...)` once to attach the listener
- In `handleAppChanged`: call `resetFilter(...)` then focus the search input after each app load

### Phase 6 — Tests
- `__tests__/search.test.ts` with jsdom
- Cases: filter shows matching, hides non-matching, case-insensitive, group heading hidden when all rows hidden, no-results shown when nothing matches, clear restores all, empty query shows all

### Phase 7 — Verify
- `npm run build -w packages/desktop` (tsc check via tsconfig.renderer.json)
- `npm run test -w packages/web` (unit tests)
- Manual check: all 6 acceptance criteria pass

---

## File touch-list

| File | Change |
|---|---|
| `packages/desktop/src/renderer/index.html` | Add `#search-container`, `#search-input`, `#no-results` |
| `packages/desktop/src/renderer/app.css` | Style search input + no-results |
| `packages/desktop/src/renderer/shortcut-list.ts` | Add `data-cmd` + `data-combo` to `.shortcut-row` |
| `packages/desktop/src/renderer/search.ts` | New — filter logic |
| `packages/desktop/src/renderer/index.ts` | Wire search, auto-focus, reset on app-change |
| `packages/desktop/src/__tests__/search.test.ts` | New — unit tests for filter logic |

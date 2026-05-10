# Plan: TASK-0016 — Panel Fallback States

**Branch:** goals/16-panel-fallback-states
**Task:** TASK-0016
**PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md

---

## Work breakdown

### Phase 1 — New `renderer/fallback.ts` module
- Define `FallbackType` enum and `RecentAppEntry` type
- Implement `renderNoDetection()` — "No app detected" message + recent apps list
- Implement `renderUnrecognizedApp(processName)` — "Shortcuts not available for [name]" + list
- Implement `renderNoShortcuts(appName)` — "No shortcuts found for [name]" + list
- Implement `renderRecentAppsList(apps: RecentAppEntry[])` — shared list HTML
- Implement `renderEmptyRecentApps()` — shown when history is empty
- All values HTML-escaped via `escHtml`

### Phase 2 — DOM: add `#fallback-container` to `index.html`
- Add `<div id="fallback-container" hidden></div>` below `#shortcuts-container`
- Keep `#no-results` where it is (still used by the search module for mid-session filter)

### Phase 3 — Update `renderer/index.ts` — extend `handleAppChanged`
- Identify the three fallback cases:
  - `payload.appSlug === null && payload.processName === ''` → no-detection
  - `payload.appSlug === null && payload.processName !== ''` → unrecognized
  - `payload.appSlug !== null && appDetail returned && contexts empty` → no-shortcuts
  - `payload.appSlug !== null && appDetail === null` → treat as no-shortcuts (DB edge case)
- When in fallback: call `getRecentApps()`, then `Promise.all` over `getShortcutsForApp(slug)` per slug to get names
- Render fallback HTML into `#fallback-container`; show it; hide `#shortcuts-container` and `#search-container`
- Add click event delegation on `#fallback-container` — `.recent-app-item[data-slug]` click triggers `handleAppChanged` with the chosen slug
- When showing shortcuts (happy path): show `#shortcuts-container` + `#search-container`; hide `#fallback-container`

### Phase 4 — Styles: update `renderer/app.css`
- Add styles for `.fallback-container`, `.fallback-message`, `.fallback-subtitle`, `.recent-apps-list`, `.recent-app-item`
- Dark theme matching existing panel aesthetic (gray text, hover highlight)
- Minimal — no animation, no icons

### Phase 5 — Unit tests: `__tests__/fallback.test.ts`
- `renderNoDetection()` — contains "No app detected", contains empty-state message when no apps
- `renderUnrecognizedApp(processName)` — contains escaped process name, contains recent apps
- `renderNoShortcuts(appName)` — contains escaped app name
- `renderRecentAppsList()` — correct slug in data-slug, escapes special chars in names
- `renderEmptyRecentApps()` — renders gracefully

### Phase 6 — Integration tests: update `__tests__/shortcut-list.test.ts` or new `__tests__/fallback-integration.test.ts`
- handleAppChanged routes to correct fallback state for each of the three cases
- Recent apps loaded and rendered in fallback views
- Click on recent app item triggers shortcut load

## Sequence
1 → 2 → 3 → 4 → 5 → 6

## Notes
- Reuses all existing IPC (`getRecentApps`, `getShortcutsForApp`) — no new IPC channels
- Event delegation on `#fallback-container` avoids memory leaks from adding/removing listeners per render
- `#search-container` visibility toggled so the search input isn't visible/focusable in fallback state (nothing to search)

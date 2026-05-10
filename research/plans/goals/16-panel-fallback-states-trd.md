# TRD: Panel Fallback States — No Detection, Unrecognized App, No Shortcuts

**Task:** TASK-0016
**Branch:** goals/16-panel-fallback-states
**PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
**Date:** 2026-05-10

---

## What we're building

The panel renderer currently shows a blank state when no shortcuts can be displayed — it clears the header and shortcut container and stops. This task implements the three fallback states described in PRD Flows 3 and 4: (1) no app detected, (2) unrecognized app (process not in the database), and (3) recognized app with an empty shortcut set. Each fallback state shows an appropriate message and a clickable list of recently-detected apps (up to 5 entries from the detection service's history), so the user can still navigate to an app they've used before without leaving the panel. Clicking a recent app entry loads that app's shortcuts via the same IPC path as a normal detection event.

---

## Technical components needed

**New renderer components:**
- `renderer/fallback.ts` — Pure HTML-rendering functions for fallback states. Accepts typed inputs (message strings, `{slug, name}[]` array), returns escaped HTML strings. No DOM side-effects — identical pattern to `shortcut-list.ts`. Exports: `renderNoDetection`, `renderUnrecognizedApp`, `renderNoShortcuts`, `renderRecentAppsList`, `renderEmptyRecentApps`.

**Modified renderer components:**
- `renderer/index.ts` — `handleAppChanged` extended to identify which of the three fallback cases applies, call `window.kcc.getRecentApps()` and then parallel `window.kcc.getShortcutsForApp()` per slug to build a name list, render fallback HTML into `#fallback-container`, and toggle element visibility. A single delegated click listener on `#fallback-container` handles `.recent-app-item[data-slug]` clicks by calling `handleAppChanged` with the selected slug.
- `renderer/index.html` — New `<div id="fallback-container" hidden></div>` added alongside the existing `#shortcuts-container`. `#search-container` visibility is toggled: shown only when the happy path is active.
- `renderer/app.css` — Styles for `.fallback-message`, `.fallback-subtitle`, `.recent-apps-list`, `.recent-app-item`, `.recent-app-item:hover`. Dark theme matching existing panel aesthetic.

**No new IPC channels** — reuses `window.kcc.getRecentApps()` (returns `string[]` of slugs) and `window.kcc.getShortcutsForApp(slug)` (returns `AppDetail | null`) already exposed in `preload.ts`.

**Schema changes:** No schema changes.

**API changes:** No new endpoints.

---

## Key architectural decisions

- **Reuse existing IPC (no new channel).** Recent app names are fetched via `getShortcutsForApp` per slug — the same cached IPC call the panel already uses. Since detection prefetches shortcuts for every recognized app (TASK-0012), the cache should be warm for recently-used apps. Up to 5 parallel calls via `Promise.all`.
- **Distinguish fallback cases from the `DetectionPayload` fields.** The detection service emits `{ appSlug: null, processName: '' }` for the no-active-window case and `{ appSlug: null, processName: '<name>' }` for unrecognized apps — this is reliable signal without adding new IPC. Recognized-app-with-no-shortcuts is detected by checking `Object.keys(appDetail.contexts).length === 0` after a successful `getShortcutsForApp` call.
- **Event delegation for recent-app clicks.** A single `click` listener on `#fallback-container` using `event.target.closest('.recent-app-item[data-slug]')` handles all recent-app entries. This avoids adding and removing individual listeners on each re-render.
- **`#search-container` is hidden in fallback states.** There are no shortcuts to search, so showing the input would confuse users. It is re-shown on the happy path.
- **Recent apps whose name lookup fails are omitted from the list.** If `getShortcutsForApp` returns null for a recent slug (the app has been removed from the DB or the DB is down), that entry is skipped silently rather than showing a broken row.

---

## Test coverage plan

- **Unit tests** (`__tests__/fallback.test.ts`):
  - `renderNoDetection` — contains "No app detected", renders empty-apps message when list is empty, renders app entries when list is non-empty
  - `renderUnrecognizedApp(processName)` — contains the escaped process name, handles special HTML characters in process names
  - `renderNoShortcuts(appName)` — contains the escaped app name
  - `renderRecentAppsList` — each entry has correct `data-slug` attribute, escapes special chars in app names
  - `renderEmptyRecentApps` — renders without error

- **Integration tests** (extend existing renderer integration pattern or new `__tests__/fallback-integration.test.ts`):
  - `handleAppChanged` with `{ appSlug: null, processName: '' }` → renders no-detection fallback
  - `handleAppChanged` with `{ appSlug: null, processName: 'SomeApp.exe' }` → renders unrecognized-app fallback with process name
  - `handleAppChanged` with recognized slug but empty contexts → renders no-shortcuts fallback with app name
  - Recent apps list populated from `getRecentApps()` mock return
  - Click on `.recent-app-item` triggers `handleAppChanged` with the clicked slug
  - Edge case: empty recent apps list renders gracefully

---

## Out of scope (technical)

- Keyboard navigation within the fallback list (arrow keys to move between recent app entries)
- "Browse all apps" web link in the fallback state (PRD mentions it as an option; scope says recent apps list only)
- Overlay fallback states (handled by TASK-0020)
- Animation/transitions for state changes
- Fetching app icons for the recent apps list (text-only per PRD scope)

---

## Risks and open questions

- **Cold-start name lookup latency.** If the user opens the panel before detection fires for any app (desktop app just launched), `getRecentApps()` returns an empty list — the fallback shows correctly but has no recent apps to click. This is acceptable behavior (and the acceptance criteria only require the list works when history exists).
- **`processName === ''` sentinel.** Used to distinguish no-detection from unrecognized app. The detection service on `main` already emits this sentinel (`detection.ts` line: `this.emitToRenderer('detection:app-changed', { appSlug: null, processName: '', windowTitle: '' })`). This is stable and reliable.
- **AppDetail null for known slug.** If `getShortcutsForApp` returns null for a non-null `appSlug` (DB unavailable), we show the no-shortcuts fallback with the slug as the display name (since we don't have the real name). Minor UX degradation, but no crash and no hang.

# Goal 05 — Shortcut Panel UI (Desktop)

**Roadmap phase:** Phase 2 — Desktop Feature Buildout
**PRD:** KeyboardCommandCenter/research/agents/prds/goal-05-shortcut-panel-ui.md

Goal 5 turns the placeholder Electron panel into a functional shortcut viewer. When a user presses the global hotkey, the panel opens and immediately displays shortcuts grouped by context for the currently-detected active application, meeting a 100ms render target. The goal also covers real-time search/filter (TASK-0015), fallback states for unrecognized or no-shortcut apps (TASK-0016), and the IPC data layer that prefetches shortcut data on app-change events (TASK-0012). This is the task where the desktop app delivers tangible value over the web interface.

---

## TASK-0012: Shortcut Data IPC Layer & Prefetch
**PR:** #13 | **Branch:** goals/12-shortcut-ipc-layer | **Approved:** 2026-05-10

### What shipped
Added a `shortcuts:get-by-app` IPC handler in the Electron main process that queries PostgreSQL via Prisma, groups results by context/scope, and returns structured data to the renderer. A preload module exposes `getShortcutsForApp(slug)` via contextBridge. Prefetch logic fires on detection `app-changed` events, caching up to 5 recent app results in memory to meet the 100ms render target.

### Key technical decisions
- In-memory LRU cache (max 5 entries) invalidated on slug change — avoids DB round-trips for recently-detected apps
- Prefetch triggered from existing `detection:app-changed` event, no new IPC channels needed
- Returns empty result for unknown slugs rather than throwing — graceful degradation

### Codebase areas touched
- **Backend:** `packages/desktop/src/main/ipc/shortcuts.ts` (handler), Prisma query grouping by context
- **Frontend:** `packages/desktop/src/preload/index.ts` (contextBridge exposure)
- **Tests:** Unit tests for handler, cache behavior, and unknown-slug edge case

### Reviewer notes
Cache is in-process memory — clears on Electron restart. No persistence needed at this stage; if the detection service is slow to fire app-changed, the first panel open may fall back to a live DB query (still under 100ms target in local dev).

---

## TASK-0013: Panel Content Renderer & Shortcut Key Caps
**PR:** #14 | **Branch:** goals/13-panel-content-renderer | **Approved:** 2026-05-10

### What shipped
Built the panel renderer that displays grouped shortcuts fetched via the TASK-0012 IPC layer. Shortcuts render in collapsible `<details>` context groups with command name left-aligned and key combo right-aligned. Key combos render as styled `<kbd>` elements with platform-appropriate modifier key labels (Cmd on macOS, Ctrl on Windows). Each `.shortcut-row` carries `data-cmd` and `data-combo` attributes (pre-lowercased) for use by the search filter.

### Key technical decisions
- DOM built via `innerHTML` string assembly per app-changed event — fast, no framework overhead for the panel's read-only display
- `data-cmd`/`data-combo` attributes pre-lowercased at render time so search filter avoids per-keystroke string allocation
- Platform detection via `navigator.platform` in the renderer — no IPC round-trip needed

### Codebase areas touched
- **Frontend:** `packages/desktop/src/renderer/shortcut-list.ts`, `renderer/app.css`, `renderer/index.ts`
- **Tests:** jsdom unit tests for rendering, grouping, platform key formatting, and empty-state handling

### Reviewer notes
The `innerHTML=` replacement on each app-changed event means any child element not regenerated in the new HTML string is orphaned. TASK-0015 hit this bug with `#no-results` and fixed it by placing that element outside `#shortcuts-container`.

---

## TASK-0015: Panel Search/Filter Input
**PR:** #15 | **Branch:** goals/15-panel-search-filter | **Approved:** 2026-05-10

### What shipped
Added a real-time search/filter input (`#search-input`) to the panel renderer, positioned below the app header and above the shortcut list. Typing filters `.shortcut-row` elements via DOM `hidden` attribute toggling against `data-cmd` and `data-combo` attributes — no re-render, no IPC. Context group headings with all rows hidden are also hidden. A `#no-results` message (placed outside `#shortcuts-container`) appears when nothing matches. Input is auto-focused on each app-changed event.

### Key technical decisions
- DOM-visibility filtering via `HTMLElement.hidden` rather than CSS class toggling — spec-standard, queryable, no class churn
- `#no-results` lives outside `#shortcuts-container` so `container.innerHTML=` replacement on app-change does not orphan it (Round 1 regression bug, fixed in Round 2)
- No library dependencies — vanilla TypeScript only, compiles under existing `tsconfig.renderer.json`
- Auto-focus called in `handleAppChanged` after each successful render, not just on `DOMContentLoaded`, so the input is ready across all app switches

### Codebase areas touched
- **Frontend:** `packages/desktop/src/renderer/search.ts` (filter module), `renderer/index.html` (`#search-container`, `#no-results` placement), `renderer/app.css` (search styles), `renderer/index.ts` (wiring)
- **Tests:** `src/__tests__/search.test.ts` — 14 unit tests covering all acceptance criteria + 1 regression test for the `#no-results` orphan bug

### Reviewer notes
Round 1 rejected for `#no-results` being inside `#shortcuts-container` (destroyed by `innerHTML=` on app-change). Round 2 fixed placement and added an explicit regression test. E2E not applicable — panel renderer runs in Electron, not accessible to Playwright in CI (same exception as TASK-0013 and TASK-0007).

# Backlog

Single source of truth for the agent task queue. The Project Manager grooms this file; the Developer and Reviewer move tasks between sections. Do not hand-edit while agents are running — touch `PAUSE` first.

## Task lifecycle

```
Ready → In Progress (TRD phase) → In Progress (build phase) → In Review → Approved → Shipped
                   ↘ TRD Changes Requested → (back to In Progress)
                                                            ↘ Changes Requested → (back to In Review)
Blocked  (waiting on dependency, missing PRD, or owner)
```

## Task format

```markdown
### TASK-NNNN: short title
- **Goal:** Goal N from the roadmap (cite section)
- **PRD:** research/agents/prds/goal-NN-short-title.md
- **Scope:** what's in, what's NOT in
- **Acceptance:** bullet list of testable criteria
- **PR:** (filled by Developer)
- **Branch:** (filled by Developer)
- **TRD:** (filled by Developer — path + status: awaiting-review / changes-requested: reason / approved)
- **Notes:** anything reviewer should know
```

Task IDs are monotonic. The Project Manager picks the next number.

---

## Ready

_(Project Manager keeps 2–3 tasks here at all times.)_

### TASK-0017: Overlay BrowserWindow & Toggle Hotkey
- **Goal:** Goal 6 — Overlay Mode
- **PRD:** research/agents/prds/goal-06-overlay-mode.md
- **Scope:** Create the Electron BrowserWindow for the overlay: frameless, `transparent: true`, `backgroundColor: '#00000000'`, `alwaysOnTop: true` with level `'floating'`, `setIgnoreMouseEvents(true, { forward: true })` for full click-through. Register a secondary configurable global hotkey (default Ctrl+Shift+O on Windows / Cmd+Shift+O on macOS) via `globalShortcut` that toggles overlay window visibility. Add overlay preferences to `electron-store`: `overlay.enabled` (bool, default false), `overlay.hotkey` (string), `overlay.opacity` (number, default 0.4), `overlay.position` (string, default "Top Right"), `overlay.size` (string, default "Standard"). Position the overlay on the correct monitor using Electron's `screen` API. Ensure the panel window has a higher z-order than the overlay when both are visible (PRD Flow 6). NOT in scope: overlay renderer content or React components (separate task), settings UI section for overlay preferences (separate task), detection integration and app-switch content updates (separate task), opacity live preview in settings.
- **Acceptance:**
  - Overlay BrowserWindow is frameless, transparent, always-on-top with `'floating'` level
  - Overlay window is click-through — all mouse events pass to the underlying window on both Windows and macOS
  - Configurable global hotkey toggles overlay window show/hide
  - Default hotkey is Ctrl+Shift+O (Windows) / Cmd+Shift+O (macOS)
  - Overlay preferences stored in electron-store with correct defaults
  - Overlay appears on the same monitor as the active application window
  - Panel window renders above overlay when both are visible (higher z-order)
  - Overlay does not increase idle memory by more than 20MB
  - No crash when overlay hotkey is pressed before detection service is running
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** First Goal 6 task — the overlay window shell. Depends on Goal 5 completion (panel and detection infrastructure must be on main). Look-ahead task queued while Goal 5 wraps up so the Developer doesn't idle between goals.

### TASK-0016: Panel Fallback States — No Detection, Unrecognized App, No Shortcuts
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **Scope:** Handle all three fallback states in the panel renderer. (1) No app detected: display "No app detected" message with brief explanation, plus a list of recently-detected apps from the detection service that the user can click to load shortcuts manually. (2) Unrecognized app: display "Shortcuts not available for [Process Name]", plus recent apps list. (3) Recognized app with no shortcuts in the database: display "No shortcuts found for [App Name]", plus recent apps list. The recent apps list reuses data from the detection service's app history (exposed via existing IPC). Each recent app entry is clickable to load that app's shortcuts in the panel. NOT in scope: search/filter input (TASK-0015), overlay mode (Goal 6), user accounts (Goal 7), keyboard navigation within the fallback list (future task).
- **Acceptance:**
  - Panel shows "No app detected" message when detection returns no active app
  - Panel shows "Shortcuts not available for [Process Name]" when detected app is not in the database
  - Panel shows "No shortcuts found for [App Name]" when recognized app has zero shortcuts
  - Recent apps list displays up to 5 recently-detected apps in all three fallback states
  - Clicking a recent app loads that app's shortcuts in the panel
  - Fallback states render within 100ms (same perf target as normal panel content)
  - No unhandled errors for edge cases (empty detection history, all recent apps unrecognized)
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Fourth Goal 5 task — covers PRD Flows 3 and 4. Depends on TASK-0013 (panel content renderer) and TASK-0012 (IPC data layer). Should be buildable once TASK-0013 ships.

## In Progress

_(Developer moves tasks here. TRD phase first, then build phase after TRD approval.)_

### TASK-0018: Overlay Renderer — Compact Shortcut Display
- **Goal:** Goal 6 — Overlay Mode
- **PRD:** research/agents/prds/goal-06-overlay-mode.md
- **Scope:** Build the overlay renderer content using React in the `packages/overlay` package (per PRD recommendation). The overlay window (from TASK-0017) loads this renderer. Display: app name (small, muted text) at top, shortcuts grouped by the top 3–4 context groups, compact format with command name left-aligned and key combo right-aligned. Show at most 8–12 shortcuts per visible group. If the app has more shortcuts than displayed, show a count indicator ("+ N more in panel"). Apply the user's configured opacity to the content container background (semi-transparent background with high-opacity text: `background: rgba(0,0,0, userOpacity)` with `color: rgba(255,255,255,0.95)`). Support "Compact" and "Standard" size presets controlling the number of visible shortcuts/groups. Expose an IPC listener for `detection:app-changed` to receive new shortcut data and re-render. Handle unrecognized app state: show "No shortcuts for [Process Name]" message. NOT in scope: settings UI for overlay preferences (separate task), BrowserWindow creation or hotkey registration (TASK-0017), detection service changes, live preview of opacity from settings, overlay positioning logic, multi-monitor support.
- **Acceptance:**
  - Overlay content renders in the overlay BrowserWindow with semi-transparent background
  - App name displayed at top in muted text
  - Shortcuts grouped by context (top 3–4 groups), compact layout: command left, key combo right
  - "Standard" size shows more shortcuts/groups than "Compact"
  - Overflow indicator shows "+ N more in panel" when shortcuts exceed display limit
  - Unrecognized app shows "No shortcuts for [Process Name]" message
  - Content updates when `detection:app-changed` fires with new app data
  - Overlay content renders within 200ms
  - Overlay renderer uses React (packages/overlay)
- **PR:** (draft — TRD awaiting review)
- **Branch:** goals/18-overlay-renderer
- **TRD:** research/plans/goals/18-overlay-renderer-trd.md — approved
- **Notes:** Second Goal 6 task — builds the renderer content for the overlay window shell from TASK-0017. Uses pre-fetched shortcut data from the existing IPC/prefetch layer (TASK-0012). Depends on TASK-0017.

## In Review

_(Developer moves tasks here when the draft PR is marked ready.)_

## Changes Requested

_(Reviewer moves tasks here when a PR needs rework.)_

## TRD Changes Requested

_(TRD Watcher moves tasks here when a TRD needs rework.)_

## Approved

_(Reviewer moves tasks here after approving the PR. You merge to main, then move to Shipped.)_

### TASK-0015: Panel Search/Filter Input
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **Scope:** Add a search/filter input to the shortcut panel, positioned below the app header and above the shortcut list. When the user types, filter the displayed shortcuts in real time — matching against command description text and key combo text (case-insensitive substring match). Context group headings with no matching shortcuts should be hidden during filtering. Display a "No matching shortcuts" message when the filter matches nothing. Clearing the input restores the full shortcut list. The search input should be focused and ready for typing when the panel opens. Target <50ms filter response per keystroke on lists of 200+ shortcuts. NOT in scope: fallback states for no-detection/unrecognized app (separate task), fuzzy matching or advanced search operators, overlay mode (Goal 6), user accounts (Goal 7).
- **Acceptance:**
  - Search input renders below app header, above shortcut list
  - Search input is focused when the panel opens
  - Typing filters shortcuts in real time by command description and key combo text
  - Filtering is case-insensitive substring matching
  - Context group headings with no matching results are hidden
  - "No matching shortcuts" message displays when filter matches nothing
  - Clearing input restores the full shortcut list
  - Filter response <50ms per keystroke on 200+ shortcuts
- **PR:** #15
- **Branch:** goals/15-panel-search-filter
- **TRD:** research/plans/goals/15-panel-search-filter-trd.md — approved
- **Approved:** 2026-05-10 (Round 2 — reviewer approved, awaiting owner merge)
- **Notes:** Third Goal 5 task — adds search/filter on top of the renderer from TASK-0013. Round 1 changes requested: move #no-results outside #shortcuts-container, add regression test. Round 2: both fixed, 146/146 pass.

### TASK-0012: Shortcut Data IPC Layer & Prefetch
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **Scope:** Add a `shortcuts:get-by-app` IPC handler in the Electron main process that accepts an app slug, queries PostgreSQL via Prisma for all shortcuts belonging to that app, groups results by context/scope, and returns structured data to the renderer. Expose a `getShortcutsForApp(slug)` method via contextBridge preload. Add prefetch logic: when the detection service fires an app-changed event, the main process proactively fetches and caches shortcut data for the new app so it's ready when the panel opens (meeting the 100ms render target from the PRD). Cache the most recent 5 app results in memory; invalidate on slug change. NOT in scope: panel UI rendering or visual components (separate task), search/filter UI, fallback state UI, overlay mode (Goal 6), user accounts (Goal 7), Linux (Goal 10).
- **Acceptance:**
  - `shortcuts:get-by-app` IPC handler accepts an app slug and returns grouped shortcut data
  - Preload exposes `getShortcutsForApp(slug)` via contextBridge
  - Data is fetched from PostgreSQL via Prisma ORM
  - Shortcuts are grouped by context/scope in the response
  - Prefetch fires automatically on detection app-changed event
  - Cached results serve immediately for recently-detected apps (up to 5)
  - Response time <50ms for cached apps (no DB round-trip)
  - Handler returns empty result for unknown app slugs (no crash)
  - No unhandled exceptions if database is unreachable
- **PR:** #13
- **Branch:** goals/12-shortcut-ipc-layer
- **TRD:** research/plans/goals/12-shortcut-ipc-layer-trd.md — approved
- **Approved:** 2026-05-10 (Round 1 — reviewer approved, awaiting owner merge)

### TASK-0014: Reconcile Goal 4 Stubs — process-map.ts & active-window.ts
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **Scope:** Write the real `lookupApp()` implementation in process-map.ts (bundleId-first lookup from process-map.json, normalized process name fallback, .exe stripping) and the real `loadNativeModule` + `createActiveWindowDetector` wrapper in active-window.ts (three-path binary probe for packaged/webpack-dev/non-webpack runtimes). Both were stubs on main causing 49 test failures. NOT in scope: changes to DetectionService, TrayManager, main.ts, process-map.json, or test files.
- **Acceptance:**
  - lookupApp() returns correct app slugs via bundleId-first lookup with process name fallback
  - loadNativeModule probes three paths for the kcc-native .node binary
  - createActiveWindowDetector returns a factory-pattern detector instance
  - All 49 previously-failing tests pass (40 lookupApp + 9 active-window)
  - No regressions in existing passing tests
- **PR:** #12
- **Branch:** goals/14-reconcile-goal4-stubs
- **TRD:** research/plans/goals/14-reconcile-goal4-stubs-trd.md — approved
- **Approved:** 2026-05-10 (Round 2 — reviewer approved, awaiting owner merge)
- **Notes:** Added retroactively by PM — Developer opened this PR outside normal backlog flow. Addresses PROP-0003 and PROP-0004.

## Shipped

_(You move tasks here after merging to main.)_

### TASK-0013: Panel Content Renderer & Shortcut Key Caps
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **PR:** #14
- **Branch:** goals/13-panel-content-renderer
- **TRD:** research/plans/goals/13-panel-content-renderer-trd.md — approved
- **Approved:** 2026-05-10 (Round 1 — reviewer approved)
- **Merged:** 2026-05-10

### TASK-0011: Tray "Recent Apps" Submenu
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **PR:** #11
- **Branch:** goals/11-tray-recent-apps
- **TRD:** research/plans/goals/11-tray-recent-apps-trd.md — approved
- **Approved:** 2026-05-10 (post-hoc — owner merged directly after round 2 resubmit)
- **Merged:** 2026-05-10

### TASK-0010: Detection Polling Service & IPC Integration
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **PR:** #10
- **Branch:** goals/10-detection-polling-service
- **TRD:** research/plans/goals/10-detection-polling-service-trd.md — approved
- **Approved:** 2026-05-10
- **Merged:** 2026-05-10

### TASK-0009: Rust Native Module for Active Window Detection
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **PR:** #9
- **Branch:** goals/9-rust-native-module
- **TRD:** research/plans/goals/9-rust-native-module-trd.md — approved
- **Approved:** 2026-05-10
- **Merged:** 2026-05-10

### TASK-0008: Process-to-App Mapping Table
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **PR:** #8
- **Branch:** goals/8-process-map
- **TRD:** research/plans/goals/8-process-map-trd.md — approved
- **Approved:** 2026-05-09
- **Merged:** 2026-05-10

### TASK-0007: Settings Persistence & Login Startup Registration
- **Goal:** Goal 3 — Desktop App Shell (Electron + Tray)
- **PRD:** research/agents/prds/goal-03-desktop-app-shell.md
- **PR:** #7
- **Branch:** goals/7-settings-persistence
- **TRD:** research/plans/goals/7-settings-persistence-trd.md — approved
- **Approved:** 2026-05-10
- **Merged:** 2026-05-10

### TASK-0005: Per-App Shortcut Pages, Category Browse Pages & Platform Toggle
- **Goal:** Goal 2 — Web Search & Browse Interface
- **PRD:** research/agents/prds/goal-02-web-search-browse.md
- **PR:** #6
- **Branch:** goals/5-per-app-category-pages
- **TRD:** research/plans/goals/5-per-app-category-pages-trd.md — approved
- **Approved:** 2026-05-09
- **Merged:** 2026-05-10

### TASK-0004: Homepage & Global Search UI
- **Goal:** Goal 2 — Web Search & Browse Interface
- **PRD:** research/agents/prds/goal-02-web-search-browse.md
- **PR:** #5
- **Branch:** goals/4-homepage-search
- **TRD:** research/plans/goals/4-homepage-search-trd.md — approved
- **Approved:** 2026-05-09
- **Merged:** 2026-05-09

### TASK-0006: Electron App Shell — Tray Icon + Global Hotkey + Panel Window
- **Goal:** Goal 3 — Desktop App Shell (Electron + Tray)
- **PRD:** none — shipped without PRD (process bypass, see PROP-0001)
- **Scope:** Retroactively recorded. Electron app with tray icon, global hotkey, and panel window. PR #4 was worked on and merged outside the normal backlog/PRD flow.
- **Acceptance:** (not defined pre-work — retroactive entry)
- **PR:** #4
- **Branch:** goals/6-electron-app-shell
- **TRD:** n/a
- **Merged:** 2026-05-09
- **Notes:** This task was never created by the PM or tracked in backlog.md. Added retroactively to maintain backlog as single source of truth. See PROP-0001 for process gap.

### TASK-0003: API Routes for Shortcut Data
- **Goal:** Goal 2 — Web Search & Browse Interface
- **PRD:** research/agents/prds/goal-02-web-search-browse.md
- **PR:** #3
- **Branch:** goals/3-api-routes
- **TRD:** research/plans/goals/3-api-routes-trd.md — approved
- **Merged:** 2026-05-09

### TASK-0002: Seed Script & Data for 50+ Applications
- **Goal:** Goal 1 — Shortcut Data Schema & Seed Database
- **PRD:** research/agents/prds/goal-01-shortcut-data-schema.md
- **PR:** #2
- **Branch:** goals/2-seed-script
- **TRD:** research/plans/goals/2-seed-script-trd.md — approved
- **Merged:** 2026-05-09

### TASK-0001: Define Prisma Schema for Shortcut Database
- **Goal:** Goal 1 — Shortcut Data Schema & Seed Database
- **PRD:** research/agents/prds/goal-01-shortcut-data-schema.md
- **PR:** #1
- **Branch:** goals/1-prisma-schema
- **TRD:** research/plans/goals/1-prisma-schema-trd.md — approved
- **Merged:** 2026-05-09

## Blocked

_(Waiting on an external dependency, a missing PRD, or owner decision.)_

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
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** First Goal 5 task — provides the data plumbing for the panel UI. Depends on Goal 4 shipping (detection service IPC provides the app slug). TASK-0011 is the last Goal 4 task; once it ships, this task is unblocked.

### TASK-0013: Panel Content Renderer & Shortcut Key Caps
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **Scope:** Build the panel content renderer that displays shortcut data fetched via the IPC layer (TASK-0012). When the panel opens, render an app header with the detected app name, then list shortcuts grouped by context/scope (e.g. "General", "Editor", "Terminal", "Debug"). Each shortcut row shows the command description on the left and a visual key cap rendering on the right (styled `<kbd>` elements with monospace font and visual separators for chord sequences, matching the web app's KeyCap/KeyCombo pattern). Detect the user's OS at runtime and display platform-appropriate modifier keys (Cmd on Mac, Ctrl on Windows — no manual toggle needed on desktop). Context group headings should be collapsible. NOT in scope: search/filter input (separate task), fallback states for no-detection/unrecognized/no-shortcuts (separate task), recent apps fallback list, keyboard navigation beyond Escape to dismiss (existing behavior), overlay mode (Goal 6), user accounts (Goal 7), app icons (text-only for v1), theming/dark mode, Linux (Goal 10).
- **Acceptance:**
  - Panel displays shortcut data for the detected app, grouped by context/scope
  - App header shows the detected app's display name at the top of the panel
  - Shortcut rows show command description (left) and key cap rendering (right)
  - Key caps use styled `<kbd>` elements with visual separators for chord sequences
  - Platform-appropriate modifiers display correctly (Cmd on Mac, Ctrl on Windows)
  - Context/scope groups render with clear headings that are collapsible
  - Panel content renders within 100ms using prefetched data from TASK-0012
  - No scroll jank on apps with 200+ shortcuts (virtualize or lazy-render if needed)
  - No unhandled errors if IPC returns empty or malformed data
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Second Goal 5 task — builds the visual layer on top of the data plumbing from TASK-0012. Depends on TASK-0012 shipping first (provides `getShortcutsForApp()` via preload). Porting the visual key cap pattern from the web app's components (packages/web) is recommended but the desktop renderer uses vanilla HTML/CSS, not React/Tailwind — duplicate the CSS pattern rather than extracting to packages/core (per PRD recommendation).

## In Progress

_(Developer moves tasks here. TRD phase first, then build phase after TRD approval.)_

### TASK-0014: Reconcile Goal 4 Stubs — process-map.ts & active-window.ts
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **Scope:** Implement the real `lookupApp()` function in process-map.ts (read from process-map.json, perform byProcess + byBundleId lookup with normalization and .exe stripping) and the real `loadNativeModule()` + `createActiveWindowDetector()` in active-window.ts (TypeScript wrapper for the kcc-native .node binary). Both files are stubs on main — the real implementations were written in PR #11 (TASK-0011) but correctly reverted as out-of-scope. 49 pre-existing tests fail on main because of these stubs. NOT in scope: modifying process-map.json data, changing detection polling service behavior, changing tray submenu behavior, new features — only making existing tests pass.
- **Acceptance:**
  - All 40 pre-existing lookupApp tests in process-map pass
  - All 9 pre-existing active-window tests pass
  - DetectionService resolves real app slugs via lookupApp()
  - No regressions in existing passing tests
- **PR:** #12
- **Branch:** goals/14-reconcile-goal4-stubs
- **TRD:** research/plans/goals/14-reconcile-goal4-stubs-trd.md — awaiting-review
- **Notes:** Addresses PROP-0003 and PROP-0004. The implementations were already written once in PR #11 and reverted — the developer can reference that commit for the exact code. This must ship before Goal 5 tasks so detection actually works end-to-end.

## In Review

_(Developer moves tasks here when the draft PR is marked ready.)

## Changes Requested

_(Reviewer moves tasks here when a PR needs rework.)_

## TRD Changes Requested

_(TRD Watcher moves tasks here when a TRD needs rework.)_

## Approved

_(Reviewer moves tasks here after approving the PR. You merge to main, then move to Shipped.)_

### TASK-0011: Tray "Recent Apps" Submenu
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **PR:** #11
- **Branch:** goals/11-tray-recent-apps
- **TRD:** research/plans/goals/11-tray-recent-apps-trd.md — approved
- **Approved:** 2026-05-10
- **Notes:** Completes Goal 4's user-facing definition of done (PRD Flow 2). PROP-0003 (lookupApp stub) and PROP-0004 (active-window.ts stub) filed for follow-on reconciliation tasks (TASK-0014).

## Shipped

_(You move tasks here after merging to main.)_

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

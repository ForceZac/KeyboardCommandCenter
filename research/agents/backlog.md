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

_(Empty — Goal 7 PRD does not exist yet. Cannot create new tasks until Product Manager writes `research/agents/prds/goal-07-accounts-favorites.md`.)_

## In Progress

_(Developer moves tasks here. TRD phase first, then build phase after TRD approval.)_

### TASK-0020: Overlay Detection Integration & App-Switch Content Updates
- **Goal:** Goal 6 — Overlay Mode
- **PRD:** research/agents/prds/goal-06-overlay-mode.md
- **Scope:** Wire the overlay renderer to the detection service so overlay content updates when the active app changes. Listen for the `detection:app-changed` IPC event in the overlay preload/renderer (same channel the panel uses). On app change: fetch shortcuts for the new app via the existing `shortcuts:get-by-app` IPC (prefetch cache serves immediately), re-render the compact shortcut display with the new app's data. Handle unrecognized apps: show a muted "No shortcuts for [Process Name]" message in the overlay (PRD Flow 5). Handle no-detection state: show "No app detected" in the overlay. Ensure content update completes within 200ms of receiving the IPC event (success metric from PRD). NOT in scope: overlay BrowserWindow creation or positioning (TASK-0017), overlay renderer components or styling (TASK-0018, shipped), settings UI (TASK-0019), panel fallback states (TASK-0016), drag-to-reposition, Linux/Wayland, fullscreen app detection.
- **Acceptance:**
  - Overlay content updates to show the correct app's shortcuts when the active app changes
  - Content update completes within 200ms of receiving the detection:app-changed event
  - Overlay shows "No shortcuts for [Process Name]" when the detected app is not in the database
  - Overlay shows "No app detected" when detection returns no active app
  - Overlay reuses the panel's prefetch cache — no duplicate database queries
  - App name header in the overlay updates to reflect the currently detected app
  - No flash or blank state during content transitions between apps
  - No unhandled errors when detection service fires events before overlay renderer is ready
- **PR:** #19
- **Branch:** goals/20-overlay-detection-integration
- **TRD:** research/plans/goals/20-overlay-detection-integration-trd.md — approved
- **Notes:** Fourth Goal 6 task — covers PRD Flows 3 and 5. Depends on TASK-0017 (shipped) and TASK-0018 (shipped). PR still in draft.

## In Review

_(Developer moves tasks here when the draft PR is marked ready.)_

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
- **PR:** #20
- **Branch:** goals/16-panel-fallback-states
- **TRD:**
- **Notes:** Fourth Goal 5 task — covers PRD Flows 3 and 4. Deps shipped (TASK-0013, TASK-0012). PR #20 is open (not draft).

## Changes Requested

_(Reviewer moves tasks here when a PR needs rework.)_

## TRD Changes Requested

_(TRD Watcher moves tasks here when a TRD needs rework.)_

## Approved

_(Reviewer moves tasks here after approving the PR. You merge to main, then move to Shipped.)_


## Shipped

_(You move tasks here after merging to main.)_

### TASK-0017: Overlay BrowserWindow & Toggle Hotkey
- **Goal:** Goal 6 — Overlay Mode
- **PRD:** research/agents/prds/goal-06-overlay-mode.md
- **PR:** #18
- **Branch:** goals/17-overlay-browser-window
- **TRD:** research/plans/goals/17-overlay-browser-window-trd.md — approved
- **Approved:** 2026-05-10 (Round 2)
- **Merged:** 2026-05-10

### TASK-0019: Overlay Settings UI Section
- **Goal:** Goal 6 — Overlay Mode
- **PRD:** research/agents/prds/goal-06-overlay-mode.md
- **PR:** #17
- **Branch:** goals/19-overlay-settings-ui
- **TRD:** research/plans/goals/19-overlay-settings-ui-trd.md — approved
- **Approved:** 2026-05-10 (Round 2)
- **Merged:** 2026-05-10

### TASK-0012: Shortcut Data IPC Layer & Prefetch
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **PR:** #13
- **Branch:** goals/12-shortcut-ipc-layer
- **TRD:** research/plans/goals/12-shortcut-ipc-layer-trd.md — approved
- **Approved:** 2026-05-10 (Round 1)
- **Merged:** 2026-05-10

### TASK-0014: Reconcile Goal 4 Stubs — process-map.ts & active-window.ts
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **PR:** #12
- **Branch:** goals/14-reconcile-goal4-stubs
- **TRD:** research/plans/goals/14-reconcile-goal4-stubs-trd.md — approved
- **Approved:** 2026-05-10 (Round 2)
- **Merged:** 2026-05-10
- **Notes:** Addresses PROP-0003 and PROP-0004 (process-map.ts and active-window.ts stubs).

### TASK-0018: Overlay Renderer — Compact Shortcut Display
- **Goal:** Goal 6 — Overlay Mode
- **PRD:** research/agents/prds/goal-06-overlay-mode.md
- **PR:** #16
- **Branch:** (unknown — added retroactively)
- **TRD:** (unknown — added retroactively)
- **Merged:** 2026-05-10
- **Notes:** Added retroactively — PR #16 was built and merged outside the normal backlog flow. PM should reconstruct task details and verify TRD exists. No reviewer approval on record.

### TASK-0015: Panel Search/Filter Input
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **PR:** #15
- **Branch:** goals/15-panel-search-filter
- **TRD:** research/plans/goals/15-panel-search-filter-trd.md — approved
- **Approved:** 2026-05-10 (Round 2 — reviewer approved via PR comment; GitHub blocked formal approval since author == reviewer)
- **Merged:** 2026-05-10

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

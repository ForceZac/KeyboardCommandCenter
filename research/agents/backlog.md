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

### TASK-0008: Process-to-App Mapping Table
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **Scope:** Create a static JSON mapping file (e.g. `packages/desktop/src/process-map.json`) that maps process names, executable names, and macOS bundle identifiers to application slugs in the shortcut database. Cover all 50+ apps in the existing seed data. Handle common process name variations per app (e.g. `code` / `Code.exe` / `Code Helper` → `vs-code`; `Photoshop` / `Adobe Photoshop 2024` → `photoshop`). Include a TypeScript module that loads the map and exports a `lookupApp(processName: string, bundleId?: string): string | null` function for use by the detection service. NOT in scope: Rust native module, active window detection, polling service, tray integration, detection settings UI, Linux process names.
- **Acceptance:**
  - JSON mapping file exists with entries for all 50+ seeded apps
  - Each entry maps at least one process name or bundle ID to a database app slug
  - Common aliases and variations are covered (verified against top 10 apps: VS Code, Chrome, Photoshop, Figma, Slack, Terminal, Finder/Explorer, Word, Excel, Spotify)
  - TypeScript `lookupApp()` function returns correct slugs for test inputs and `null` for unrecognized process names
  - File is loadable at runtime by the Electron main process without external dependencies
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Foundational for TASK-0009 and the rest of Goal 4. Does not depend on Goal 3 Electron infrastructure — can be started immediately. App slugs should match existing database entries from seed data.

### TASK-0009: Rust Native Module for Active Window Detection
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **Scope:** Set up a `napi-rs` project within the desktop package to build a native Node module exposing `getActiveWindow(): { processName: string, windowTitle: string, bundleId?: string }`. Implement platform adapters using a strategy pattern: Win32 adapter (`GetForegroundWindow` → `GetWindowThreadProcessId` → process name/exe path) and macOS adapter (`NSWorkspace.shared.frontmostApplication` → bundle ID and process name). Integrate the native module build with the existing Electron Forge webpack pipeline so `npm run make` produces a working binary. Generate TypeScript type definitions for the exported interface. NOT in scope: polling service, IPC to renderer, tray "Recent Apps" submenu, settings toggle, process-to-app mapping (TASK-0008), Linux support, overlay.
- **Acceptance:**
  - `napi-rs` project structure exists and compiles successfully
  - `getActiveWindow()` returns the correct process name for the currently active window on the build platform
  - Function returns window title and bundle ID (macOS) when available
  - Native module `.node` binary is loadable from Electron's main process via `require()`
  - Build integrates with Electron Forge — no manual steps beyond `npm run make`
  - TypeScript type definitions are generated for the native interface
  - Graceful error handling: returns `null` on detection failure, does not crash the Electron process
  - Works on both Windows and macOS (platform-specific code behind adapter interface)
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Depends on Goal 3 infrastructure (TASK-0007 must ship first — Electron app with settings via electron-store). Uses `napi-rs` per PRD recommendation. The native module is consumed by the polling service (future task) and by TASK-0008's mapping layer.

## In Progress

_(Developer moves tasks here. TRD phase first, then build phase after TRD approval.)_

## In Review

_(Developer moves tasks here when the draft PR is marked ready.)_

## Changes Requested

_(Reviewer moves tasks here when a PR needs rework.)_

## TRD Changes Requested

_(TRD Watcher moves tasks here when a TRD needs rework.)_

## Approved

_(Reviewer moves tasks here after approving the PR. You merge to main, then move to Shipped.)_

### TASK-0007: Settings Persistence & Login Startup Registration
- **Goal:** Goal 3 — Desktop App Shell (Electron + Tray)
- **PRD:** research/agents/prds/goal-03-desktop-app-shell.md
- **Scope:** Complete the user-facing Goal 3 PRD items not covered by TASK-0006: (1) Add `electron-store` for local settings persistence — store hotkey binding (Electron accelerator string) and login-startup preference as a JSON file. (2) Wire configurable hotkey into HotkeyManager — Settings window accessible from tray context menu lets user record a new key combo, re-registers the global shortcut on change, and notifies user if the binding is already claimed by another app. (3) Login startup registration via `app.setLoginItemSettings` — enabled by default, toggleable in Settings, persisted via electron-store. (4) Add "Settings" item to tray context menu between "Open" and "Quit". NOT in scope: CI build pipeline (separate task), real shortcut panel content (Goal 5), process detection (Goal 4), overlay (Goal 6), code signing (Goal 9), Linux (Goal 10), auto-update, installer UX.
- **Acceptance:**
  - Tray context menu includes "Settings" option that opens a Settings window
  - Settings window shows current hotkey binding and startup preference
  - User can change the hotkey binding — new binding persists across app restarts
  - App handles hotkey conflicts gracefully (shows notification if binding is taken by another app)
  - App registers for login startup on Windows and macOS via `app.setLoginItemSettings`
  - Startup preference is toggleable in Settings and persisted
  - Settings stored via `electron-store` in a local JSON file
  - All settings survive app restart (kill + relaunch)
- **PR:** #7
- **Branch:** goals/7-settings-persistence
- **TRD:** research/plans/goals/7-settings-persistence-trd.md — approved
- **Approved:** 2026-05-10
- **Notes:** Completes Goal 3 user-facing DoD alongside TASK-0006 (shell, tray, hotkey, panel). Depends on TASK-0006 being shipped first (done). CI build pipeline deferred to a separate task.

### TASK-0005: Per-App Shortcut Pages, Category Browse Pages & Platform Toggle
- **Goal:** Goal 2 — Web Search & Browse Interface
- **PRD:** research/agents/prds/goal-02-web-search-browse.md
- **Scope:** Build the remaining Goal 2 frontend pages in `packages/web/app/`: (1) Per-app shortcut page at `/apps/[slug]` — fetches `GET /api/apps/[slug]`, displays all shortcuts grouped by context/scope, includes in-app search/filter, keyboard key styling (visual key caps), and platform filter toggle (Win/Mac/Linux). (2) Category browse page at `/categories/[slug]` — fetches `GET /api/categories` and `GET /api/apps?category=`, displays grid of apps in the selected category. (3) Persistent platform toggle component — defaults to user's detected OS, persists selection across navigation (localStorage), switches displayed modifier keys (Cmd vs Ctrl). All pages must be dark-mode compatible, mobile-responsive (320px+), and include SEO meta tags. NOT in scope: user accounts, favorites, community submissions, admin panel, SSR of search results, analytics.
- **Acceptance:**
  - `/apps/[slug]` renders all shortcuts for the given app, grouped by context
  - Shortcuts display styled keyboard key caps (visual rendering of key combos)
  - Platform toggle on app page filters shortcuts to selected OS and shows correct modifiers
  - Platform selection persists in localStorage and carries across page navigations
  - In-app search/filter narrows displayed shortcuts client-side in real time
  - `/categories/[slug]` renders a grid of apps in that category with correct counts
  - Category page app tiles link to `/apps/[slug]`
  - Both pages render correctly in dark and light mode
  - Both pages are usable on 320px-wide screens
  - App pages include semantic HTML and meta tags for SEO
- **PR:** #6
- **Branch:** goals/5-per-app-category-pages
- **TRD:** research/plans/goals/5-per-app-category-pages-trd.md — approved
- **Approved:** 2026-05-09

## Shipped

_(You move tasks here after merging to main.)_

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

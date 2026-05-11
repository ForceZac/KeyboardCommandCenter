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

_(Project Manager keeps 2–3 tasks here at all times.)

### TASK-0029: Admin Review Queue UI
- **Goal:** Goal 8 — Community Contributions & Shortcut Submissions
- **PRD:** research/agents/prds/goal-08-community-contributions.md
- **Scope:** Build the admin review queue page at `/admin/review`. Protected route accessible only to users with `isAdmin=true` on User model (from TASK-0027). Display all pending submissions sorted oldest-first. Each submission card shows: type badge (New Shortcut / Correction / App Request), submitter display name, app name, and submitted data fields. For corrections: render a diff view comparing original shortcut values vs proposed values (changed fields highlighted). For server-flagged duplicates: show a warning badge linking to the existing entry. Three actions per submission: Approve (applies submission to shortcuts table via `PATCH /api/admin/submissions/:id`), Edit & Approve (inline editing of submission fields before applying), Reject (with optional reviewer reason text field). After any action, the submission is removed from the visible queue. Paginate if pending count exceeds 100. Page must load in <500ms. NOT in scope: keyboard shortcuts for review actions (v2), batch approve/reject, spam detection, email notifications, contributor notification system, submission API routes (TASK-0027), submission form (TASK-0028).
- **Acceptance:**
  - `/admin/review` route exists and renders the review queue page
  - Non-admin users receive 403 or redirect to home
  - Pending submissions displayed sorted oldest-first
  - Type badge visible on each card (New Shortcut, Correction, App Request)
  - Submitter name and app name shown on each submission card
  - Correction submissions show diff view (original vs proposed, changed fields highlighted)
  - Duplicate warning badge shown when server flagged a duplicate
  - Approve action calls admin API and removes submission from queue
  - Edit & Approve allows inline field modification before applying
  - Reject action includes optional reason text field
  - Pagination renders when pending count exceeds 100
  - Page loads in <500ms
  - No regressions on existing pages
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Unblocked by TASK-0027 merge (PR #27, 2026-05-11). Third Goal 8 task. PRD Flow 4 covers this scope.

### TASK-0031: App Request Form & "No Results" Request Button
- **Goal:** Goal 8 — Community Contributions & Shortcut Submissions
- **PRD:** research/agents/prds/goal-08-community-contributions.md
- **Scope:** Add a "Request this app" button to the no-results page when a user searches for an app not in the database. Build a minimal form: app name (required, text input), website URL (optional, text input), category (optional, dropdown matching existing categories), platform(s) (checkboxes: Windows / macOS / Linux). On submit: create a Submission with type=APP_REQUEST via `POST /api/submissions` (from TASK-0027). Show confirmation message on success. Handle rate limit (429) with user-friendly message. Requires authenticated session — show sign-in prompt for unauthenticated users. NOT in scope: admin handling of app requests (TASK-0029 covers review queue), auto-populating shortcuts for newly approved apps, search improvements, notification on approval/rejection, mobile-optimized form.
- **Acceptance:**
  - "Request this app" button visible on no-results search page
  - Form includes app name (required), website URL, category dropdown, platform checkboxes
  - Submit creates an APP_REQUEST-type Submission via `POST /api/submissions`
  - Confirmation message shown on success
  - Rate limit (429) shows user-friendly error
  - Unauthenticated users see sign-in prompt when clicking request button
  - Form validates required field (app name) before submission
  - No regressions on existing search/browse pages
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Unblocked by TASK-0027 merge (PR #27, 2026-05-11). Fifth Goal 8 task. PRD Flow 3 covers this scope.

### TASK-0032: Contributor Profile Page
- **Goal:** Goal 8 — Community Contributions & Shortcut Submissions
- **PRD:** research/agents/prds/goal-08-community-contributions.md
- **Scope:** Add a public profile page at `/profile/[userId]`. Display: user display name and avatar (from OAuth provider), "Member since" date, contribution stats (total submitted, total accepted, acceptance rate), and a list of accepted contributions (shortcut name, app name, date accepted). Link to the profile from the nav avatar dropdown ("My Profile"). Any user can view any contributor's profile. Query the Submission model for contribution data (filter by submitterId, group by status). NOT in scope: private profile settings, notification system (separate task), reputation/badges/gamification, editable profile fields, submission form (TASK-0028), admin review queue (TASK-0029), email notifications.
- **Acceptance:**
  - `/profile/[userId]` route exists and renders the contributor profile
  - Display name and avatar shown (sourced from OAuth provider data on User model)
  - "Member since" date displayed
  - Contribution stats: total submitted, total accepted, acceptance rate
  - List of accepted contributions with shortcut name, app name, and date accepted
  - Profiles are publicly viewable (no auth required to view)
  - Nav avatar dropdown includes "My Profile" link for authenticated users
  - Page loads in <500ms
  - No regressions on existing pages
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Unblocked by TASK-0027 merge (PR #27, 2026-05-11). Sixth Goal 8 task. PRD Flow 5 covers this scope.

## In Progress

_(Developer moves tasks here. TRD phase first, then build phase after TRD approval.)_

## In Review

_(Developer moves tasks here when the draft PR is marked ready.)_

### TASK-0028: Submission Form UI — New Shortcut & Key Recorder
- **Goal:** Goal 8 — Community Contributions & Shortcut Submissions
- **PRD:** research/agents/prds/goal-08-community-contributions.md
- **Scope:** Add a "Submit a shortcut" button to per-app shortcut pages. Build a submission form (modal or inline) with fields: command name (required, max 100 chars), key combination (required, captured via custom key recorder input), platform (required, dropdown), context/scope (optional), notes (optional). Implement a key recorder component: captures actual keystrokes via `keydown` event listeners, normalizes modifier key names to match database conventions (Ctrl/Cmd, Shift, Alt/Option), displays formatted key combo string. Implement client-side duplicate detection: debounced API call on key combo change checking existing shortcuts for the same app + platform + key combo; show inline warning for exact matches ("This shortcut already exists — did you mean to submit a correction?") and softer hint for fuzzy matches. Form submits via `POST /api/submissions` (from TASK-0027). Show confirmation message on success. Handle rate limit errors (429) with user-friendly message. Requires authenticated session — show sign-in prompt for unauthenticated users. NOT in scope: correction form (separate task), app request form (separate task), admin review queue UI, contributor profile, server-side duplicate detection (TASK-0027), notification system, mobile key recorder.
- **Acceptance:**
  - "Submit a shortcut" button visible on per-app shortcut pages
  - Form includes command name, key combo (recorder), platform, context, and notes fields
  - Key recorder captures actual keystrokes and displays normalized key combo
  - Key recorder handles modifier keys (Ctrl/Cmd, Shift, Alt/Option) correctly
  - Client-side duplicate detection fires on key combo change with <200ms response
  - Exact match warning shows existing shortcut command name
  - Fuzzy match shows softer hint
  - Duplicate warnings do not block submission
  - Successful submission shows confirmation message
  - Rate limit (429) shows user-friendly error
  - Unauthenticated users see sign-in prompt when clicking submit button
  - No regressions on existing per-app shortcut pages
- **PR:** #34
- **Branch:** goals/28-submission-form-ui
- **TRD:** research/plans/goals/28-submission-form-ui-trd.md — approved
- **Notes:** Unblocked by TASK-0027 merge (PR #27, 2026-05-11). Second Goal 8 task. PRD Flows 1 and 6 cover this scope. Review feedback addressed 2026-05-11: ESC handler + E2E test added; TRD deviation documented in PR description.

## Changes Requested

_(Reviewer moves tasks here when a PR needs rework.)_

## TRD Changes Requested

_(TRD Watcher moves tasks here when a TRD needs rework.)_

## Approved

_(Reviewer moves tasks here after approving the PR. You merge to main, then move to Shipped.)_

## Shipped

_(You move tasks here after merging to main.)_

### TASK-0038: Overlay X11 Compatibility — Transparency & Click-Through
- **Goal:** Goal 10 — Linux Support (implementation-roadmap-v2.md § Goal 10)
- **PRD:** research/agents/prds/goal-10-linux-support.md
- **Scope:** Extend the existing overlay window to work correctly on Linux X11 sessions. X11 window type hints, click-through, always-on-top, configurable opacity/position/size. Tray icon absence graceful handling. Wayland degraded overlay behavior.
- **PR:** #33
- **Branch:** goals/38-overlay-x11-compat
- **TRD:** research/plans/goals/38-overlay-x11-compat-trd.md — approved
- **Approved:** 2026-05-11 (Round 1)
- **Merged:** 2026-05-11

### TASK-0037: Wayland Active Window Detection — GNOME & KDE DBus with Manual Fallback
- **Goal:** Goal 10 — Linux Support (implementation-roadmap-v2.md § Goal 10)
- **PR:** #32
- **Branch:** goals/37-wayland-active-window-detection
- **TRD:** research/plans/goals/37-wayland-active-window-detection-trd.md — approved
- **Approved:** 2026-05-11 (Round 1)
- **Merged:** 2026-05-11

### TASK-0036: Rust Native Module — Linux X11 Active Window Detection
- **Goal:** Goal 10 — Linux Support
- **PR:** #31
- **Branch:** goals/36-linux-x11-detection
- **TRD:** research/plans/goals/36-linux-x11-detection-trd.md — approved
- **Approved:** 2026-05-11 (Round 2)
- **Merged:** 2026-05-11

### TASK-0035: GitHub Actions Release Workflow — Build, Sign & Publish
- **Goal:** Goal 9 — Auto-Update & Distribution
- **PR:** #30
- **Branch:** goals/35-github-actions-release-workflow
- **TRD:** research/plans/goals/35-github-actions-release-workflow-trd.md — approved
- **Approved:** 2026-05-11 (Round 2)
- **Merged:** 2026-05-11

### TASK-0034: Landing Page — `/download` Route with OS Detection
- **Goal:** Goal 9 — Auto-Update & Distribution
- **PR:** #29
- **Branch:** goals/34-landing-page-download
- **TRD:** research/plans/goals/34-landing-page-download-trd.md — approved
- **Approved:** 2026-05-11 (Round 1)
- **Merged:** 2026-05-11

### TASK-0033: electron-updater Integration — Auto-Update Check & Notification
- **Goal:** Goal 9 — Auto-Update & Distribution
- **PR:** #28
- **Branch:** goals/33-electron-updater-auto-update
- **TRD:** research/plans/goals/33-electron-updater-auto-update-trd.md — approved
- **Approved:** 2026-05-11 (Round 2)
- **Merged:** 2026-05-11

### TASK-0027: Submission Data Model, Service Layer & API Routes
- **Goal:** Goal 8 — Community Contributions & Shortcut Submissions
- **PR:** #27
- **Branch:** goals/27-submission-data-model-api
- **TRD:** research/plans/goals/27-submission-data-model-api-trd.md — approved
- **Approved:** 2026-05-11 (Round 2)
- **Merged:** 2026-05-11

### TASK-0026: Desktop Panel Favorites View & Favorite Toggle
- **Goal:** Goal 7 — User Accounts & Favorites Sync
- **PRD:** research/agents/prds/goal-07-accounts-favorites.md
- **PR:** #26
- **Branch:** goals/26-desktop-panel-favorites
- **TRD:** research/plans/goals/26-desktop-panel-favorites-trd.md — approved
- **Approved:** 2026-05-11 (Round 3)
- **Merged:** 2026-05-11

### TASK-0025: Desktop Favorites Sync Engine & Offline Cache
- **Goal:** Goal 7 — User Accounts & Favorites Sync
- **PRD:** research/agents/prds/goal-07-accounts-favorites.md
- **PR:** #25
- **Branch:** goals/25-desktop-favorites-sync
- **TRD:** research/plans/goals/25-desktop-favorites-sync-trd.md — approved
- **Approved:** 2026-05-11 (Round 2)
- **Merged:** 2026-05-11

### TASK-0024: Favorites Web UI — Heart Icons, Collections Page & Optimistic Updates
- **Goal:** Goal 7 — User Accounts & Favorites Sync
- **PRD:** research/agents/prds/goal-07-accounts-favorites.md
- **PR:** #24
- **Branch:** goals/24-favorites-web-ui
- **TRD:** research/plans/goals/24-favorites-web-ui-trd.md — approved
- **Approved:** 2026-05-11 (Round 3)
- **Merged:** 2026-05-11

### TASK-0023: Desktop Auth Flow — Browser OAuth & Deep Link Callback
- **Goal:** Goal 7 — User Accounts & Favorites Sync
- **PRD:** research/agents/prds/goal-07-accounts-favorites.md
- **PR:** #23
- **Branch:** goals/23-desktop-auth-flow
- **TRD:** research/plans/goals/23-desktop-auth-flow-trd.md — approved
- **Approved:** 2026-05-11 (Round 1)
- **Merged:** 2026-05-10

### TASK-0022: Favorites Data Model & CRUD API
- **Goal:** Goal 7 — User Accounts & Favorites Sync
- **PRD:** research/agents/prds/goal-07-accounts-favorites.md
- **PR:** #22
- **Branch:** goals/22-favorites-data-model-api
- **TRD:** research/plans/goals/22-favorites-data-model-api-trd.md — approved
- **Approved:** 2026-05-10 (Round 4)
- **Merged:** 2026-05-10

### TASK-0021: Auth Schema & NextAuth Integration
- **Goal:** Goal 7 — User Accounts & Favorites Sync
- **PRD:** research/agents/prds/goal-07-accounts-favorites.md
- **PR:** #21
- **Branch:** goals/21-auth-schema-nextauth
- **TRD:** research/plans/goals/21-auth-schema-nextauth-trd.md — approved
- **Merged:** 2026-05-10

### TASK-0020: Overlay Detection Integration & App-Switch Content Updates
- **Goal:** Goal 6 — Overlay Mode
- **PRD:** research/agents/prds/goal-06-overlay-mode.md
- **PR:** #19
- **Branch:** goals/20-overlay-detection-integration
- **TRD:** research/plans/goals/20-overlay-detection-integration-trd.md — approved
- **Merged:** 2026-05-10

### TASK-0016: Panel Fallback States — No Detection, Unrecognized App, No Shortcuts
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **PR:** #20
- **Branch:** goals/16-panel-fallback-states
- **Merged:** 2026-05-10

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
- **Notes:** Added retroactively — PR #16 was built and merged outside the normal backlog flow.

### TASK-0015: Panel Search/Filter Input
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **PR:** #15
- **Branch:** goals/15-panel-search-filter
- **TRD:** research/plans/goals/15-panel-search-filter-trd.md — approved
- **Approved:** 2026-05-10 (Round 2)
- **Merged:** 2026-05-10

### TASK-0013: Panel Content Renderer & Shortcut Key Caps
- **Goal:** Goal 5 — Shortcut Panel UI (Desktop)
- **PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
- **PR:** #14
- **Branch:** goals/13-panel-content-renderer
- **TRD:** research/plans/goals/13-panel-content-renderer-trd.md — approved
- **Approved:** 2026-05-10 (Round 1)
- **Merged:** 2026-05-10

### TASK-0011: Tray "Recent Apps" Submenu
- **Goal:** Goal 4 — Active Window Process Detection
- **PRD:** research/agents/prds/goal-04-process-detection.md
- **PR:** #11
- **Branch:** goals/11-tray-recent-apps
- **TRD:** research/plans/goals/11-tray-recent-apps-trd.md — approved
- **Approved:** 2026-05-10 (post-hoc)
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
- **Scope:** Retroactively recorded. Electron app with tray icon, global hotkey, and panel window.
- **Acceptance:** (not defined pre-work — retroactive entry)
- **PR:** #4
- **Branch:** goals/6-electron-app-shell
- **TRD:** n/a
- **Merged:** 2026-05-09

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

### TASK-0039: Linux Packaging — AppImage & .deb via electron-builder + CI Job
- **Goal:** Goal 10 — Linux Support (implementation-roadmap-v2.md § Goal 10)
- **PRD:** research/agents/prds/goal-10-linux-support.md
- **Scope:** Add Linux packaging targets to the existing electron-builder configuration. Produce an `.AppImage` (universal, no-install) and `.deb` (Debian/Ubuntu) for x64. Configure the existing GitHub Actions release workflow (from TASK-0035) to include a Linux build job that installs required X11/DBus development libraries (`libx11-dev`, `libxcb1-dev`, `libdbus-1-dev`) and produces Linux artifacts alongside Windows/macOS builds. Declare runtime dependencies in the `.deb` package (`libx11-6`, `libdbus-1-3`, `libappindicator3-1` or `libayatana-appindicator3-1`). Create an XDG autostart `.desktop` file so the app can register itself for login startup on Linux. Ensure tray icon works via `libappindicator3` / `StatusNotifierItem`. NOT in scope: RPM packaging, Flathub/Snap Store listings, ARM64 builds, AppImage auto-update, landing page download page updates (separate task), overlay or detection features (covered by TASK-0036/0037/0038).
- **Acceptance:**
  - electron-builder config produces `.AppImage` and `.deb` files for Linux x64
  - AppImage launches without installation on Ubuntu 22.04+
  - `.deb` installs cleanly via `dpkg -i` on Ubuntu/Debian
  - `.deb` declares correct runtime dependencies (`libx11-6`, `libdbus-1-3`, `libappindicator3-1`)
  - GitHub Actions release workflow builds Linux targets alongside Windows/macOS
  - CI Linux job installs required dev libraries and completes successfully
  - XDG autostart `.desktop` entry created and offered to user on first launch
  - Tray icon appears on GNOME (with libappindicator) and KDE
  - App functions via global hotkey when no system tray is detected
  - No regressions on existing Windows/macOS builds
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Blocked — awaiting PRD. `research/agents/prds/goal-10-linux-support.md` does not exist in the repo; Product Manager must write it before this task can start. Fourth Goal 10 task. Depends on TASK-0035 being merged (done). Independent of TASK-0037 and TASK-0038.

### TASK-0030: Correction Form UI — Suggest Edit & Pre-filled Submission
- **Goal:** Goal 8 — Community Contributions & Shortcut Submissions
- **PRD:** research/agents/prds/goal-08-community-contributions.md
- **Scope:** Add a "Suggest edit" icon button on each shortcut row on per-app shortcut pages. Clicking opens a correction form pre-filled with the existing shortcut's data (command name, key combination via key recorder component from TASK-0028, platform, context/scope). User can edit any field that needs correction. Include an optional "Reason for correction" text area (e.g., "Changed in VS Code 1.96"). On submit: creates a Submission with type=CORRECTION via `POST /api/submissions` (from TASK-0027), linking to the existing shortcut via shortcutId. Show confirmation message on success. Handle rate limit (429) with user-friendly message. Requires authenticated session — show sign-in prompt for unauthenticated users. NOT in scope: admin review of corrections (TASK-0029), diff view rendering (TASK-0029 admin side), key recorder component implementation (TASK-0028 — reused here), app request form, server-side duplicate detection (TASK-0027), notification on approval/rejection, new shortcut submission form (TASK-0028).
- **Acceptance:**
  - "Suggest edit" icon visible on each shortcut row in per-app pages
  - Clicking opens correction form pre-filled with current shortcut data
  - Key recorder component (from TASK-0028) works for editing key combination
  - Optional "Reason for correction" text area present
  - Submit creates a CORRECTION-type Submission via `POST /api/submissions` with shortcutId
  - Confirmation message shown on success
  - Rate limit (429) shows user-friendly error
  - Unauthenticated users see sign-in prompt
  - No regressions on existing per-app shortcut pages
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Blocked — awaiting TASK-0028 (needs key recorder component and submission form patterns). Fourth Goal 8 task. PRD Flow 2 covers this scope.

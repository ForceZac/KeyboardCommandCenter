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

_(Empty — TASK-0021 moved to In Progress; TASK-0022 moved to Blocked pending TASK-0021)_

## In Progress

_(Developer moves tasks here. TRD phase first, then build phase after TRD approval.)_

### TASK-0021: Auth Schema & NextAuth Integration
- **Goal:** Goal 7 — User Accounts & Favorites Sync
- **PRD:** research/agents/prds/goal-07-accounts-favorites.md
- **Scope:** Add NextAuth.js (Auth.js v5) to the Next.js web app with GitHub and Google OAuth providers. Add a `User` model to the Prisma schema with id, email, name, image, and provider fields (Auth.js standard tables: User, Account, Session, VerificationToken). Wire up NextAuth session handling (JWT strategy). Protect API routes that will require auth (favorites, submissions). Add sign-in/sign-out UI to the web app header. NOT in scope: favorites data model or CRUD (separate task), community submissions (Goal 8), Electron deep-link auth (separate task), email/password auth.
- **Acceptance:**
  - NextAuth configured with GitHub + Google providers
  - User model added to Prisma schema, migration generated
  - Session available server-side via `auth()` and client-side via `useSession()`
  - Sign-in / sign-out buttons in web app header
  - Protected API route middleware scaffold in place
  - No regressions on existing public pages
- **PR:** #21
- **Branch:** goals/21-auth-schema-nextauth
- **TRD:** research/plans/goals/21-auth-schema-nextauth-trd.md — awaiting-review
- **Notes:** PRD exists (written 2026-05-10). Branch and draft PR already open. Previous TRD was out of scope (included credentials provider and favorites/collection schema) — corrected TRD written 2026-05-10. Reviewer: check TRD stays within scope (OAuth-only, User+Auth.js tables only, no Favorite/Collection).

## In Review

_(Developer moves tasks here when the draft PR is marked ready.)_

_(Empty)_

## Changes Requested

_(Reviewer moves tasks here when a PR needs rework.)_

## TRD Changes Requested

_(TRD Watcher moves tasks here when a TRD needs rework.)_

## Approved

_(Reviewer moves tasks here after approving the PR. You merge to main, then move to Shipped.)_

## Shipped

_(You move tasks here after merging to main.)_

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

### TASK-0022: Favorites Data Model & CRUD API
- **Goal:** Goal 7 — User Accounts & Favorites Sync
- **PRD:** research/agents/prds/goal-07-accounts-favorites.md
- **Scope:** Add Collection and CollectionShortcut models to the Prisma schema (Collection: id, userId, name, description, isDefault, createdAt, updatedAt; CollectionShortcut: join table linking userId + collectionId + shortcutId with createdAt timestamp for last-write-wins sync). Generate migration. Implement API routes: `GET/POST/DELETE /api/favorites` (add/remove a shortcut from the user's default "My Favorites" collection), `GET/POST/PATCH/DELETE /api/collections` (CRUD for named collections), `GET /api/collections/:id/shortcuts` (list shortcuts in a collection). Auto-create a "My Favorites" default collection when a new User record is created (via Prisma middleware or Auth.js event callback). Enforce server-side limits: max 50 collections per user, max 1000 total favorites per user. All routes require authenticated session. NOT in scope: web UI components (separate task), desktop client or sync engine (separate task), desktop auth flow (separate task), collection reordering, import/export, guest favorites migration.
- **Acceptance:**
  - Collection and CollectionShortcut models added to Prisma schema with proper relations
  - Migration generated and applies cleanly
  - "My Favorites" default collection auto-created on new user sign-up
  - `POST /api/favorites` adds a shortcut to the user's default collection (returns 201)
  - `DELETE /api/favorites/:shortcutId` removes a favorite (returns 204)
  - `GET /api/favorites` returns the user's favorited shortcuts with collection info
  - `POST /api/collections` creates a named collection (returns 201)
  - `PATCH /api/collections/:id` renames or updates description (returns 200)
  - `DELETE /api/collections/:id` deletes a collection (returns 204; cannot delete default)
  - `GET /api/collections/:id/shortcuts` returns shortcuts in a specific collection
  - Server returns 403 if user exceeds 50 collections or 1000 favorites
  - All routes return 401 for unauthenticated requests
  - All routes return <200ms under normal load
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Blocked — awaiting TASK-0021 (auth schema + User model must be in place for user relations). Second Goal 7 task.

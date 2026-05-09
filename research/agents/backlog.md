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


### TASK-0004: Homepage & Global Search UI
- **Goal:** Goal 2 — Web Search & Browse Interface
- **PRD:** research/agents/prds/goal-02-web-search-browse.md
- **Scope:** Build the Next.js homepage in `packages/web/app/`: prominent search bar with debounced full-text search hitting `GET /api/shortcuts/search`, inline search result previews (shortcut command, key combo, app name, platform badges) with "View all shortcuts for [App]" links, category grid linking to category browse pages. Include dark mode (default) with light mode toggle, mobile-responsive layout (320px+), and SEO meta tags. NOT in scope: per-app shortcut pages, category listing pages, platform toggle, in-app shortcut filtering, user accounts, admin panel.
- **Acceptance:**
  - Homepage renders with search bar and category grid
  - Typing in search bar triggers debounced API call and displays inline results
  - Search results show command description, key combo, app name, and platform badges
  - Each result links to the app's shortcut page (route exists even if page is built in a later task)
  - Category tiles link to `/categories/[slug]` routes
  - Dark mode renders by default; light mode toggle switches theme
  - Layout is usable on 320px-wide screens
  - Homepage LCP <1.5s on local dev server
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Depends on TASK-0003 (API routes must exist for search to function). Second frontend task for Goal 2. Per-app pages and category pages will be a separate task.

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
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Depends on TASK-0003 (API routes) and TASK-0004 (shared layout, theme toggle, search bar). Final frontend task for Goal 2 — completing this task finishes the Goal 2 definition of done.


## In Progress

_(Developer moves tasks here. TRD phase first, then build phase after TRD approval.)_

## In Review

_(Developer moves tasks here when the draft PR is marked ready.)_

### TASK-0003: API Routes for Shortcut Data
- **Goal:** Goal 2 — Web Search & Browse Interface
- **PRD:** research/agents/prds/goal-02-web-search-browse.md
- **Scope:** Build the four Next.js API route handlers in `packages/web/app/api/`: `GET /api/shortcuts/search?q=&platform=` (full-text search with Prisma, debounce-friendly), `GET /api/apps` (list all apps, filterable by category), `GET /api/apps/[slug]` (single app with all shortcuts grouped by context), `GET /api/categories` (list categories with app counts). Use shared types from `packages/core`. All endpoints are public read-only — no auth. NOT in scope: frontend UI, SSR, pagination, rate limiting, admin endpoints, Express migration.
- **Acceptance:**
  - All four API routes return correct JSON responses against the seeded database
  - `GET /api/shortcuts/search?q=undo` returns matching shortcuts across apps in <200ms
  - `GET /api/apps` supports optional `?category=` filter parameter
  - `GET /api/apps/[slug]` returns shortcuts grouped by context/scope
  - `GET /api/categories` returns category names with app counts
  - Responses use shared TypeScript types from `packages/core`
  - API routes have basic error handling (400 for bad params, 404 for unknown slug)
- **PR:** #3
- **Branch:** goals/3-api-routes
- **TRD:** research/plans/goals/3-api-routes-trd.md — approved
- **Notes:** Depends on Goal 1 completion (TASK-0001 + TASK-0002). First task for Goal 2 — establishes the data-access layer the frontend will consume. tsc clean, ESLint clean. Integration tests written; need real DB (Docker Compose) to run. PR #3 open and ready for review.

## Changes Requested

_(Reviewer moves tasks here when a PR needs rework.)_

## TRD Changes Requested

_(TRD Watcher moves tasks here when a TRD needs rework.)_

## Approved

_(Reviewer moves tasks here after approving the PR. You merge to main, then move to Shipped.)_

### TASK-0002: Seed Script & Data for 50+ Applications
- **Goal:** Goal 1 — Shortcut Data Schema & Seed Database
- **PRD:** research/agents/prds/goal-01-shortcut-data-schema.md
- **PR:** #2
- **Branch:** goals/2-seed-script
- **TRD:** research/plans/goals/2-seed-script-trd.md — approved
- **Notes:** Static checks passed. Integration tests deferred — run `docker compose up -d` + `npm test -w database` when ready.

### TASK-0001: Define Prisma Schema for Shortcut Database
- **Goal:** Goal 1 — Shortcut Data Schema & Seed Database
- **PRD:** research/agents/prds/goal-01-shortcut-data-schema.md
- **Scope:** Design and implement the Prisma schema with Application, Shortcut, Category, and Platform models and their relationships. Includes modifier key normalization (Ctrl/Cmd, Alt/Option, Shift, Super/Win), chord support for multi-step shortcuts (e.g. Ctrl+K → Ctrl+C), context/scope field (Global, Editor, Terminal, etc.), and category taxonomy (Creative, Developer Tools, Productivity, Gaming, Communication, System). Store both `keyCombo` display string and structured `modifiers[]` + `key` fields per PRD recommendation. Export TypeScript types from `packages/core` for shared use. NOT in scope: seed data/script, full-text search index, web UI, API endpoints.
- **Acceptance:**
  - Prisma schema compiles and migrates cleanly on a fresh PostgreSQL instance
  - Models include Application, Shortcut, Category, Platform with correct relations
  - Each shortcut supports multi-platform key combos (Win/Mac/Linux)
  - Chord/multi-step shortcuts representable in the schema
  - Context/scope field supports per-app scopes (e.g. "Normal Mode", "Editor", "Terminal")
  - Category taxonomy covers at least: Creative, Developer Tools, Productivity, Gaming, Music, System, Browsers
  - TypeScript types exported from `packages/core`
- **PR:** #1
- **Branch:** goals/1-prisma-schema
- **TRD:** research/plans/goals/1-prisma-schema-trd.md — approved
- **Notes:** Foundation task — nothing else can proceed until this ships. See PRD open questions for schema design decisions (structured vs string key combos, modal shortcut handling).

## Shipped

_(You move tasks here after merging to main.)_

### TASK-0001: Define Prisma Schema for Shortcut Database
- **Goal:** Goal 1 — Shortcut Data Schema & Seed Database
- **PRD:** research/agents/prds/goal-01-shortcut-data-schema.md
- **PR:** #1
- **Branch:** goals/1-prisma-schema
- **TRD:** research/plans/goals/1-prisma-schema-trd.md — approved
- **Merged:** 2026-05-09

## Blocked

_(Waiting on an external dependency, a missing PRD, or owner decision.)_

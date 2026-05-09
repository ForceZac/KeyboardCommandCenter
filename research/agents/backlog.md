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


### TASK-0004: Homepage with Search Bar & Category Grid
- **Goal:** Goal 2 — Web Search & Browse Interface
- **PRD:** research/agents/prds/goal-02-web-search-browse.md
- **Scope:** Build the homepage in `packages/web/app/page.tsx`: prominent search bar with debounced full-text search (calls `GET /api/shortcuts/search`), search results displayed inline with shortcut command, key combo, app name, and platform badges, and a category grid below the search bar linking to `/categories/[slug]`. Include dark mode (default) with light mode toggle persisted in localStorage. Mobile-responsive layout down to 320px. NOT in scope: category listing pages, per-app shortcut pages, platform toggle, SEO meta tags, Vercel deployment, analytics.
- **Acceptance:**
  - Homepage renders search bar and category grid
  - Typing in search bar triggers debounced API call and displays results inline
  - Each search result shows command description, key combo, app name, platform badges
  - Category tiles link to `/categories/[slug]`
  - Dark/light mode toggle works and persists across page loads
  - Layout is responsive and usable at 320px width
  - No layout shift on search result updates
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Depends on TASK-0003 (API routes must exist). Second frontend task for Goal 2.

### TASK-0005: Category Browse & App Shortcut Pages
- **Goal:** Goal 2 — Web Search & Browse Interface
- **PRD:** research/agents/prds/goal-02-web-search-browse.md
- **Scope:** Build two page types: (1) Category page at `/categories/[slug]` showing a grid of apps in that category (data from `GET /api/apps?category=`), and (2) App shortcut page at `/apps/[slug]` showing all shortcuts for one app grouped by context/scope with a platform toggle (Win/Mac/Linux) that filters key combos and an in-app search/filter. Shortcuts displayed with visual key cap styling. Platform toggle defaults to detected OS and persists across navigation. SEO meta tags on all pages. NOT in scope: homepage, global search, user accounts, favorites, admin panel, community submissions.
- **Acceptance:**
  - `/categories/[slug]` renders app grid for the given category
  - `/apps/[slug]` renders all shortcuts grouped by context/scope
  - Platform toggle switches displayed key combos between Win/Mac/Linux
  - Platform toggle defaults to user's OS and persists
  - In-app search filters shortcuts within the current app
  - Key combos styled as visual key caps (keyboard key appearance)
  - Pages have appropriate SEO meta tags (title, description)
  - Both pages are mobile-responsive
- **PR:**
- **Branch:**
- **TRD:**
- **Notes:** Depends on TASK-0003 (API routes) and TASK-0004 (shared layout/theme). Final frontend task for Goal 2.

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
- **Notes:** Depends on Goal 1 completion (TASK-0001 + TASK-0002). First task for Goal 2 — establishes the data-access layer the frontend will consume. tsc clean, ESLint clean. Integration tests written; need real DB (Docker Compose) to run — same infrastructure gap as TASK-0002.

## Pending Human

_(Reviewer found no code issues but needs human action before approval can proceed.)_

### TASK-0002: Seed Script & Data for 50+ Applications
- **Goal:** Goal 1 — Shortcut Data Schema & Seed Database
- **PRD:** research/agents/prds/goal-01-shortcut-data-schema.md
- **Scope:** Create static JSON seed files in `database/seeds/` for 50+ popular applications across all categories defined in the PRD (Creative, Developer, Productivity, Gaming, Music, System, Browsers). Build a TypeScript seed script that reads these files and populates the database via Prisma. Add full-text search index on command descriptions and app names. NOT in scope: web UI, API endpoints, community submissions, desktop app integration.
- **Acceptance:**
  - Seed script completes without errors on a fresh database with the TASK-0001 schema
  - 50+ applications seeded across all PRD-specified categories
  - Each application has at least 10 verified shortcuts
  - Full-text search index exists on command descriptions and app names
  - Full-text search query returns results in <100ms on seeded data
  - Seed files are static JSON, versionable, and reviewable
- **PR:** #2
- **Branch:** goals/2-seed-script
- **TRD:** research/plans/goals/2-seed-script-trd.md — approved
- **Notes:** Reviewer static check passed (2026-05-09). No code issues found. Blocked on test execution: reviewer environment lacks Docker/PostgreSQL. Zach: run `docker compose up -d && DATABASE_URL=... npx prisma migrate deploy -w database && DATABASE_URL=... npm test -w database`. If tests pass, PR is ready to merge.

## Changes Requested

_(Reviewer moves tasks here when a PR needs rework.)_

## TRD Changes Requested

_(TRD Watcher moves tasks here when a TRD needs rework.)_

## Approved

_(Reviewer moves tasks here after approving the PR. You merge to main, then move to Shipped.)_

## Shipped

_(You move tasks here after merging to main.)_

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
- **Notes:** Foundation task — shipped 2026-05-09. PR #1 merged to main.

## Blocked

_(Waiting on an external dependency, a missing PRD, or owner decision.)_

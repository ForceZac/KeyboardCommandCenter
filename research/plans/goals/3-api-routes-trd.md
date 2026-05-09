# TRD: API Routes for Shortcut Data

**Task:** TASK-0003
**Branch:** goals/3-api-routes
**PRD:** research/agents/prds/goal-02-web-search-browse.md
**Date:** 2026-05-09

---

## What we're building

The data-access layer for the Goal 2 web interface: four read-only Next.js API Route Handlers that expose the Prisma database to the frontend. This task gives the frontend (TASK-0004, TASK-0005) stable, typed endpoints to query shortcuts, apps, and categories — and proves the PRD's <200ms search requirement is achievable before any UI work begins.

## Technical components needed

**New backend components:**
- `packages/web/lib/prisma.ts` — Prisma client singleton. Next.js hot-reload safe (uses `globalThis` cache in development). The web package imports `@prisma/client` via `@kcc/database`; this file is the single instantiation point so there is no connection-pool leak.
- `packages/web/services/ShortcutService.ts` — owns the full-text search query. Uses Prisma `$queryRaw` with PostgreSQL `to_tsvector`/`to_tsquery` to hit the GIN index seeded in TASK-0002. Returns a flat list of search hits including app name and platform key combos.
- `packages/web/services/AppService.ts` — owns the app-list and app-detail queries. `listApps` accepts an optional category slug filter. `getApp` fetches a single app with its full shortcut tree (shortcuts → bindings → steps) and groups shortcuts by context/scope in the service layer before returning.
- `packages/web/services/CategoryService.ts` — owns the category-list query with `_count` aggregation for app counts per category. Stateless; one Prisma call.

**New API route handlers (all in `packages/web/app/api/`):**
- `shortcuts/search/route.ts` — `GET /api/shortcuts/search?q=&platform=`: validates that `q` is present and non-empty (400 otherwise), passes to `ShortcutService.search`, returns JSON array. Optional `platform` param filters results to a specific OS.
- `apps/route.ts` — `GET /api/apps?category=`: reads optional `category` query param, passes to `AppService.listApps`, returns JSON array.
- `apps/[slug]/route.ts` — `GET /api/apps/[slug]`: calls `AppService.getApp`, returns 404 JSON if slug not found, else full `AppDetail` JSON.
- `categories/route.ts` — `GET /api/categories`: calls `CategoryService.listCategories`, returns JSON array. No params.

**Modified backend components:**
- `packages/web/package.json` — adds `@kcc/database` as a workspace dependency so the web package can instantiate the Prisma client. No new external packages — `@prisma/client` is already a `@kcc/database` dependency.

**New `packages/core` exports:**
- `SearchResult` — response type for `/api/shortcuts/search` hits: `{ id, command, context, appName, appSlug, platforms: { platformSlug, keyCombo, steps }[] }`
- `AppSummary` — response type for `/api/apps` list items: `{ id, name, slug, description, categorySlug }`
- `AppDetail` — response type for `/api/apps/[slug]`: extends `AppSummary` with `contexts: Record<string, ShortcutEntry[]>` where each entry holds the shortcut's command, id, and platform bindings
- `CategorySummary` — response type for `/api/categories`: `{ id, name, slug, appCount }`
- These types are added to `packages/core/src/types.ts` and exported from `packages/core/src/index.ts`

**Schema changes:**
- No schema changes — this task reads the schema defined in TASK-0001 as-is.

**API changes:**
- `GET /api/shortcuts/search?q=<query>&platform=<slug>` — new endpoint; full-text search across shortcut commands and app names
- `GET /api/apps?category=<slug>` — new endpoint; list all apps with optional category filter
- `GET /api/apps/[slug]` — new endpoint; single app with shortcuts grouped by context
- `GET /api/categories` — new endpoint; all categories with app count

## Key architectural decisions

- **Next.js App Router Route Handlers, not Express** — the PRD explicitly recommends Next.js API routes for the read-only data tier. Simpler deployment, no extra server process. The PRD notes Express migration is on the table only if WebSocket support is needed later — out of scope here.

- **Services own all Prisma queries** — per backend standards, no Prisma calls in route handlers. Route handlers validate input, call the relevant service, and return the response. This makes services independently testable and keeps routes thin.

- **Full-text search via `$queryRaw`** — `to_tsvector`/`to_tsquery` with the GIN index from TASK-0002 is the only way to meet the <200ms PRD requirement at scale. Prisma's `contains` filter is used as a fallback in local dev without the GIN index. The raw query is isolated in `ShortcutService` so the rest of the codebase stays ORM-clean.

- **Grouping by context in the service layer** — `/api/apps/[slug]` returns shortcuts grouped by context. This grouping is done in TypeScript after a single Prisma query (not in SQL), keeping the query simple and avoiding a complex SQL `GROUP BY` across the nested relation tree.

- **API response types live in `packages/core`** — `SearchResult`, `AppSummary`, `AppDetail`, and `CategorySummary` are added to `@kcc/core` so the frontend, desktop, and overlay packages can import them without a circular dependency. They are plain TS interfaces, no Prisma types.

- **No auth, no rate limiting** — these are public read-only endpoints per the PRD. Auth and rate limiting are explicitly out of scope for Goal 2.

## Test coverage plan

- **Vitest integration tests** (hit real test database via Docker Compose postgres):
  - `shortcuts/search`: happy path with seeded query (`undo`, `save`), platform filter, empty-`q` returns 400, blank string returns 400
  - `apps`: returns all apps when no category filter; filters correctly by category slug; unknown category slug returns empty array (not 404)
  - `apps/[slug]`: known slug returns correctly structured `AppDetail` with grouped contexts; unknown slug returns 404 JSON
  - `categories`: returns all 7 categories with correct app counts matching seed data
- **TypeScript compilation:** `tsc --noEmit` across `packages/web` and `packages/core`
- **Lint:** `npm run lint` in `packages/web`

No Playwright E2E tests in this task — the routes are tested directly via Vitest. E2E tests for the search flow belong in TASK-0004 (frontend UI).

## Out of scope (technical)

- Frontend components, pages, or hooks — TASK-0004 and TASK-0005
- Pagination — PRD explicitly defers this; even the most shortcut-heavy apps have <500 shortcuts
- Rate limiting or API authentication — PRD out of scope for Goal 2
- Admin endpoints — PRD out of scope
- Caching layer (Redis, CDN) — no budget during dev phase; Next.js response caching is sufficient
- `POST`/`PUT`/`DELETE` routes — read-only tier for Goal 2

## Risks and open questions

- **`@kcc/database` dependency in web:** adding `@kcc/database` to `packages/web` introduces the Prisma client into the web bundle. This is expected — Next.js API routes run server-side only. Confirm the Prisma client is not accidentally imported in client components (use `"use server"` or keep Prisma imports outside client component files).
- **GIN index availability in test env:** the GIN full-text index is created by the TASK-0002 seed migration. The test suite depends on TASK-0002's migration running before tests execute. The Vitest setup hook must run `prisma migrate deploy` and the seed script against the test database.
- **`$queryRaw` and SQL injection:** the search query string will be passed to `to_tsquery`. Prisma's `$queryRaw` template literal uses parameterized queries, preventing injection — but this must be verified that no string interpolation is used.

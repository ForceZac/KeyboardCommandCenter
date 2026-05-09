# Plan: TASK-0003 — API Routes for Shortcut Data

**Branch:** goals/3-api-routes
**Task:** TASK-0003
**PRD:** research/agents/prds/goal-02-web-search-browse.md

---

## Work breakdown

### Phase 1: Package wiring
- Add `@kcc/database` as a dependency in `packages/web/package.json`
- Run `npm install` from repo root to link the workspace package
- Create `packages/web/lib/prisma.ts` — Prisma client singleton with Next.js hot-reload safe pattern (`globalThis` cache)

### Phase 2: API response types
- Add API-specific response types to `packages/core/src/types.ts`:
  - `SearchResult` — flattened shortcut hit for search responses (shortcut id, command, context, keyCombo per platform, app name/slug)
  - `AppSummary` — app list item (id, name, slug, description, category slug)
  - `AppDetail` — full app + shortcuts grouped by context (extends AppSummary, adds `contexts` map)
  - `CategorySummary` — category list item (id, name, slug, appCount)
- Export new types from `packages/core/src/index.ts`

### Phase 3: Service layer
- Create `packages/web/services/ShortcutService.ts`
  - `search(query: string, platform?: string): Promise<SearchResult[]>` — full-text search via `$queryRaw` PostgreSQL `to_tsvector`/`to_tsquery`, fallback to `contains` for dev without FTS index
- Create `packages/web/services/AppService.ts`
  - `listApps(category?: string): Promise<AppSummary[]>` — list all apps, optional category filter via slug
  - `getApp(slug: string): Promise<AppDetail | null>` — single app with shortcuts grouped by context, each with bindings per platform
- Create `packages/web/services/CategoryService.ts`
  - `listCategories(): Promise<CategorySummary[]>` — all categories with app count

### Phase 4: Route handlers
- `packages/web/app/api/shortcuts/search/route.ts` — `GET` handler: validates `q` param (400 if missing or empty), calls `ShortcutService.search`, returns JSON
- `packages/web/app/api/apps/route.ts` — `GET` handler: reads optional `?category=` param, calls `AppService.listApps`, returns JSON
- `packages/web/app/api/apps/[slug]/route.ts` — `GET` handler: calls `AppService.getApp`, returns 404 if null, else JSON
- `packages/web/app/api/categories/route.ts` — `GET` handler: calls `CategoryService.listCategories`, returns JSON

### Phase 5: Tests
- Create `packages/web/src/__tests__/api/` directory (or co-locate with routes)
- Vitest integration tests for each route:
  - `shortcuts-search.test.ts` — happy path with seeded data, empty-query 400, platform filter
  - `apps.test.ts` — list all, filter by category, unknown category returns empty array
  - `apps-slug.test.ts` — known slug returns grouped shortcuts, unknown slug returns 404
  - `categories.test.ts` — returns all categories with correct app counts
- Tests hit the real test database (Docker Compose); seed via Prisma fixtures before each suite

### Phase 6: Wrap-up
- Run `tsc --noEmit` across all packages
- Run `npm run lint`
- Run Vitest suite; all tests green
- Push final commit with `FINAL:` prefix
- Mark PR ready, strip WIP from title
- Move task to In Review in backlog.md

---

## What is NOT in this plan
- Frontend UI components (TASK-0004)
- Per-app shortcut pages (TASK-0005)
- Pagination (PRD explicitly out of scope for initial Goal 2)
- Rate limiting or authentication (PRD out of scope — public read-only)
- Admin endpoints (PRD out of scope)
- Express migration (PRD out of scope)

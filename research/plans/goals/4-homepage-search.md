# Plan: TASK-0004 — Homepage with Search Bar & Category Grid

**Branch:** goals/4-homepage-search
**Task:** TASK-0004
**PRD:** research/agents/prds/goal-02-web-search-browse.md

---

## Work breakdown

### Phase 1: Next.js app scaffold
- Create `packages/web/app/layout.tsx` — root layout with `<html>` tag, ThemeProvider wrapper, Inter font
- Create `packages/web/app/globals.css` — Tailwind base/components/utilities imports, CSS variables for theme tokens
- Create `packages/web/tailwind.config.ts` — `darkMode: 'class'`, content paths, color tokens
- Create `packages/web/postcss.config.js` — Tailwind + autoprefixer
- Create `packages/web/next.config.js` (or update existing) — no special config needed beyond default
- Update `packages/web/package.json` — add dependencies: `@tanstack/react-query`, `next-themes`, `clsx`, `tailwindcss`, `autoprefixer`, `postcss`; also add shadcn peer deps (`@radix-ui/react-slot`, `class-variance-authority`, `lucide-react`)
- Run `npm install` from repo root

### Phase 2: API client and types
- Create `packages/web/lib/api.ts` — typed fetch wrapper for each endpoint:
  - `searchShortcuts(q: string, platform?: string): Promise<SearchResult[]>`
  - `fetchCategories(): Promise<CategorySummary[]>`
  - Uses `SearchResult` and `CategorySummary` types from `@kcc/core`

### Phase 3: TanStack Query provider
- Create `packages/web/app/providers.tsx` — `'use client'` component wrapping `QueryClientProvider`; `QueryClient` instantiated with `staleTime: 60_000` for categories (rarely change)

### Phase 4: Theme system
- Create `packages/web/components/ThemeToggle.tsx` — `'use client'` button that reads/writes `next-themes` `theme`; persisted automatically by `next-themes` in localStorage; shows sun icon in dark mode, moon icon in light mode (lucide-react icons)
- `next-themes` `ThemeProvider` lives in `app/providers.tsx` alongside QueryClientProvider; `attribute="class"` so Tailwind `dark:` variants work

### Phase 5: Atom components
- Create `packages/web/components/PlatformBadge.tsx` — small colored pill showing platform slug ("Win", "Mac", "Linux")
- Create `packages/web/components/ShortcutCard.tsx` — one search result row: command description, key combo string, app name, platform badges; links app name to `/apps/[slug]` for future navigation

### Phase 6: Custom hooks
- Create `packages/web/hooks/useSearch.ts` — TanStack Query wrapping `api.searchShortcuts`; enabled only when `q.length >= 2`; key: `['search', q]`; debounced query via controlled input state with `useDebounce` or inline timeout in the component
- Create `packages/web/hooks/useCategories.ts` — TanStack Query wrapping `api.fetchCategories`; `staleTime: 5 * 60_000` (categories static)

### Phase 7: Page components
- Create `packages/web/components/SearchBar.tsx` — `'use client'` input with debounce (300ms); controlled; calls `onQueryChange` prop; shows loading spinner when fetching; clears results on empty
- Create `packages/web/components/SearchResults.tsx` — `'use client'`; renders list of `ShortcutCard` or "no results" message; hidden when query is empty
- Create `packages/web/components/CategoryGrid.tsx` — renders 2–4 column responsive grid of category tiles; each tile is a Next.js `<Link href="/categories/[slug]">` with category name and app count
- Create `packages/web/app/page.tsx` — homepage; fetches categories server-side via `fetch` pointing to `/api/categories` (or uses inline Prisma if route not ready); renders `<SearchBar>` + `<SearchResults>` + `<CategoryGrid categories={...} />`

### Phase 8: Playwright E2E tests
- Create `packages/web/e2e/homepage.spec.ts`:
  - Renders search bar and category grid
  - Typing ≥2 chars triggers debounced search and results appear
  - Each result shows command, key combo, app name, platform badges
  - Clearing search hides results
  - Dark/light toggle switches visible theme
  - Category tiles link to `/categories/[slug]`
  - Layout usable at 320px viewport width (no overflow)
- Create `packages/web/playwright.config.ts` — baseURL pointing to local dev server

### Phase 9: Wrap-up
- Run `npx tsc --noEmit` across packages
- Run `npm run lint`
- Run Playwright E2E tests
- Commit with `FINAL:` prefix
- Mark PR ready, strip WIP from title
- Move task to In Review in backlog.md

---

## What is NOT in this plan
- Category browse pages at `/categories/[slug]` (TASK-0005)
- Per-app shortcut pages at `/apps/[slug]` (TASK-0005)
- Platform toggle on the homepage (TASK-0005)
- SEO meta tags (TASK-0005)
- Vercel deployment
- Analytics

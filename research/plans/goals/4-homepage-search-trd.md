# TRD: Homepage with Search Bar & Category Grid

**Task:** TASK-0004
**Branch:** goals/4-homepage-search
**PRD:** research/agents/prds/goal-02-web-search-browse.md
**Date:** 2026-05-09

---

## What we're building

The homepage is the primary entry point for the Keyboard Command Center web app. We need a Next.js 14 App Router page in `packages/web` that presents two discovery surfaces side-by-side: a prominently-placed search bar (debounced, calling `GET /api/shortcuts/search`) whose results render inline, and a category grid below it linking to future browse pages. A dark/light mode toggle persisted in localStorage gives power users (who default to dark) control over the theme. The page must render correctly down to 320px width with zero layout shift on search updates — as required by the PRD success metrics.

This task is purely frontend. All API routes it calls were built in TASK-0003. This task does not modify Prisma, service classes, or route handlers.

---

## Technical components needed

**New frontend components:**
- `app/layout.tsx` — Root layout wrapping `Providers`, setting `<html>` dark class default, loading Inter font
- `app/globals.css` — Tailwind base layers + CSS custom property tokens for theme colors
- `app/providers.tsx` — Client component combining `ThemeProvider` (next-themes) and `QueryClientProvider` (TanStack Query); single mount point so both providers wrap the whole app
- `app/page.tsx` — Homepage: fetches categories server-side (one fewer network waterfall on initial load), renders `<SearchBar>`, `<SearchResults>`, `<CategoryGrid>`. Categories passed as props to client components.
- `components/ThemeToggle.tsx` — Client component reading/writing `next-themes` theme; localStorage persistence is handled by next-themes automatically; sun/moon icon via lucide-react
- `components/PlatformBadge.tsx` — Atom: colored pill label showing "Win", "Mac", or "Linux"; color-coded per platform for quick scanning
- `components/ShortcutCard.tsx` — Molecule: one search result row displaying command description, formatted key combo string, app name linked to `/apps/[slug]`, and platform badges
- `components/SearchBar.tsx` — Client component: controlled input with 300ms debounce via local timeout ref; shows loading indicator when TanStack Query is fetching; exposes controlled `query` state to parent
- `components/SearchResults.tsx` — Client component: renders list of `ShortcutCard` when query is active and results exist; "No results" state; hidden entirely when query is empty (no layout shift)
- `components/CategoryGrid.tsx` — Server-renderable grid of Next.js `<Link>` tiles, each showing category name and app count; 2-col mobile, 4-col desktop via Tailwind responsive grid

**New hooks:**
- `hooks/useSearch.ts` — TanStack Query hook wrapping `lib/api.searchShortcuts`; enabled only when `q.trim().length >= 2`; cache key `['search', q]`; keeps previous results visible during re-fetch to avoid flicker
- `hooks/useCategories.ts` — TanStack Query hook wrapping `lib/api.fetchCategories`; `staleTime: 5 minutes` (categories are static seed data)

**New lib modules:**
- `lib/api.ts` — Centralized typed fetch wrapper for the two endpoints this task touches: `searchShortcuts(q, platform?)` and `fetchCategories()`; throws on non-2xx; types imported from `@kcc/core`

**Modified packages/web infrastructure:**
- `package.json` — Add runtime deps: `@tanstack/react-query`, `next-themes`, `clsx`, `lucide-react`, `tailwindcss`, `postcss`, `autoprefixer`, `@radix-ui/react-slot`, `class-variance-authority`
- `tailwind.config.ts` — `darkMode: 'class'`; content paths covering `app/**` and `components/**`; theme color tokens
- `postcss.config.js` — Tailwind + autoprefixer pipeline
- `next.config.js` — Existing file; no changes needed beyond what TASK-0003 left

**Schema changes:** No schema changes.

**API changes:** No new endpoints. This task consumes two existing endpoints built in TASK-0003:
- `GET /api/shortcuts/search?q=<query>` — full-text shortcut search
- `GET /api/categories` — list of categories with app counts

---

## Key architectural decisions

- **Server-side category fetch in `page.tsx`:** Categories are static seed data that almost never change. Fetching them server-side in the homepage component avoids a client-side waterfall on first load and means the category grid is immediately visible without a loading state. Search stays client-side because it is user-triggered and dynamic.
- **`next-themes` for dark mode:** Using `next-themes` rather than rolling localStorage reads manually eliminates the flash-of-wrong-theme problem on hydration. It sets the `class` attribute on `<html>` before first paint via an inline script, which Tailwind's `dark:` variant picks up. localStorage persistence is built into `next-themes`.
- **300ms debounce via ref (no extra library):** A single `useRef<ReturnType<typeof setTimeout>>` in `SearchBar` is enough for a 300ms debounce. Adding `use-debounce` or lodash for one call site is premature.
- **TanStack Query for all API calls:** Per frontend standards, no raw `fetch` in components. TanStack Query provides caching, loading/error states, and background refetch. For search, `keepPreviousData: true` prevents the results list from collapsing between keystrokes.
- **TASK-0003 must be merged before this task ships:** This branch is built against main (which does not yet include TASK-0003's API routes). Feature code will be authored to call those routes; the Playwright E2E tests require a live database with seeded data to pass. The PR can be opened as a draft; CI running the E2E suite will fail until TASK-0003 is merged to main and this branch is rebased.
- **`lib/api.ts` uses native `fetch` (not axios):** Axios is not in the current dependency list and is heavier than needed for a handful of read-only GET calls. Native `fetch` is fully typed and available in Next.js RSC and client components alike.

---

## Test coverage plan

- **Playwright E2E (`packages/web/e2e/homepage.spec.ts`):** Full homepage flow — category grid visible on load; search bar debounce triggers API call and results appear; result rows include command, key combo, app name, platform badges; clearing search hides results; dark/light toggle changes `<html>` class; category tile links contain `/categories/<slug>`; viewport at 320px shows no horizontal overflow.
- **No Vitest unit tests for this task:** The components are thin presentation wrappers around TanStack Query state. E2E coverage at the Playwright level gives higher confidence for a UI-only task than component snapshots.

---

## Out of scope (technical)

- Category browse pages at `/categories/[slug]` — TASK-0005
- Per-app shortcut pages at `/apps/[slug]` — TASK-0005
- Platform toggle on the homepage — deferred per PRD scope note
- SEO meta tags — TASK-0005
- Vercel deployment or production hosting config
- Analytics (PostHog) integration
- Error boundary for failed API calls beyond the TanStack Query `isError` state

---

## Risks and open questions

- **TASK-0003 not yet on main:** The API routes this homepage calls are approved but not merged. The branch will compile cleanly but E2E tests will fail in CI until the merge happens. Flagged in the PR description so the Reviewer is aware.
- **Tailwind v3 vs v4:** The current `packages/web/package.json` specifies `next: ^14` but has no Tailwind dependency yet. This task will install Tailwind v3 (stable; v4 is still in beta as of this writing). If the project moves to v4, the `tailwind.config.ts` and `postcss.config.js` format changes significantly.
- **`next-themes` hydration with App Router:** `next-themes` requires `suppressHydrationWarning` on `<html>` to suppress the React warning from the server/client class mismatch on the theme attribute. This is the documented `next-themes` workaround and is safe.

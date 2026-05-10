# TRD: Per-App Shortcut Pages, Category Browse Pages & Platform Toggle

**Task:** TASK-0005
**Branch:** goals/5-per-app-category-pages
**PRD:** research/agents/prds/goal-02-web-search-browse.md
**Date:** 2026-05-09

---

## What we're building

TASK-0005 completes Goal 2's browse surface by adding two page types and a persistent platform selector to the Next.js App Router app in `packages/web`. The PRD requires users to navigate from a category tile (built in TASK-0004) through a category browse page to an individual app's full shortcut list, with visual keyboard key styling and a Win/Mac/Linux platform filter that remembers their choice. This task is purely frontend — all the API routes it consumes (`GET /api/apps/[slug]`, `GET /api/apps?category=`) were built in TASK-0003, and the layout, theme system, and shared atoms (`PlatformBadge`, `ShortcutCard`, `CategoryGrid`) were established in TASK-0004.

---

## Technical components needed

**New frontend components:**
- `components/KeyCap.tsx` — Atom: renders one key label (e.g. `Ctrl`, `Shift`, `P`) in a keyboard-key visual style (rounded border, monospace font, slight shadow). Needed to meet the PRD requirement for "styled keyboard key caps." Takes a single `key` prop (string).
- `components/KeyCombo.tsx` — Molecule: parses a full key-combo string (e.g. `"Ctrl+Shift+P"` or `"Ctrl+K → Ctrl+C"`) into individual key tokens and renders each as a `KeyCap` with `+` and `→` separators. Used in every shortcut row on the app page.
- `components/PlatformToggle.tsx` — Client component: three-button toggle group for Win / Mac / Linux. Reads and writes platform selection via `usePlatform`. Renders platform names with appropriate styling. Used on both the app page and as a persistent element in the shared header (once the header exists).
- `components/AppCard.tsx` — Molecule: one tile in the category browse grid. Shows app name, truncated description, and links to `/apps/[slug]`. Styled consistently with `CategoryGrid` tiles from TASK-0004.
- `components/ShortcutRow.tsx` — Molecule: one row in the shortcut list. Displays the command description, an optional context badge if context differs from the group heading, and the `KeyCombo` for the currently-selected platform (falling back to the first available platform if no binding exists for the selection).
- `components/ContextGroup.tsx` — Organism: a labelled group of `ShortcutRow` items sharing the same context/scope string. Renders the context name as a section heading followed by the shortcut rows.

**New hooks:**
- `hooks/usePlatform.ts` — Client hook managing the persistent platform selection. On first mount, reads `kcc_platform` from localStorage; if absent, detects the user's OS from `navigator.userAgent` and defaults to the matching platform slug. Returns `[platform, setPlatform]`; writes to localStorage on every `setPlatform` call. Single source of truth for platform state across all pages during a session.
- `hooks/useApp.ts` — TanStack Query hook wrapping `lib/api.fetchApp(slug)`. Cache key `['app', slug]`. Used by the app shortcut page client shell to avoid prop-drilling the full `AppDetail` through multiple layers.
- `hooks/useAppsByCategory.ts` — TanStack Query hook wrapping `lib/api.fetchAppsByCategory(category)`. Cache key `['apps', category]`. Used if the category page requires client-side behavior (loading state, pagination in future).

**New pages:**
- `app/categories/[slug]/page.tsx` — Server component. Fetches the app list for the given category slug server-side via `fetch` (same pattern as the homepage category fetch in TASK-0004). Renders an `AppCard` grid. Exports `generateMetadata` for SEO (title: `"<Category Name> shortcuts — Keyboard Command Center"`, description from category context).
- `app/apps/[slug]/page.tsx` — Mixed server/client boundary. The outer page is a server component that fetches `AppDetail` server-side for fast initial render. A client shell component (`AppPageClient`) receives the data as props and owns the interactive state (platform toggle, in-app search filter). Exports `generateMetadata` with app name and description.

**Modified lib modules:**
- `lib/api.ts` — Add two methods to the existing centralized API client:
  - `fetchApp(slug: string): Promise<AppDetail>` — calls `GET /api/apps/${slug}`
  - `fetchAppsByCategory(category: string): Promise<AppSummary[]>` — calls `GET /api/apps?category=${category}`

**Schema changes:** No schema changes — all required data is already in the database and exposed by TASK-0003's API routes.

**API changes:** No new endpoints. This task consumes three existing endpoints:
- `GET /api/apps/[slug]` → `AppDetail` (shortcuts grouped by context)
- `GET /api/apps?category=<slug>` → `AppSummary[]`
- `GET /api/categories` → `CategorySummary[]` (already used in TASK-0004; no additional consumption here)

---

## Key architectural decisions

- **Server-side data fetch on both pages:** Consistent with the pattern established in TASK-0004's homepage, both new pages fetch their primary data server-side (app detail, category app list). This gives immediate HTML content for SEO indexing (required by PRD) and avoids a client-side loading waterfall. Interactive state (platform toggle, in-app search) is handled in a client shell component that receives the pre-fetched data as props.
- **Client-side in-app search via `useMemo`:** The PRD explicitly rules out SSR of search results, and the largest apps have <500 shortcuts. A `useMemo` over the `AppDetail.contexts` object filtered by a search string is instantaneous at this data size — no API call, no debounce needed. This is simpler and faster than a server round-trip.
- **`usePlatform` as a single localStorage gateway:** Rather than multiple components reading `localStorage` directly, a single hook owns all platform persistence. This makes the logic easy to test in isolation and ensures consistency if the storage key ever changes.
- **Platform fallback to first available binding:** If a user selects Linux but an app has no Linux bindings, `ShortcutRow` shows the first available platform binding rather than an empty row. This prevents a confusing blank shortcut list and is noted in the UI (a small "No Linux binding — showing Windows" label). This matches real-world shortcut databases where cross-platform coverage is incomplete.
- **No new infrastructure dependencies:** All new components use Tailwind CSS (already in the project) and follow the atomic design convention established in TASK-0004. No new npm packages needed beyond what TASK-0004 already introduced.
- **Rebase onto TASK-0004 before marking ready:** This branch is cut from main. Because it imports `lib/api.ts`, `lib/env.ts`, `components/PlatformBadge.tsx`, and `app/layout.tsx` which are all on the goals/4-homepage-search branch, a rebase onto `goals/4-homepage-search` (or a wait for TASK-0004 to merge to main and then rebase onto main) is required before the build phase.

---

## Test coverage plan

- **Playwright E2E (`e2e/category-page.spec.ts`):** Category page renders app grid with at least one tile; clicking a tile navigates to `/apps/[slug]`; page title includes the category name; 320px viewport has no horizontal overflow.
- **Playwright E2E (`e2e/app-page.spec.ts`):** App page renders shortcut sections grouped by context; `KeyCombo` elements are visible; platform toggle buttons are present and clicking one filters/updates displayed shortcuts; typing in the in-app search input narrows the displayed shortcuts client-side; dark mode renders correctly (no white flash); 320px viewport usable.
- **No Vitest unit tests:** As in TASK-0004, the components are thin presentation wrappers. E2E coverage at the flow level is the primary proof of correctness. The `usePlatform` hook logic (localStorage read/write, OS detection) is simple enough to be covered by the E2E tests that rely on it.

---

## Out of scope (technical)

- Homepage and global search — shipped in TASK-0004.
- API routes — shipped in TASK-0003.
- User accounts, favorites, or personalized shortcut lists — Goal 7.
- Community submissions or editing shortcuts — Goal 8.
- SSR of search results — ruled out by PRD.
- Pagination on the app shortcut page — PRD explicitly defers this; load all shortcuts at once.
- Platform toggle in the global navigation header — layout changes are deferred; toggle appears on the app page only in this task.
- Admin panel or any write endpoints.

---

## Risks and open questions

- **TASK-0004 not yet merged:** This branch depends on components and lib modules from TASK-0004 (goals/4-homepage-search). The TRD is written assuming those will be available. Build phase must wait for either: (a) TASK-0004 merges to main and this branch rebases, or (b) an explicit decision to combine the branches. Recommended: wait for TASK-0004 to merge, then rebase.
- **`AppDetail.contexts` shape:** The `contexts` field is a `Record<string, ShortcutEntry[]>` (from `@kcc/core`). Key order in JavaScript objects is insertion order for string keys. The order contexts appear on the app page will follow seed insertion order, which may not be alphabetical or user-friendly. If this is an issue, a sort step can be added to `ContextGroup` ordering without schema changes — but it's not required by the PRD so it's left as a future enhancement.
- **OS detection accuracy:** `navigator.userAgent` detection for macOS vs Windows vs Linux is heuristic-based and imperfect (e.g. iPadOS reports as macOS). For a default that's immediately overridable, this is acceptable. The fallback is Windows (the most common shortcut baseline in the seed data).

# Plan: TASK-0005 — Per-App Shortcut Pages, Category Browse Pages & Platform Toggle

**Task:** TASK-0005
**Branch:** goals/5-per-app-category-pages
**PRD:** research/agents/prds/goal-02-web-search-browse.md
**Date:** 2026-05-09

---

## Goal

Complete the Goal 2 web interface by building two remaining page types and the persistent platform toggle:

1. `/apps/[slug]` — Full shortcut listing for one app, grouped by context, with visual key caps, platform filter, and in-app search.
2. `/categories/[slug]` — Grid of apps in a category, each tile linking to its app page.
3. Persistent platform toggle — OS-detected default, localStorage persistence, carried across all page navigations.

---

## Dependency note

TASK-0004 (goals/4-homepage-search) is approved but not yet merged. This branch is based on main and will need to be rebased once TASK-0004 merges to pick up: `app/layout.tsx`, `app/globals.css`, `app/providers.tsx`, `components/ThemeToggle.tsx`, `components/PlatformBadge.tsx`, `components/ShortcutCard.tsx`, `components/CategoryGrid.tsx`, `hooks/useSearch.ts`, `hooks/useCategories.ts`, `lib/api.ts`, `lib/env.ts`, `lib/prisma.ts`.

All components this task writes must be consistent with that foundation.

---

## Work breakdown

### Phase 1 — API client extensions & hooks
1. Add `fetchApp(slug)` and `fetchAppsByCategory(category)` to `lib/api.ts`
2. Write `hooks/usePlatform.ts` — reads/writes `kcc_platform` in localStorage; detects OS from `navigator.userAgent`; exports `[platform, setPlatform]` tuple
3. Write `hooks/useApp.ts` — TanStack Query hook for `fetchApp`; cache key `['app', slug]`; staleTime 2 min
4. Write `hooks/useAppsByCategory.ts` — TanStack Query hook for `fetchAppsByCategory`; cache key `['apps', category]`; staleTime 2 min

### Phase 2 — Atom & molecule components
5. `components/KeyCap.tsx` — single key cap atom (e.g. `Ctrl`, `A`); keyboard-key visual styling
6. `components/KeyCombo.tsx` — molecule: splits a keyCombo string on `+` and `→`, renders each token as `<KeyCap>`
7. `components/PlatformToggle.tsx` — Win/Mac/Linux toggle buttons; reads/writes via `usePlatform`; renders three pill-style buttons
8. `components/AppCard.tsx` — app tile for category grid; shows name, description excerpt, category badge; links to `/apps/[slug]`

### Phase 3 — Organism component for app page
9. `components/ShortcutRow.tsx` — one row in the shortcut table: command, context tag (if any), `KeyCombo` for selected platform (or cross-platform fallback)
10. `components/ContextGroup.tsx` — collapsible group heading + list of `ShortcutRow`s for one context

### Phase 4 — Pages
11. `app/categories/[slug]/page.tsx` — server component; fetches apps by category server-side; renders `AppCard` grid; SEO metadata via `generateMetadata`
12. `app/apps/[slug]/page.tsx` — server component for initial data; client shell for interactive filter/toggle; renders `PlatformToggle`, search input, `ContextGroup` list; SEO metadata via `generateMetadata`

### Phase 5 — E2E tests
13. `e2e/category-page.spec.ts` — category page: renders app grid, tiles link to `/apps/[slug]`
14. `e2e/app-page.spec.ts` — app page: shortcuts visible grouped by context, key caps render, platform toggle filters, in-app search filters client-side

---

## Acceptance criteria mapping

| Acceptance criterion | Implementation |
|---|---|
| `/apps/[slug]` renders shortcuts grouped by context | `ContextGroup` per entry in `AppDetail.contexts` |
| Visual key caps | `KeyCombo` renders each key token as `<KeyCap>` |
| Platform toggle filters shortcuts | `PlatformToggle` + `usePlatform`; `ShortcutRow` reads selected platform |
| Platform selection persists | `usePlatform` reads/writes `kcc_platform` in localStorage |
| In-app search filters in real time | Client-side `useMemo` over `AppDetail.contexts` keyed on search input |
| `/categories/[slug]` renders app grid | `AppCard` grid from `fetchAppsByCategory` |
| Category tiles link to `/apps/[slug]` | `AppCard` wraps in `<Link href="/apps/${slug}">` |
| Dark/light mode compatible | All components use `dark:` Tailwind variants; inherits theme from TASK-0004 layout |
| Mobile-responsive (320px+) | Tailwind responsive grid; min-width guards on key caps |
| SEO meta tags | `generateMetadata` exports on both page files |

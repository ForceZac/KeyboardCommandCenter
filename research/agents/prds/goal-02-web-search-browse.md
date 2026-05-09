# PRD: Goal 02 — Web Search & Browse Interface

**Status:** ready
**Owner:** Product Manager agent
**Last updated:** 2026-05-09

## Problem

The shortcut database from Goal 1 needs a discovery surface. Users need to find shortcuts fast — by searching across all apps or browsing by category/app. The web interface is the primary way most users will discover Keyboard Command Center, and it proves the data model works before investing in desktop development. No existing tool offers a modern, fast, mobile-responsive shortcut search across hundreds of applications.

## User stories

- As a power user, I want to search "undo photoshop" and instantly see the shortcut for all platforms, so I don't have to dig through Adobe's docs.
- As a new user, I want to browse applications by category (Creative, Developer Tools, etc.) so I can explore what's available.
- As a mobile user, I want to look up shortcuts on my phone while sitting at my desktop, so I can learn while working.
- As a user switching between Mac and Windows, I want to toggle platform view so I see the right modifier keys for my current OS.

## UX flow

1. User lands on the homepage — sees a prominent search bar and a grid of application categories.
2. **Search path:** User types in the search bar → results appear as they type (debounced) → results show shortcut command, key combo, app name, and platform badges → clicking a result navigates to the app's shortcut page.
3. **Browse path:** User clicks a category tile (e.g. "Developer Tools") → sees a grid of apps in that category → clicks an app (e.g. "VS Code") → sees the full shortcut list for that app.
4. **App shortcut page:** Lists all shortcuts grouped by context/scope. User can filter by platform (Win/Mac/Linux toggle). Search within the app's shortcuts. Each shortcut shows: command description, key combination (styled as keyboard keys), context.
5. **Platform toggle:** Persistent across navigation. Defaults to user's detected OS. Shows the correct modifier keys (Cmd vs Ctrl).

## Success metrics

- Full-text search returns results in <200ms on the seeded database.
- Homepage loads in <1.5s (LCP).
- All 50+ seeded applications browsable with correct shortcuts displayed.
- Mobile-responsive — usable on screens 320px and wider.
- Platform toggle correctly switches between Win/Mac/Linux key combos.
- Zero layout shift on search result updates.

## Scope

**In:**
- Next.js App Router application in `packages/web`
- Homepage with search bar and category grid
- Global search across all apps and shortcuts (full-text, debounced)
- Category browse pages listing apps in each category
- Per-app shortcut pages with:
  - Shortcuts grouped by context/scope
  - Platform filter toggle (Win/Mac/Linux)
  - In-app search/filter
  - Keyboard key styling (visual key caps)
- API routes in `packages/web/app/api/`:
  - `GET /api/shortcuts/search?q=<query>&platform=<platform>` — full-text search
  - `GET /api/apps` — list all apps, filterable by category
  - `GET /api/apps/[slug]` — single app with all shortcuts
  - `GET /api/categories` — list categories with app counts
- SEO: proper meta tags, semantic HTML, app pages indexable
- Dark mode (default) with light mode toggle
- Mobile-responsive layout
- Shared types from `packages/core`

**Out:**
- User accounts, login, or favorites (Goal 7)
- Community shortcut submissions (Goal 8)
- Desktop app or Electron integration (Goal 3+)
- Admin panel for managing shortcuts
- Analytics dashboard
- API rate limiting or authentication (public read-only API)
- Server-side rendering of search results (client-side search is fine for <5000 shortcuts)

## Open questions

- Should we use Next.js API routes or a separate Express server for the API? **Recommendation:** Next.js API routes for now — simpler deployment to Vercel, and the data is read-only. Migrate to standalone Express if we need WebSocket support or heavier backend logic later.
- Do we need pagination for app shortcut pages, or can we load all shortcuts at once? **Recommendation:** load all at once — even the most shortcut-heavy apps (Photoshop, VS Code) have <500 shortcuts. Client-side filtering is instant.
- Should search results link to the app page or show an inline preview? **Recommendation:** inline preview with a "View all shortcuts for [App]" link. Users want the answer fast, not a page navigation.

## Dependencies

- **Goal 1** — Shortcut Data Schema & Seed Database must be complete. The web app reads from the Prisma database seeded in Goal 1.

# Frontend Standards

_These are the frontend coding standards the Reviewer enforces and the Developer follows._

## Stack

- **Framework:** Next.js 14+ (App Router) + TypeScript + React
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** TanStack Query + Zustand
- **Testing:** Vitest + Playwright

## Component conventions

- Server components by default. Client components only when interactivity is needed (search, filters, favorites).
- Co-locate component + styles.
- Atomic design: atoms (Button, Badge) -> molecules (ShortcutCard, AppTile) -> organisms (ShortcutGrid, AppBrowser).
- File naming: PascalCase for components.

## Hook rules

- Custom hooks prefixed with "use". One hook per concern (useSearch, useActiveApp, useOverlayPosition).
- Side effects isolated in hooks, not components.
- Hooks live in `hooks/` directory, co-located with feature if feature-specific.

## API module structure

- Centralized API client in `lib/api.ts`. Typed request/response per endpoint.
- TanStack Query hooks wrap every API call — no raw fetch in components.

## Styling

- Tailwind utility-first. shadcn/ui for all standard UI components.
- Design tokens via Tailwind config (colors, spacing).
- Dark mode required (users are power users).
- Conditional styling via clsx/cn utility.

## Testing

- Vitest for component unit tests. Playwright for critical paths (search flow, app navigation, login).
- No snapshot tests.
- E2E covers: search, browse by category, shortcut detail view, favorites (if logged in).

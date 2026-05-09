# Separation of Concerns

_What lives where. The Reviewer rejects PRs that put logic in the wrong layer._

## Layer map

- `packages/web` — Next.js web app (pages, components, hooks, API routes). No Electron-specific code.
- `packages/desktop` — Electron shell (main process, preload, IPC). Imports shared types but no web components.
- `packages/core` — Shared business logic, types, and shortcut data schemas. No framework dependencies. Importable by both web and desktop.
- `packages/overlay` — Overlay UI (lightweight React rendered in Electron BrowserWindow). Minimal dependencies for fast render.
- `database/` — Prisma schema, migrations, seed scripts. No runtime code.

## Cross-cutting rules

- Desktop never imports from web. Web never imports from desktop. Both import from core. Overlay imports from core only.
- Environment variables accessed only via a typed `env.ts` config module — never raw `process.env` in business logic.
- All OS-specific code (process detection, window management) lives behind platform adapters in `packages/desktop/platform/`.

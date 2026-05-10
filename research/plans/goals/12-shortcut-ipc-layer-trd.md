# TRD: Shortcut Data IPC Layer & Prefetch

**Task:** TASK-0012
**Branch:** goals/12-shortcut-ipc-layer
**PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
**Date:** 2026-05-10

---

## What we're building

TASK-0012 wires the Electron main process to the PostgreSQL shortcut database and exposes that
data to the panel renderer via a typed IPC channel. The panel (Goal 3 shell) currently shows a
placeholder stub; this task adds the data plumbing so the renderer can request shortcuts for the
detected active app and receive them in time to meet the PRD's 100ms render target. The key
mechanism is prefetching: when the detection service fires an app-changed event, the main process
proactively queries and caches the new app's shortcuts before the user opens the panel, so the
`shortcuts:get-by-app` IPC call is served from memory with no database round-trip. This task does
not touch the renderer UI — all visual changes belong to TASK-0013.

---

## Technical components needed

**New backend components (main process):**
- `shortcut-service.ts` — `ShortcutService` class that accepts an injected Prisma client and
  implements `getShortcutsForApp(slug: string): Promise<AppDetail | null>`. Joins
  `Application → Shortcut → ShortcutKeyBinding → ShortcutKeyStep`, groups results by
  `shortcut.context`, and returns an `AppDetail` from `@kcc/core`. Returns null for unknown
  slugs and on DB errors (swallows the error after logging).
- `ShortcutCache` — in-memory LRU cache (Map + insertion-order tracking) with capacity 5.
  Caches both positive results (`AppDetail`) and negative results (`null`) to avoid repeated
  DB round-trips for unrecognized app slugs. Lives in `shortcut-service.ts` — no separate file.

**Modified backend components (main process):**
- `main.ts` — three additions:
  1. Instantiate `PrismaClient` and `ShortcutService` after `app.whenReady`.
  2. Register `ipcMain.handle('shortcuts:get-by-app', ...)` — serves cached results or triggers
     a DB fetch on cache miss, then caches and returns.
  3. Wrap the `emitToRenderer` callback passed to `DetectionService` to trigger
     `prefetchShortcuts(slug)` whenever app-changed fires with a non-null slug (fire-and-forget,
     no await — does not delay the IPC event to the renderer).

**Modified preload:**
- `preload.ts` — add `getShortcutsForApp(slug: string): Promise<AppDetail | null>` to the
  contextBridge `kcc` object. Calls `ipcRenderer.invoke('shortcuts:get-by-app', slug)`.

**Modified renderer type declarations:**
- `renderer/kcc.d.ts` — add `getShortcutsForApp` to `KccAPI`. Reference `AppDetail` from
  `@kcc/core` (already in tsconfig renderer paths).

**New frontend components:** None (renderer UI is TASK-0013 scope).

**Schema changes:** No schema changes.

**API changes:**
- New IPC handler: `shortcuts:get-by-app` (slug: string) → `AppDetail | null`
  - `AppDetail` is defined in `@kcc/core` and matches the shape of the existing web API response:
    `{ id, name, slug, description, categorySlug, contexts: Record<string, ShortcutEntry[]> }`
  - Returns null for unknown slugs or DB errors (renderer renders fallback state per TASK-0013).
- New contextBridge method: `window.kcc.getShortcutsForApp(slug)` — typed Promise wrapper.

---

## Key architectural decisions

- **Reuse `AppDetail` from `@kcc/core`** — no new types needed. The web API already returns this
  shape for `GET /api/apps/[slug]`; the desktop IPC layer returns the same shape, keeping the
  data contract consistent across both surfaces.

- **Prisma in the main process, not in a separate worker** — the desktop app already connects to
  the local PostgreSQL database (same DB as the web app). Instantiating `PrismaClient` directly
  in the main process is the simplest path; no new infrastructure, no separate process.

- **Dependency injection for PrismaClient** — `ShortcutService` accepts a Prisma-like interface
  rather than instantiating `PrismaClient` itself. This follows the same pattern as
  `DetectionService` (injected `getActiveWindow`, `lookupApp`, etc.) and makes the service
  fully testable with Vitest mocks.

- **Prefetch via wrapped emitToRenderer** — rather than adding a new event hook or callback to
  `DetectionService`, the prefetch is triggered by wrapping the `emitToRenderer` function passed
  to `DetectionService`. This avoids changing the `DetectionService` API (which has tests) and
  keeps the prefetch logic in `main.ts` where the cache lives.

- **All platforms returned, renderer filters** — the IPC response includes bindings for all
  platforms (Windows, macOS). The renderer (TASK-0013) detects the current OS and filters at
  display time. Filtering in the main process would require passing the platform at query time
  and invalidating the cache per-platform — unnecessary complexity for a local app where OS
  never changes at runtime.

- **LRU cap of 5, null caching included** — matches the PRD requirement for up to 5 cached
  apps. Null entries (unknown slugs) count toward the cap so the cache never fills with
  unrecognized apps in edge cases.

---

## Test coverage plan

- **Unit tests (`__tests__/shortcut-service.test.ts`):**
  - `ShortcutService`: known slug → returns grouped `AppDetail`; unknown slug → returns null;
    DB error → returns null without throwing.
  - `ShortcutCache`: hit before expiry; eviction when 6th unique slug inserted; null entries
    cached correctly; repeated unknown slug doesn't call service more than once.
- **No IPC integration tests** — `ipcMain.handle` registration cannot be exercised in Vitest
  without Electron; the handler logic is a thin pass-through to `ShortcutService`, which is
  covered by unit tests. Integration is validated manually in dev mode (TRD approved exception).

---

## Out of scope (technical)

- Renderer UI changes (shortcut list rendering, key cap display) — TASK-0013.
- Search/filter input — TASK-0015.
- Fallback states (no detection, unrecognized app, no shortcuts) — separate Goal 5 task.
- Platform filtering in the IPC layer — renderer's responsibility (TASK-0013).
- Persistent on-disk cache or offline support.
- Prisma migrations (schema unchanged).

---

## Risks and open questions

- **Prisma in Electron main process**: PrismaClient requires the `DATABASE_URL` env var at
  runtime. In dev mode this is fine (`.env.local`). Electron Forge packaging will need to
  bundle the Prisma query engine binary. This is a known packaging concern deferred to a
  later goal; for now the dev-mode path works.
- **Cold-start DB latency**: If the user opens the panel before the detection service fires
  (e.g. manually selects an app from the tray), the first `shortcuts:get-by-app` call will
  trigger a live DB query (no prefetch). Latency is expected to be well under 100ms on a
  local PostgreSQL instance. If profiling reveals otherwise, prefetch on panel show can be
  added as a follow-on.
- **Main thread blocking**: Prisma queries are async (Promise-based). The `ipcMain.handle`
  callback is async; no main thread blocking occurs.

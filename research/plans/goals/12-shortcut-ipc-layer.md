# Plan: Shortcut Data IPC Layer & Prefetch — TASK-0012

**Branch:** goals/12-shortcut-ipc-layer
**TRD:** research/plans/goals/12-shortcut-ipc-layer-trd.md

---

## Work breakdown

### Slice 1 — ShortcutService (Prisma query + response shaping)
- Create `packages/desktop/src/shortcut-service.ts`
- Accept an injected Prisma client interface (so the service is unit-testable without a real DB)
- Implement `getShortcutsForApp(slug: string): Promise<AppDetail | null>` — queries the DB,
  joins Application → Shortcut → ShortcutKeyBinding → ShortcutKeyStep, groups results by `context`,
  and returns an `AppDetail` from `@kcc/core` (or null for unknown slugs / DB errors)
- All bindings for all platforms are returned; the renderer (TASK-0013) filters by OS at display time

### Slice 2 — ShortcutCache (in-memory LRU, cap 5)
- Implement inside `shortcut-service.ts` (no separate file needed — it's small)
- `Map<string, AppDetail | null>` with insertion-order tracking for LRU eviction at capacity 5
- `null` entries cache "not found" results to avoid repeated DB hits for unknown slugs
- Expose `get(slug)`, `set(slug, data)`, `has(slug)`, `clear()` methods

### Slice 3 — IPC handler `shortcuts:get-by-app`
- In `main.ts`, register `ipcMain.handle('shortcuts:get-by-app', ...)` after app.whenReady
- Handler: check cache first; on miss, call `ShortcutService.getShortcutsForApp(slug)`, cache result, return
- On DB error: log to console, return null (no unhandled exception)
- On empty/unknown slug: return null

### Slice 4 — Prefetch hook on detection app-changed
- In `main.ts`, hook the `DetectionService` event flow — when `emitToRenderer` fires
  `detection:app-changed` with a non-null `appSlug`, call a `prefetchShortcuts(slug)` function
  before emitting to the renderer
- `prefetchShortcuts`: if slug already cached, no-op; otherwise fire-and-forget
  `shortcutService.getShortcutsForApp(slug).then(data => cache.set(slug, data))` with no await
- Implement this by wrapping the `emitToRenderer` callback passed to `DetectionService`

### Slice 5 — Preload: expose `getShortcutsForApp`
- In `preload.ts`, add `getShortcutsForApp(slug: string): Promise<AppDetail | null>` to the
  contextBridge `kcc` object
- Calls `ipcRenderer.invoke('shortcuts:get-by-app', slug)`

### Slice 6 — Type declarations: update `kcc.d.ts`
- Import/re-export `AppDetail` shape in `renderer/kcc.d.ts` (or inline the needed types)
- Add `getShortcutsForApp(slug: string): Promise<AppDetail | null>` to `KccAPI` interface
- Since `@kcc/core` types are available to the renderer via the tsconfig paths, reference them directly

### Slice 7 — Unit tests
- `__tests__/shortcut-service.test.ts` — test `ShortcutService` and `ShortcutCache` in isolation:
  - Returns grouped data for a known app (mock Prisma returns fixture rows)
  - Returns null for unknown slug (mock Prisma returns null application)
  - Returns null and doesn't throw when Prisma rejects (DB error simulation)
  - Cache hit: second call doesn't invoke Prisma (call count assertion)
  - Cache eviction: inserting a 6th unique slug evicts the oldest entry
  - Cache null entries: unknown slug is cached so repeated misses skip DB

### Slice 8 — Mark PR ready
- Run `npm run test -w packages/desktop` — all tests green
- Run TypeScript check — no errors
- Mark PR ready, strip WIP prefix, move task to In Review

---

## Order
Slices 1 and 2 together (ShortcutService + cache) → 3 (IPC handler) → 4 (prefetch) →
5 (preload) → 6 (types) → 7 (tests) → 8 (mark ready).
Slices 5 and 6 are interdependent; commit together.

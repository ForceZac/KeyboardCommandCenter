# TRD: Overlay Renderer — Compact Shortcut Display

**Task:** TASK-0018
**Branch:** goals/18-overlay-renderer
**PRD:** research/agents/prds/goal-06-overlay-mode.md
**Date:** 2026-05-10

---

## What we're building

The overlay renderer is the React UI loaded inside the transparent, always-on-top BrowserWindow created by TASK-0017. It listens for `detection:app-changed` IPC events, fetches the pre-cached shortcut data for the active app, selects a compact subset of shortcuts (top 3–4 context groups, 8–12 shortcuts each), and renders them with a semi-transparent background using the user's configured opacity. When the active app is unrecognized, it shows a muted "No shortcuts for [Process Name]" fallback.

This task covers only the renderer content (`packages/overlay`). It does not create the BrowserWindow, register hotkeys, or set up electron-store — those are TASK-0017's responsibility.

---

## Dependency on TASK-0017

TASK-0018's feature code requires TASK-0017 to be merged before end-to-end integration can be tested. TASK-0017 owns:
- The overlay `BrowserWindow` (transparent, frameless, always-on-top with `'floating'` level)
- `packages/desktop/src/overlay-preload.ts` — contextBridge bridge exposing `window.kccOverlay`
- Electron-store keys: `overlay.opacity` (number, 0.4 default), `overlay.size` (string, 'Standard' default)
- Wiring `detection:app-changed` events to the overlay window's webContents

TASK-0018 specifies the IPC contract that TASK-0017 must implement (see API Changes below). All React components and unit tests in this task can be built and validated independently.

---

## Technical components needed

### New overlay package components (`packages/overlay/src/`)

- **`main.tsx`** — React entry point; mounts `<App />` into `#root`. Keeps the bundle entry minimal.

- **`App.tsx`** — Root component. Consumes `useOverlayData` and `useOverlayPrefs`, builds the display data via content-selection helpers, applies opacity to the container, and renders the correct state (idle / unrecognized / loaded).

- **`components/AppName.tsx`** — Renders the detected app name in small, muted text at the top of the overlay. Receives `name: string` prop.

- **`components/ContextGroup.tsx`** — Renders one context group: a heading with the group name, a list of `<ShortcutRow>` entries (capped by size preset), and an overflow line ("+ N more in panel") when more shortcuts exist in the group than are displayed.

- **`components/ShortcutRow.tsx`** — Renders a single shortcut: command description left-aligned, key combo right-aligned. Picks the correct `PlatformBinding` by platform slug.

- **`components/NoShortcuts.tsx`** — Renders the unrecognized-app fallback: "No shortcuts for [processName]" in muted text. Receives `processName: string` prop.

- **`hooks/useOverlayData.ts`** — Subscribes to `window.kccOverlay.onAppChanged` on mount; on each event calls `window.kccOverlay.getShortcutsForApp(slug)` (served from main-process prefetch cache — typically <1ms). Returns `{ status, appDetail, processName }`. Status values: `'idle'` (no event yet), `'loaded'` (AppDetail received), `'unrecognized'` (appSlug null or AppDetail null).

- **`hooks/useOverlayPrefs.ts`** — Calls `window.kccOverlay.getOverlayPrefs()` once on mount. Returns `{ opacity: number, size: 'Compact' | 'Standard' }` with defaults (0.4, 'Standard') while the promise resolves.

- **`utils/contentSelection.ts`** — Pure functions for selecting display content from `AppDetail.contexts`:
  - `selectGroups(contexts, size)` — sorts groups by shortcut count descending, returns top N group names (N=3 for Compact, N=4 for Standard)
  - `capGroup(shortcuts, size)` — returns `{ visible: ShortcutEntry[], overflowCount: number }` where `visible.length ≤ cap` (cap=8 for Compact, 12 for Standard)

- **`utils/platform.ts`** — `getPlatform()` returns `'macos' | 'windows'` from `navigator.userAgent`. Identical pattern to `packages/desktop/src/renderer/platform.ts`; duplicated per separation-of-concerns rules.

- **`types.ts`** — Overlay-specific type aliases and the `OverlayPrefs` interface; re-exports needed `@kcc/core` types.

### New overlay package config files

- **`vite.config.ts`** — Vite 5 build targeting Electron renderer (`base: './'`, output to `dist/`). No SSR. React plugin.

- **`tsconfig.json`** — TypeScript config extending root. Includes DOM lib, React JSX (`react-jsx`). Paths alias for `@kcc/core`.

- **`index.html`** — Minimal HTML: one `<div id="root">`, script tag loading `src/main.tsx`.

### No new backend components

No changes to the Electron main process, Prisma, or API routes.

### No modified backend components

No changes to `main.ts`, `preload.ts`, `shortcut-service.ts`, or any existing desktop source files.

---

## Schema changes

No schema changes.

---

## API changes

No new HTTP API endpoints.

**IPC contract — overlay preload (implemented by TASK-0017, consumed here):**

The overlay BrowserWindow must load `overlay-preload.ts` which exposes `window.kccOverlay` via contextBridge with:

```typescript
window.kccOverlay = {
  // Subscribe to active-app change events. Returns unsubscribe function.
  // Payload matches DetectionPayload: { appSlug: string | null, processName: string, windowTitle: string }
  onAppChanged(callback: (payload: DetectionPayload) => void): () => void;

  // Fetch shortcut data from main-process cache or DB. Returns null for unknown slugs.
  getShortcutsForApp(slug: string): Promise<AppDetail | null>;

  // Read overlay preferences from electron-store.
  getOverlayPrefs(): Promise<{ opacity: number; size: 'Compact' | 'Standard' }>;
}
```

`onAppChanged` and `getShortcutsForApp` reuse the same IPC channels as the panel preload (`detection:app-changed`, `shortcuts:get-by-app`). `getOverlayPrefs` requires a new `overlay:get-prefs` IPC handler in `main.ts` (TASK-0017's work).

---

## Key architectural decisions

- **Separate preload for overlay** — The overlay window uses its own `overlay-preload.ts` exposing `window.kccOverlay` rather than reusing `preload.ts` / `window.kcc`. This avoids leaking panel APIs (e.g. `hidePanel`) into the overlay context and keeps the bridge contract minimal and explicit.

- **Pull model for shortcut data** — The renderer calls `getShortcutsForApp` after receiving a `detection:app-changed` event, mirroring the panel's pattern. Data is served from the main-process prefetch cache (TASK-0012), so the round-trip is <1ms and well within the 200ms render target.

- **Content capped by design, no scrolling** — The overlay is glanceable, not a full shortcut browser. Hard caps (8/12 shortcuts, 3/4 groups) keep DOM nodes minimal, which directly supports the <20MB memory target. Overflow is surfaced via a count indicator only.

- **Opacity on container, not window** — Per PRD recommendation: `background: rgba(0,0,0, opacity)` with `color: rgba(255,255,255,0.95)` on the container element. CSS `opacity` on the window would make text unreadable at low values; per-element opacity keeps text crisp.

- **React in packages/overlay** — The overlay has more dynamic state than the panel (opacity changes, content transitions, preset switching) that benefits from a component framework. The PRD explicitly recommends React for this package.

- **Duplicate `getPlatform()`** — The overlay cannot import from `packages/desktop` (separation-of-concerns rules). The platform detection snippet is two lines; duplicating it is correct.

- **Unit tests over E2E for this task** — Full E2E (overlay appearing over apps) requires TASK-0017's BrowserWindow. TASK-0018 validates all logic through Vitest unit tests and React component tests. E2E will be added as part of TASK-0017's integration work or a follow-up.

---

## Test coverage plan

- **Vitest unit tests — `contentSelection.ts`:**
  - `selectGroups`: correct top-N selection, sorted by count, both size presets
  - `capGroup`: correct cap values, overflow count calculation, zero shortcuts, exactly-at-cap edge case

- **Vitest + @testing-library/react — component tests:**
  - `App.tsx`: renders nothing on idle, `NoShortcuts` on unrecognized, shortcut groups on loaded; applies correct opacity style
  - `ContextGroup.tsx`: renders correct shortcut count, shows overflow indicator when `overflowCount > 0`, hides it when 0
  - `ShortcutRow.tsx`: renders correct command and key combo for the active platform

- **Vitest — hook tests (`useOverlayData`):**
  - Mock `window.kccOverlay`, simulate `onAppChanged` events, verify state transitions: idle → loaded, idle → unrecognized, loaded → reloaded on new event

---

## Out of scope (technical)

- Opacity live preview from Settings UI (separate task per PRD)
- Overlay positioning or multi-monitor logic (TASK-0017)
- BrowserWindow creation, hotkey registration, or electron-store setup (TASK-0017)
- Settings UI section for overlay preferences (separate task)
- Scrolling within the overlay (design decision: hard caps instead)
- Drag-to-reposition (PRD explicitly excludes for v1)
- Detection service changes
- Linux support (Goal 10)

---

## Risks and open questions

- **`window.kccOverlay` shape** — This TRD defines the preload contract; TASK-0017 must implement it exactly. If TASK-0017's reviewer proposes shape changes, TASK-0018 will need a corresponding update. Low risk — the contract is minimal and mirrors the existing panel preload pattern.

- **Vite + Electron renderer path** — The Vite build must use `base: './'` so asset paths resolve correctly when loaded from Electron's `loadFile()`. Standard configuration, not a novel problem.

- **`@kcc/core` path resolution in Vite** — The overlay package imports `@kcc/core` types. The monorepo workspace symlinks handle this at runtime; the Vite config needs a `resolve.alias` pointing to `packages/core/src/index.ts` for the build. Straightforward.

- **Test setup for `window.kccOverlay`** — Unit tests run in jsdom (no Electron). `window.kccOverlay` must be mocked in the test setup file. Standard pattern used in the desktop renderer tests.

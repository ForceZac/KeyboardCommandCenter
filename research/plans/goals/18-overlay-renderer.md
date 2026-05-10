# Plan: TASK-0018 — Overlay Renderer — Compact Shortcut Display

**Branch:** goals/18-overlay-renderer
**PRD:** research/agents/prds/goal-06-overlay-mode.md
**Date:** 2026-05-10

---

## What we're building

A React renderer living in `packages/overlay` that displays a compact, glanceable shortcut cheat sheet inside the overlay BrowserWindow (provided by TASK-0017). Subscribes to `detection:app-changed` IPC events, fetches shortcut data from the prefetch cache, selects the top context groups with capped shortcut counts, and renders them with the user's configured opacity.

---

## Pre-requisite

**TASK-0017 must be merged before feature code can run end-to-end.** TASK-0017 owns:
- The overlay `BrowserWindow` (transparent, frameless, always-on-top)
- `packages/desktop/src/overlay-preload.ts` — exposes `window.kccOverlay` IPC bridge
- Overlay prefs in `electron-store` (`overlay.opacity`, `overlay.size`)
- Wiring detection events to the overlay window

TASK-0018 can build and unit-test all React components independently. The Vite build produces a standalone HTML/JS bundle that TASK-0017 will load.

---

## Work breakdown

### Phase 1 — Scaffold packages/overlay

- `vite.config.ts` — Vite build config targeting Electron renderer (output to `dist/`)
- `tsconfig.json` — extends root tsconfig, adds DOM lib, React JSX
- `index.html` — minimal HTML entry loading `src/main.tsx`
- `src/main.tsx` — React entry: `ReactDOM.createRoot(...).render(<App />)`

### Phase 2 — Content selection utility

- `src/utils/contentSelection.ts`
  - `selectGroups(contexts, size)` — sorts groups by shortcut count desc, takes top N (3 for Compact, 4 for Standard)
  - `capGroup(shortcuts, size)` — takes first M (8 for Compact, 12 for Standard), returns `{ visible, overflowCount }`
  - Pure functions, no React — easy to unit test

### Phase 3 — React components

- `src/components/ShortcutRow.tsx` — renders one `(command, keyCombo)` row; command left, key combo right
- `src/components/ContextGroup.tsx` — renders group heading, list of ShortcutRow, overflow indicator ("+ N more in panel")
- `src/components/AppName.tsx` — muted app name header at top
- `src/components/NoShortcuts.tsx` — "No shortcuts for [Process Name]" message for unrecognized app

### Phase 4 — Data hook

- `src/hooks/useOverlayData.ts`
  - Subscribes to `window.kccOverlay.onAppChanged` on mount, unsubscribes on unmount
  - On each event: calls `window.kccOverlay.getShortcutsForApp(slug)` (served from main-process cache)
  - State shape: `{ status: 'idle' | 'loaded' | 'unrecognized', appDetail, processName }`

### Phase 5 — Prefs hook

- `src/hooks/useOverlayPrefs.ts`
  - Calls `window.kccOverlay.getOverlayPrefs()` once on mount (promise)
  - Returns `{ opacity: number, size: 'Compact' | 'Standard' }` (defaults: 0.4, 'Standard')
  - Provides sensible defaults while prefs load

### Phase 6 — Root App component

- `src/App.tsx`
  - Consumes `useOverlayData` and `useOverlayPrefs`
  - Container div: `background: rgba(0,0,0,opacity)`, `color: rgba(255,255,255,0.95)`
  - State machine: idle → show nothing; unrecognized → `<NoShortcuts processName=...>`; loaded → `<AppName>` + selected `<ContextGroup>` list
  - Calls `selectGroups` and `capGroup` to build display data from `appDetail`

### Phase 7 — Platform slug

- `src/utils/platform.ts` — `getPlatform()` returning `'macos' | 'windows'` from `navigator.userAgent`
- Passed to each `ShortcutRow` so it can pick the right `PlatformBinding`

### Phase 8 — Unit tests

- `src/utils/__tests__/contentSelection.test.ts` — Vitest, pure function tests
  - top-N group selection, Compact vs Standard counts, overflow calculation, empty input edge cases
- `src/hooks/__tests__/useOverlayData.test.ts` — Vitest + @testing-library/react-hooks
  - mock `window.kccOverlay`, test state transitions
- `src/components/__tests__/App.test.tsx` — Vitest + @testing-library/react
  - renders no-content on idle, NoShortcuts on unrecognized, shortcut list on loaded
  - overflow indicator present when shortcuts exceed cap

### Phase 9 — Verify

- `npm run build -w packages/overlay` (Vite build — catches TypeScript errors)
- `npm run test -w packages/overlay` (Vitest unit tests)
- Manual integration check deferred until TASK-0017 ships

---

## File touch-list

| File | Change |
|---|---|
| `packages/overlay/vite.config.ts` | New — Vite build config |
| `packages/overlay/tsconfig.json` | New — TypeScript config |
| `packages/overlay/index.html` | New — HTML entry point |
| `packages/overlay/src/main.tsx` | New — React entry |
| `packages/overlay/src/App.tsx` | New — root component |
| `packages/overlay/src/components/AppName.tsx` | New |
| `packages/overlay/src/components/ContextGroup.tsx` | New |
| `packages/overlay/src/components/ShortcutRow.tsx` | New |
| `packages/overlay/src/components/NoShortcuts.tsx` | New |
| `packages/overlay/src/hooks/useOverlayData.ts` | New |
| `packages/overlay/src/hooks/useOverlayPrefs.ts` | New |
| `packages/overlay/src/utils/contentSelection.ts` | New |
| `packages/overlay/src/utils/platform.ts` | New |
| `packages/overlay/src/types.ts` | New — overlay-specific type aliases |
| `packages/overlay/src/utils/__tests__/contentSelection.test.ts` | New |
| `packages/overlay/src/hooks/__tests__/useOverlayData.test.ts` | New |
| `packages/overlay/src/components/__tests__/App.test.tsx` | New |

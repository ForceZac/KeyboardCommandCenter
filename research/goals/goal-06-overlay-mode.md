# Goal 6 — Overlay Mode

**Roadmap phase:** Phase 3 — Desktop Power Features
**PRD:** KeyboardCommandCenter/research/agents/prds/goal-06-overlay-mode.md

The overlay is a transparent, always-on-top window that displays a compact subset of keyboard shortcuts for the currently active application — directly on screen, without the user leaving their workflow. Unlike the hotkey panel (which requires the user to switch focus), the overlay is purely glanceable: click-through, opacity-configurable, and capped at a hard shortcut count to stay minimal. It listens to the same detection events as the panel and re-renders on each app change. Goal 6 covers the BrowserWindow scaffolding and toggle hotkey (TASK-0017), the overlay React renderer (TASK-0018), and the Settings UI surface for overlay preferences (TASK-0019).

---

## TASK-0018: Overlay Renderer — Compact Shortcut Display
**PR:** #16 | **Branch:** goals/18-overlay-renderer | **Approved:** 2026-05-10

### What shipped
A complete React renderer in `packages/overlay` that displays a compact shortcut list inside the transparent overlay BrowserWindow created by TASK-0017. On each `detection:app-changed` IPC event, the renderer fetches pre-cached shortcut data via `window.kccOverlay.getShortcutsForApp()`, selects the top 3–4 context groups (8–12 shortcuts each, size-preset-dependent), applies user-configured opacity to the container, and shows a muted fallback when the app is unrecognized. The package includes Vite build config, TypeScript config, and Vitest test coverage.

### Key technical decisions
- **Pull model for data:** renderer calls `getShortcutsForApp` after each `onAppChanged` event, mirroring the panel pattern; data is served from the main-process prefetch cache (TASK-0012) so round-trips are <1ms.
- **Opacity on container, not window:** `background: rgba(0,0,0,opacity)` keeps text crisp at low opacity values (CSS `opacity` on the window would make text unreadable).
- **Hard caps, no scroll:** 8/12 shortcuts, 3/4 groups per size preset — keeps DOM minimal and supports the <20MB memory target. Overflow surfaces as a count indicator only.
- **Separate preload (`window.kccOverlay`):** avoids leaking panel-specific APIs into the overlay context; TASK-0017 must implement this preload bridge.
- **`getPlatform()` duplicated:** overlay cannot import from `packages/desktop` per separation-of-concerns rules; the two-line snippet is intentionally copied and documented.
- **E2E deferred:** full overlay E2E requires TASK-0017's BrowserWindow; unit + component tests cover all logic independently.

### Codebase areas touched
- **Frontend (overlay):** `packages/overlay/src/` — `App.tsx`, `main.tsx`, `components/AppName.tsx`, `components/ContextGroup.tsx`, `components/ShortcutRow.tsx`, `components/NoShortcuts.tsx`, `hooks/useOverlayData.ts`, `hooks/useOverlayPrefs.ts`, `utils/contentSelection.ts`, `utils/platform.ts`, `types.ts`
- **Config:** `packages/overlay/vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `index.html`, `package.json`
- **Tests:** 30 Vitest tests across `contentSelection.test.ts` (12 unit), `useOverlayData.test.ts` (6 hook), `App.test.tsx` (9 component), `ShortcutRow.test.tsx` (3 component)

### Reviewer notes
PR #16 includes TASK-0015's desktop search changes in its diff (branch was built on top of `goals/15-panel-search-filter` before PR #15 landed on main) — merge PR #15 first, then PR #16. Round 2 added ShortcutRow platform tests (Windows path, no-match fallback, empty-array dash), a Compact-mode App-level test, and `pointerEvents: 'none'` on the container. The `useOverlayPrefs` hook has no `.catch()` on the `getOverlayPrefs()` promise — safe because defaults are applied on mount, but a follow-up `.catch(console.error)` would be tidy.

## TASK-0017: Overlay BrowserWindow & Toggle Hotkey
**PR:** #18 | **Branch:** goals/17-overlay-browser-window | **Approved:** 2026-05-10

### What shipped
`OverlayWindowManager` in `packages/desktop/src/overlay-window.ts` — a lazily-created Electron BrowserWindow (frameless, transparent, `alwaysOnTop: 'floating'`, full click-through via `setIgnoreMouseEvents`) that implements the `OverlayController` interface and manages the overlay global hotkey via `globalShortcut`. An `overlay-preload.ts` contextBridge script exposes `window.kccOverlay` (`onAppChanged`, `getShortcutsForApp`, `getOverlayPrefs`) to the overlay renderer. `main.ts` was extended to instantiate `OverlayWindowManager`, register it as the controller, forward detection events to `sendToRenderer`, and clean up in `before-quit`. The panel window's alwaysOnTop level was raised to `'pop-up-menu'` in `window.ts` to guarantee it sits above the overlay's `'floating'` level on both platforms.

### Key technical decisions
- **Lazy BrowserWindow creation:** window is created on first `show()`, not at startup — keeps idle memory near zero when overlay is disabled (the default). Meets the PRD <20MB target.
- **Vite overlay renderer via `loadFile()`:** avoids adding a third webpack renderer entry; TASK-0018 already uses Vite for the overlay package, so `loadFile()` keeps build toolchains separate. Dev mode checks `OVERLAY_DEV_URL` env var first.
- **Overlay hotkey managed directly by `OverlayWindowManager`:** `HotkeyManager` is panel-specific; rather than generalizing it, the overlay manages its own `globalShortcut` lifecycle (register/unregister/re-register on hotkey change). The two hotkeys are independent.
- **Multi-monitor via cursor position:** detection payload doesn't include active window bounds; `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())` is used as an accurate approximation for the overwhelmingly common case. A proposals.md entry flags extending the native module for exact bounds in a follow-on task.

### Codebase areas touched
- **Backend (main process):** `packages/desktop/src/overlay-window.ts` (new — OverlayWindowManager, 26 unit tests), `packages/desktop/src/overlay-preload.ts` (new — contextBridge bridge, 9 unit tests), `packages/desktop/src/overlay-controller.ts` (new — OverlayController interface + registry), `packages/desktop/src/main.ts` (extended — instantiation, registerOverlayController, detection forwarding, before-quit), `packages/desktop/src/window.ts` (panel alwaysOnTop → 'pop-up-menu')
- **Config:** `packages/desktop/forge.config.js` (overlay entry + extraResources `to: 'overlay/dist'`), `globals.d.ts`, `vitest.config.ts`, `tsconfig.tests.json`
- **Tests:** 181 total (181/181 pass). 26 new overlay-window tests (positioning presets, show/hide state, hotkey lifecycle, sendToRenderer guards), 9 new overlay-preload tests (API shape, subscribe/unsubscribe cycle, event arg stripping, IPC channel coverage).

### Reviewer notes
Merge PR #18 (TASK-0017) before PR #17 (TASK-0019) — both touch `settings.ts` and `overlay-controller.ts`; TASK-0017's versions are canonical and include all wiring. A non-blocking observation from round 1: the overlay hotkey is always registered at startup regardless of `overlay.enabled` (`setEnabled(false)` later unregisters it) — restart-after-disable re-registers it briefly. Minor UX inconsistency, not a blocker for this task's acceptance criteria.

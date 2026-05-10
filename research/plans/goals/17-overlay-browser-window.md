# Plan: TASK-0017 — Overlay BrowserWindow & Toggle Hotkey

**Branch:** goals/17-overlay-browser-window
**TRD:** research/plans/goals/17-overlay-browser-window-trd.md
**Task:** TASK-0017

---

## What exists coming in

- **TASK-0018 (shipped):** `packages/overlay/` — React renderer with App.tsx, useOverlayData, useOverlayPrefs, content-selection utils. Vite-built (base='./'). The renderer expects `window.kccOverlay` (defined in types.ts) which we must expose from overlay-preload.ts.
- **TASK-0019 (approved):** overlay electron-store schema (overlay.enabled/.hotkey/.opacity/.position/.size), OverlayController interface in overlay-controller.ts, all `overlay:*` IPC handlers in main.ts, settings UI. The OverlayController is a null stub until this task registers one.
- **PanelWindowManager** (window.ts): lazy BrowserWindow, `alwaysOnTop: true` (default level). Needs level upgrade to stay above overlay.
- **HotkeyManager** (hotkey.ts): pattern for registering/changing/unregistering a globalShortcut.

## Build order

### Slice 1 — Overlay preload
Create `packages/desktop/src/overlay-preload.ts`. Exposes `window.kccOverlay` (KccOverlayAPI from packages/overlay/src/types.ts) via contextBridge:
- `onAppChanged(callback)` — wraps ipcRenderer.on('detection:app-changed', ...)
- `getShortcutsForApp(slug)` — invokes shortcuts:get-by-app
- `getOverlayPrefs()` — invokes overlay:get

Tests: unit test the preload using Vitest + electron mock pattern (similar to existing test setup).

### Slice 2 — OverlayWindowManager
Create `packages/desktop/src/overlay-window.ts`. Class that:
- Lazily creates the overlay BrowserWindow on first `show()` call (avoids memory on startup when overlay is disabled).
- BrowserWindow config: frameless, transparent, always-on-top 'floating', click-through via setIgnoreMouseEvents(true, {forward: true}), skipTaskbar, webPreferences: contextIsolation, preload points to overlay preload webpack entry.
- Loads overlay renderer: `win.loadFile(path.join(__dirname, '../../../packages/overlay/dist/index.html'))` in production; in dev mode checks `OVERLAY_DEV_URL` env var (set by vite dev server) or falls back to loadFile.
- Implements OverlayController: setEnabled, setHotkey, setOpacity, setPosition, setSize.
  - setEnabled: shows or hides the window (creates it on first enable if not yet created).
  - setHotkey: unregisters old globalShortcut, registers new one.
  - setOpacity: sends 'overlay:prefs-changed' IPC to renderer webContents so live opacity updates work.
  - setPosition: repositions the window using getPositionForPreset() helper.
  - setSize: sends 'overlay:prefs-changed' to renderer.
- Positioning: `getPositionForPreset(position, size)` uses `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())` to find active monitor, then calculates x/y from preset string (Top Right, Top Left, etc.) and window dimensions.
- Z-order: overlay at 'floating' level; no further change needed in this file (panel will be raised in slice 3).
- Overlay hotkey: reads from getOverlayPrefs().hotkey on construction. Uses globalShortcut.register() directly (not HotkeyManager, which is panel-specific).
- Sends detection events to overlay renderer: public `sendToRenderer(channel, payload)` method.
- Memory: lazy BrowserWindow creation + limited DOM (managed by TASK-0018 renderer) keeps delta under 20MB target.

Tests: unit tests for positioning logic (getPositionForPreset), state machine (enabled→show, disabled→hide), hotkey registration (mock globalShortcut).

### Slice 3 — Panel z-order upgrade
In `window.ts` (PanelWindowManager): change `alwaysOnTop: true` to `alwaysOnTop: true` + call `win.setAlwaysOnTop(true, 'pop-up-menu')` after creation. This ensures the panel renders above the overlay's 'floating' level on both Windows and macOS.

### Slice 4 — Forge config
In `forge.config.js`: add third renderer entry for the overlay preload. The overlay HTML/JS are served from the Vite-built packages/overlay/dist in dev and production; only the preload is webpack-compiled. So we add a preload-only entry — electron-forge supports a preload-only entrypoint (no html/js, just preload.js).

Actually on review: electron-forge's webpack plugin needs an html+js pair to generate the `OVERLAY_WINDOW_WEBPACK_ENTRY` constant. We use a minimal stub HTML/JS in the desktop package that imports from packages/overlay, OR we skip the webpack constant and load via path string. Since the overlay uses Vite, we load via path — the preload is compiled separately via a standalone tsconfig.

Alternative cleaner approach: add the preload as a fourth preload-only webpack chunk (not a full entry). Use webpack to compile overlay-preload.ts separately from the main process. Then `win.loadFile(overlayDistPath)` + `webPreferences.preload` pointing to compiled preload path.

Decision for TRD: add overlay preload as part of existing webpack main entry (compiled with main process), reference it from OverlayWindowManager via `__dirname`. For the renderer: use `win.loadFile()` with Vite-built path. This avoids forge entry complexity.

### Slice 5 — main.ts wiring
In `main.ts` (app.whenReady()):
1. `import { OverlayWindowManager } from './overlay-window'`
2. `let overlayManager: OverlayWindowManager` — instantiate after other managers
3. If `getOverlayPrefs().enabled`, call `overlayManager.show()`
4. `registerOverlayController(overlayManager)` — wires TASK-0019's IPC handlers to the real controller
5. In the `emitToRenderer` callback for DetectionService: also call `overlayManager.sendToRenderer(channel, payload)`
6. `app.on('before-quit')`: call `overlayManager.destroy()` to release globalShortcut

### Slice 6 — Overlay package build integration
Add `"build:overlay": "npm run build -w @kcc/overlay"` to root package.json scripts. Add to desktop's `"dev"` prestart: build overlay package first (ensures dist exists). Add `packages/overlay/dist/` to extraResources in forge.config.js for production packaging.

### Slice 7 — Tests and verification
- Run Vitest: ensure all existing tests pass (173+)
- Run tsc on all three tsconfigs: clean
- Smoke test: start app, press overlay hotkey → overlay window appears. Check memory delta.
- Write unit tests for OverlayWindowManager positioning logic and OverlayPreload.

## Acceptance criteria checklist
- [ ] Overlay BrowserWindow is frameless, transparent, alwaysOnTop 'floating'
- [ ] Click-through via setIgnoreMouseEvents(true, {forward: true})
- [ ] Global hotkey toggles overlay show/hide
- [ ] Default hotkey Ctrl+Shift+O (Windows) / Cmd+Shift+O (macOS)
- [ ] Overlay prefs read from electron-store (no store schema redefined)
- [ ] Overlay appears on correct monitor (cursor-screen approximation)
- [ ] Panel renders above overlay (z-order)
- [ ] Memory delta <20MB
- [ ] No crash when hotkey pressed before detection service starts

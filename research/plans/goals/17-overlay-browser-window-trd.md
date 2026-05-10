# TRD: Overlay BrowserWindow & Toggle Hotkey

**Task:** TASK-0017
**Branch:** goals/17-overlay-browser-window
**PRD:** research/agents/prds/goal-06-overlay-mode.md
**Date:** 2026-05-10

---

## What we're building

TASK-0019 wired the overlay settings persistence (electron-store) and the IPC handler layer, and defined the `OverlayController` interface that bridges settings changes to a real window. TASK-0018 built the overlay React renderer (`packages/overlay/`). This task builds the missing piece: the Electron `BrowserWindow` that hosts that renderer, the preload script that exposes the IPC bridge (`window.kccOverlay`) the renderer depends on, the global hotkey that toggles it, and the wiring in `main.ts` that registers the concrete `OverlayWindowManager` as the `OverlayController`. After this task ships, the overlay feature is functionally complete at the window layer — detection content updates (TASK-0020) build on top of this.

## Technical components needed

**New backend components (main process):**
- `packages/desktop/src/overlay-window.ts` — `OverlayWindowManager` class: lazily creates the overlay `BrowserWindow` (frameless, transparent, `alwaysOnTop: 'floating'`, click-through), manages show/hide state, implements the `OverlayController` interface (setEnabled, setHotkey, setOpacity, setPosition, setSize), registers and hot-swaps the overlay `globalShortcut`, positions the window on the active monitor using `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())`, and exposes `sendToRenderer(channel, payload)` for forwarding detection events to the overlay renderer.
- `packages/desktop/src/overlay-preload.ts` — contextBridge preload for the overlay `BrowserWindow`. Exposes `window.kccOverlay` (typed `KccOverlayAPI` from `packages/overlay/src/types.ts`): `onAppChanged` (wraps `ipcRenderer.on('detection:app-changed', …)`), `getShortcutsForApp` (invokes `shortcuts:get-by-app`), `getOverlayPrefs` (invokes `overlay:get`). Follows the same `contextIsolation: true` / no `nodeIntegration` model as the panel and settings preloads.

**Modified backend components:**
- `packages/desktop/src/main.ts` — instantiate `OverlayWindowManager` in `app.whenReady()`; call `registerOverlayController(overlayManager)` to connect the TASK-0019 IPC handlers to the real window; extend the `emitToRenderer` DetectionService callback to also forward `detection:app-changed` to `overlayManager.sendToRenderer()`; call `overlayManager.destroy()` in `before-quit` to release the `globalShortcut`.
- `packages/desktop/src/window.ts` — upgrade `PanelWindowManager`'s alwaysOnTop to use level `'pop-up-menu'` (via `setAlwaysOnTop(true, 'pop-up-menu')` after window creation). This ensures the panel window always renders above the overlay window's `'floating'` level on both Windows and macOS, satisfying PRD Flow 6.
- `packages/desktop/forge.config.js` — add `packages/overlay/dist/` to `extraResources` so the Vite-built overlay renderer is bundled in the packaged app. Add the overlay preload as a compiled webpack chunk so the `OVERLAY_WINDOW_PRELOAD_WEBPACK_ENTRY` constant is available to `OverlayWindowManager`.
- Root `package.json` — add `"build:overlay"` script (`npm run build -w @kcc/overlay`) and wire it into the desktop dev/start flow so the Vite dist is always current before the Electron process launches.

**New frontend components:**
- None. `packages/overlay/` (TASK-0018) is the overlay renderer; this task provides the window and preload it runs inside.

**Schema changes:**
- No schema changes. `overlay.enabled`, `overlay.hotkey`, `overlay.opacity`, `overlay.position`, `overlay.size` are already in the electron-store schema from TASK-0019. This task reads those keys but does not add or rename any.

**API changes:**
- No new IPC channels. `overlay:get`, `overlay:set-*`, `shortcuts:get-by-app`, and `detection:app-changed` are all existing channels. `overlay-preload.ts` consumes them from the renderer side.

## Key architectural decisions

**Vite-built renderer via loadFile() rather than webpack entry.** The overlay renderer (`packages/overlay/`) uses Vite (with `base='./'`) — this is already set up by TASK-0018 specifically for Electron `loadFile()` usage. Adding a third webpack renderer entry would require cross-package tsconfig changes (JSX support, overlay src paths, React types in the desktop renderer tsconfig) and conflicts with the established Vite-in-overlay-package architecture. `OverlayWindowManager` loads the overlay using `win.loadFile(path.join(__dirname, '…/packages/overlay/dist/index.html'))` in production. In dev mode it checks `process.env.OVERLAY_DEV_URL` (set when running the Vite dev server separately) and falls back to `loadFile()`. This keeps both packages' build toolchains separate and clean.

**Overlay preload compiled by webpack (not Vite).** The preload script runs in a Node-adjacent context (contextBridge/ipcRenderer) and must be a CommonJS-compatible module. Webpack/ts-loader already handles this for the panel and settings preloads. `overlay-preload.ts` follows the same pattern and is compiled as part of the existing webpack main config, making its output path predictable via `OVERLAY_WINDOW_PRELOAD_WEBPACK_ENTRY`.

**Lazy BrowserWindow creation.** The overlay window is created on first `show()` call, not at startup. This keeps idle memory near zero when overlay is disabled (the default). The PRD memory target (<20MB additional) is met because the Chromium renderer process for the overlay only starts when the user enables the feature.

**Multi-monitor approximation via cursor position.** The detection service payload does not include the active window's screen coordinates — the native module exposes `processName`, `bundleId`, and `windowTitle` but not bounds. As an approximation, `OverlayWindowManager` uses `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())` to identify the active monitor. This is accurate when the user's cursor is on the same display as the active app (the overwhelmingly common case). A note in `proposals.md` will flag extending the native module to return window bounds in a future task for exact multi-monitor correctness.

**Panel z-order raised to 'pop-up-menu'.** The overlay uses `alwaysOnTop: true` at level `'floating'`. The panel's current `alwaysOnTop: true` uses Electron's default level, which is also `'floating'` on macOS and equivalent on Windows. To guarantee the panel is always above the overlay, we explicitly set the panel to `'pop-up-menu'` (one level above `'floating'` on both platforms). This is a targeted change to `window.ts` and does not affect panel behavior when the overlay window doesn't exist.

**Overlay hotkey managed by OverlayWindowManager directly.** The existing `HotkeyManager` (hotkey.ts) is panel-specific (hardwired to `panelManager.toggle()`). Rather than generalizing it, `OverlayWindowManager` manages its own `globalShortcut` registration (register/unregister/re-register on hotkey change). The two hotkeys are independent; the conflict check already lives in the `overlay:set-hotkey` IPC handler in `main.ts` (TASK-0019).

**Live prefs update via renderer IPC.** When `setOpacity()` or `setSize()` is called on the controller, `OverlayWindowManager` forwards the new values to the overlay renderer via `webContents.send('overlay:prefs-changed', prefs)`. The overlay renderer (TASK-0020 or a follow-up) can subscribe to this channel to react without a reload. For TASK-0017, the primary path is that prefs take effect when the overlay is next toggled — the `useOverlayPrefs` hook already fetches from `overlay:get` on mount.

## Test coverage plan

- **Unit tests (Vitest):**
  - `OverlayWindowManager` — positioning logic (`getPositionForPreset`): all 6 position presets × 2 size modes × 2 platform configurations; show/hide state machine (enabled false → no window created, enabled true → window created and shown, toggle behavior); hotkey registration/unregistration on `setHotkey()`; `sendToRenderer` guards (skips when window is null or destroyed).
  - `overlay-preload.ts` — contextBridge exposure matches `KccOverlayAPI` shape; `onAppChanged` subscribe/unsubscribe correctly wires `ipcRenderer.on`/`removeListener`.

- **Integration / E2E (Playwright):** Not practical for this layer (BrowserWindow creation requires a live Electron app). Covered by the happy-path smoke test described in the plan.

- **Regression:** All 173 existing tests must pass unchanged. The `window.ts` alwaysOnTop change must not break existing panel tests.

## Out of scope (technical)

- Overlay renderer content or React components (TASK-0018, shipped).
- Settings UI for overlay preferences (TASK-0019, approved).
- Detection integration / content updates when the active app changes (TASK-0020).
- Opacity live preview while the settings slider is dragged (future task — the `overlay:prefs-changed` IPC channel this task introduces is the hook for it, but the renderer-side subscription is TASK-0020's scope).
- Extending the native module to return active window bounds for exact multi-monitor placement (proposed in proposals.md, not this task).
- Linux/Wayland overlay support (Goal 10).
- Drag-to-reposition, free-form resize, fullscreen detection, multiple overlays.

## Risks and open questions

- **Webpack preload entry constant:** electron-forge's webpack plugin generates the `OVERLAY_WINDOW_PRELOAD_WEBPACK_ENTRY` constant automatically when a preload is specified in an entry point. If we compile the overlay preload separately (outside a full entry), the constant may not be generated. Resolution: add a minimal overlay entry to forge.config.js (stub HTML pointing to a zero-line JS stub; real preload is the compiled overlay-preload.ts). This is the same pattern as how settings_window uses `SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY`. The plan notes this and tests compilation before committing the approach.
- **packages/overlay dist path in dev mode:** `__dirname` in the webpack-compiled main process points to `.webpack/main/` — the relative path to `packages/overlay/dist/` must be verified empirically. `path.join(__dirname, '../../../packages/overlay/dist/index.html')` is the expected path but will be confirmed during build.
- **alwaysOnTop level cross-platform:** macOS and Windows have different window level orderings. `'pop-up-menu'` is reliably above `'floating'` on macOS; Windows behaviour is documented as equivalent. Will be verified in the integration smoke test.

# TRD: Electron App Shell — Tray Icon + Global Hotkey + Panel Window

**Task:** TASK-0006
**Branch:** goals/6-electron-app-shell
**PRD:** research/agents/prds/goal-03-desktop-app-shell.md
**Date:** 2026-05-09

---

## What we're building

TASK-0006 establishes the foundational Electron desktop shell for Keyboard Command Center. The PRD defines Goal 3 broadly (tray, hotkey, settings persistence, login startup, CI pipeline), but TASK-0006 covers only the structural core: a working tray icon, a global hotkey that toggles a frameless floating panel, placeholder panel content, and memory optimizations. Settings persistence, login startup, and CI pipeline are explicitly out of scope for this task and will be addressed in a follow-on Goal 3 task.

The technical problem is scaffolding a multi-process Electron app (main + renderer) in `packages/desktop` that boots into the system tray without a visible window, responds to a platform-specific global hotkey by showing/hiding a frameless BrowserWindow, and stays within the PRD's <50MB idle RAM target via hardware acceleration disablement and lazy window creation.

---

## Technical components needed

**New main-process modules (`packages/desktop/src/`):**
- `main.ts` — Electron entry point; disables hardware acceleration before app ready, acquires single-instance lock, wires up TrayManager/PanelWindowManager/HotkeyManager, handles app lifecycle events (quit, window-all-closed)
- `tray.ts` — `TrayManager` class; creates the system tray icon from a platform-appropriate asset, builds and attaches the context menu ("Open Keyboard Command Center", "Quit"), handles platform differences (Mac: setContextMenu on click; Windows: right-click = menu, left-click = show panel)
- `window.ts` — `PanelWindowManager` class; lazy BrowserWindow creation (null until first show request), frameless/always-on-top configuration, center-screen positioning at top-third offset, blur → hide behavior, public `show()` / `hide()` / `toggle()` interface
- `hotkey.ts` — `HotkeyManager` class; platform-aware default accelerator (`Cmd+Shift+Space` on macOS, `Ctrl+Shift+Space` on Windows), registers via Electron `globalShortcut`, logs warning if registration fails (OS conflict), unregisters on quit
- `preload.ts` — contextBridge preload; exposes `window.kcc.hidePanel()` to the renderer process (Escape key → IPC → main hides panel). Keeps `contextIsolation: true` and `nodeIntegration: false` throughout.

**New renderer (`packages/desktop/src/renderer/`):**
- `index.html` — Minimal HTML shell; loads compiled renderer JS and CSS
- `index.ts` — Renderer entry; attaches Escape keydown listener that calls `window.kcc.hidePanel()`; no framework dependencies — plain TypeScript only (Goal 5 will replace with React search UI)
- `app.css` — Dark-mode panel styling: near-black background, centered search bar stub (input with placeholder "Search shortcuts…"), subtle border-radius

**New package configuration:**
- `packages/desktop/tsconfig.json` — Electron-appropriate TypeScript config (CommonJS module, ES2020 target, extends root `tsconfig.json`); separate `tsconfig.renderer.json` for the renderer (same target but may use DOM lib)
- `packages/desktop/forge.config.js` (or `.ts`) — `electron-forge` configuration; TypeScript plugin or webpack plugin so `electron-forge start` transpiles `.ts` sources on the fly
- `assets/` — placeholder tray icon assets: `icon.png` (16×16) and `icon@2x.png` (32×32); macOS template convention (white-on-transparent)

**Modified packages:**
- `packages/desktop/package.json` — add dev dependency `@electron-forge/plugin-typescript` (or webpack equivalent) required for TypeScript support in electron-forge; add `electron-store` to dependencies if needed for a settings stub (deferred — TASK-0006 has no settings persistence)

**Shared types (`packages/core`):**
- No new types added in this task. `IApplication`, `IShortcut`, and related types from `@kcc/core` are imported in the renderer as a placeholder import to validate the cross-package dependency works. Meaningful use of these types begins in Goal 5.

---

## Key architectural decisions

**Frameless BrowserWindow for the panel.** Per PRD recommendation (matching Spotlight/Raycast/Alfred pattern), the panel uses `frame: false` with no OS chrome. Rounded corners and shadow are applied via renderer CSS. This avoids native window title bar UX on both platforms.

**Lazy window creation, hide-not-destroy.** The BrowserWindow is not created at startup — it is created on the first request to show the panel (hotkey or tray click). After that, it is hidden on dismiss and shown again on the next request. Creating and destroying windows repeatedly is expensive in Electron; hiding is cheap. This is the primary technique for keeping idle RAM low.

**`app.disableHardwareAcceleration()` at startup.** Called before `app.whenReady()`. This eliminates the GPU process that Electron spawns for hardware-accelerated rendering, saving ~20-40MB of RAM when the panel is hidden. The trade-off is slower panel animation — acceptable for a reference utility.

**Single renderer process.** Only one BrowserWindow exists at a time (the panel). No background renderer, no hidden windows. This keeps the process count and RAM footprint minimal.

**`contextIsolation: true`, `nodeIntegration: false`.** All IPC between renderer and main goes through the preload's contextBridge. The renderer has no direct access to Node.js APIs. This is required for Electron security best practices and will matter when the panel loads real shortcut data in Goal 5.

**No `electron-store` in TASK-0006.** Settings persistence (hotkey binding, startup preference) is out of scope. The hotkey accelerator is hard-coded (with platform default) in `HotkeyManager`. If needed later, `electron-store` will be introduced in the follow-on settings task.

**IPC for Escape dismissal.** The renderer cannot call `BrowserWindow.hide()` directly (renderer has no Node access). The preload exposes `window.kcc.hidePanel()` which sends `hide-panel` via `ipcRenderer`. Main listens on `ipcMain.on('hide-panel', ...)` and calls `panelWindow.hide()`. Focus-loss dismissal is handled entirely in the main process via `BrowserWindow.on('blur', ...)` — no IPC needed for that path.

---

## Test coverage plan

- **TypeScript compilation:** `tsc --noEmit` on `packages/desktop` must pass cleanly — this is the primary correctness gate for this task since Electron apps cannot be meaningfully unit-tested without a running environment.
- **Manual dev smoke test:** `npm run dev` in `packages/desktop` (or via workspace script) — tray icon appears, hotkey toggles panel, Escape dismisses, clicking outside dismisses. Documented in the PR description.
- **Memory measurement:** with app idle (panel hidden), main process logs `process.memoryUsage().rss` to console. Target: <50MB RSS. Actual measurement documented in PR.
- **No Playwright E2E for this task:** Playwright can drive Electron but requires the app to be fully packaged and running. Given the placeholder UI scope and no-CI environment, Playwright E2E is deferred to Goal 5 when real UI flows exist. This is called out as a carry-forward in the PR.

---

## Out of scope (technical)

- `app.setLoginItemSettings()` — login startup registration (follow-on Goal 3 task)
- `electron-store` configuration and settings UI (follow-on Goal 3 task)
- CI build pipeline with `electron-builder` (follow-on Goal 3 task)
- Code signing and notarization (Goal 9)
- Linux tray and hotkey support (Goal 10)
- Real shortcut data or search in the panel (Goal 5)
- Process/active window detection (Goal 4)
- Overlay mode (Goal 6)
- Playwright E2E tests (deferred to Goal 5 when real UI flows exist)

---

## Risks and open questions

**Electron-forge dependency installation:** `packages/desktop/node_modules` is currently sparse (only `@types/node` present). `npm install` must run from the workspace root to link workspace packages and install Electron + forge plugins. Electron itself is large (~200MB download) — first install may be slow or fail in a network-restricted CI environment. Will verify early in the build slice.

**Platform testing gap:** This run targets TypeScript correctness and architecture. Runtime verification of macOS template icons and Mac-specific hotkey behavior (`Cmd+Shift+Space`) cannot be confirmed in this Linux Docker environment. The Reviewer should note this as a known gap — cross-platform testing happens when the app runs on real hardware.

**<50MB idle RAM target:** The PRD acknowledges this is aggressive. With `disableHardwareAcceleration()` and lazy window creation, Electron's baseline is typically 35-50MB RSS on macOS. If measurement shows 50-65MB, this is acceptable per the PRD's own guidance ("60MB idle is still acceptable if the alternative is degraded functionality"). Actual numbers will be documented in the PR.

**`electron-forge` TypeScript plugin compatibility:** `@electron-forge/cli` v7 supports TypeScript via `@electron-forge/plugin-webpack` + `@vercel/webpack-asset-relocator-loader` or `@electron-forge/plugin-vite`. The exact plugin version and configuration will be determined during Slice 1 and documented in the plan update if the default doesn't work cleanly.

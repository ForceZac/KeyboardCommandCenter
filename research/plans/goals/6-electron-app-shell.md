# Plan: TASK-0006 — Electron App Shell (Tray + Hotkey + Panel)

**Task:** TASK-0006
**Branch:** goals/6-electron-app-shell
**PRD:** research/agents/prds/goal-03-desktop-app-shell.md
**TRD:** research/plans/goals/6-electron-app-shell-trd.md

---

## Goal

Scaffold a working Electron tray app in `packages/desktop` that satisfies all TASK-0006 acceptance criteria: tray icon with context menu, global hotkey that toggles a frameless floating panel, placeholder panel UI with Escape/blur dismissal, and memory optimizations. Nothing beyond this scope.

---

## Work breakdown

### Slice 1 — Package setup
- Add `tsconfig.json` to `packages/desktop` (extends root, configures Electron target)
- Add `forge.config.js` with webpack or TypeScript plugin so `electron-forge start` works
- Update `packages/desktop/package.json` to add `@electron-forge/plugin-webpack` (or `@electron-forge/plugin-typescript`) and `electron-store` if needed later; for now keep deps minimal
- Verify `npm install` works in the workspace

### Slice 2 — Main process skeleton (`src/main.ts`)
- Call `app.disableHardwareAcceleration()` before `app.whenReady()`
- Claim single-instance lock; quit if second instance detected
- Wire up TrayManager, PanelWindowManager, HotkeyManager after `app.whenReady()`
- Handle `window-all-closed` and `will-quit` (unregister shortcuts)

### Slice 3 — TrayManager (`src/tray.ts`)
- Load tray icon asset (platform-appropriate: template PNG for macOS, regular PNG for Windows)
- Build context menu: "Open Keyboard Command Center" (shows panel), "Quit"
- On Mac: `setContextMenu` called on every click (standard pattern)
- On Windows: right-click shows menu, left-click shows panel

### Slice 4 — PanelWindowManager (`src/window.ts`)
- Lazy BrowserWindow creation: window is `null` until first request to show
- `BrowserWindow` options: `frame: false`, `transparent: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `webPreferences: { preload, contextIsolation: true, nodeIntegration: false }`
- Position: center-screen, offset to top third (`y = screenHeight * 0.25`)
- On `blur` event: hide the window
- Expose `show()` and `hide()` methods

### Slice 5 — HotkeyManager (`src/hotkey.ts`)
- Platform default: `Cmd+Shift+Space` (Mac) or `Ctrl+Shift+Space` (Windows) using `process.platform`
- Register via `globalShortcut.register(accelerator, callback)`
- If registration fails (returns false), log a warning — no crash (conflict fallback is a Goal 3 follow-on: settings UI)
- Unregister all on app quit

### Slice 6 — Preload + IPC (`src/preload.ts`)
- `contextBridge.exposeInMainWorld('kcc', { hidePanel: () => ipcRenderer.send('hide-panel') })`
- In main, `ipcMain.on('hide-panel', () => panelWindow.hide())`

### Slice 7 — Renderer placeholder UI (`src/renderer/`)
- `index.html` — minimal HTML shell loading `index.ts`
- `index.ts` — keydown listener for Escape: `window.kcc.hidePanel()`
- `app.css` — dark background, centered search bar stub with placeholder text "Search shortcuts..."
- No framework dependencies — plain TypeScript + CSS only (Goal 5 will replace with React)

### Slice 8 — Asset scaffolding
- `assets/icon.png` — 16×16 white-on-transparent placeholder tray icon (macOS template convention)
- `assets/icon@2x.png` — 32×32 version
- Create with a minimal placeholder (1px transparent PNG or a simple generated asset)

### Slice 9 — Validation
- TypeScript compiles cleanly (`tsc --noEmit`)
- `npm run dev` launches the app (manual check — no CI at this stage)
- Document memory measurement: run app, open DevTools, check `process.memoryUsage()` in main process console

---

## Acceptance criteria mapping

| Criterion | Slice |
|---|---|
| `npm run dev` launches, settles to tray | 1, 2, 3 |
| Tray icon renders Win/Mac | 3, 8 |
| Right-click/click shows context menu | 3 |
| Global hotkey opens panel | 4, 5 |
| Panel dismisses on Escape | 6, 7 |
| Panel dismisses on focus loss | 4 |
| Subsequent hotkeys toggle visibility | 4, 5 |
| <50MB RAM idle | 2 (`disableHardwareAcceleration`) |
| TypeScript compiles with `@kcc/core` types | 1 |

---

## Order of commits

1. `chore(desktop): add tsconfig + forge config` — Slice 1
2. `feat(desktop): main process entry + app lifecycle` — Slice 2
3. `feat(desktop): TrayManager — tray icon + context menu` — Slice 3
4. `feat(desktop): PanelWindowManager — lazy floating panel` — Slice 4
5. `feat(desktop): HotkeyManager — global shortcut` — Slice 5
6. `feat(desktop): preload + hide-panel IPC` — Slice 6
7. `feat(desktop): placeholder renderer panel UI` — Slice 7
8. `chore(desktop): placeholder tray icon assets` — Slice 8
9. `FINAL: feat(goal-3): TASK-0006 complete — Electron app shell` — final commit after validation

---

## Risks

- **Electron-forge dependency resolution:** the desktop package node_modules is nearly empty; `npm install` may need to run in the workspace root or `packages/desktop` explicitly. Verify before building.
- **Platform testing:** CI-less environment means Mac-specific behavior (template icons, macOS hotkey) can't be verified in this Docker container. TypeScript correctness is the primary gate.
- **Hardware acceleration:** `disableHardwareAcceleration()` must be called before `app.whenReady()` — easy to accidentally place after.

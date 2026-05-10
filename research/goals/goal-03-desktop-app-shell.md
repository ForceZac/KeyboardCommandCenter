# Goal 3 — Desktop App Shell (Electron + Tray)

**Roadmap phase:** Phase 1 — Core Infrastructure
**PRD:** KeyboardCommandCenter/research/agents/prds/goal-03-desktop-app-shell.md

Goal 3 delivers the Electron desktop shell that makes Keyboard Command Center a background utility rather than a website you navigate to. It runs silently in the system tray, responds to a user-configurable global hotkey, and persists user preferences (hotkey binding and login startup) across restarts. This is the foundation every subsequent desktop goal (process detection, overlay, code signing) builds on.

---

## TASK-0006: Electron App Shell — Tray Icon + Global Hotkey + Panel Window
**PR:** #4 | **Branch:** goals/6-electron-app-shell | **Merged:** 2026-05-09

### What shipped
Bootstrapped the Electron app with Electron Forge + webpack, implementing a tray icon (`TrayManager`), a global hotkey (`HotkeyManager` with a hardcoded accelerator), and a panel `BrowserWindow` (`PanelWindowManager`) that shows/hides on hotkey press. Includes a preload script (`preload.ts`) exposing `hidePanel` via `contextBridge`, and a minimal panel renderer UI.

### Key technical decisions
- Lazy window creation (panel created on first show, not at startup) to minimize idle RAM
- `disableHardwareAcceleration()` called before `app.whenReady()` to eliminate GPU process overhead
- `contextIsolation: true`, `nodeIntegration: false` on all windows — security baseline set from the start
- Dock icon hidden on macOS (`app.dock.hide()`) — tray-only app pattern

### Codebase areas touched
- **Desktop:** `src/main.ts`, `src/tray.ts`, `src/window.ts`, `src/hotkey.ts`, `src/preload.ts`, `src/renderer/index.html/ts/css`, `forge.config.js`, `webpack.*.config.js`
- **Tests:** TypeScript typecheck only (tsc --noEmit); Playwright Electron E2E deferred (infra not yet set up)

### Reviewer notes
This task was built and merged outside the normal PRD/PM/backlog flow (process bypass via PROP-0001). The hotkey accelerator was hardcoded at this stage — TASK-0007 made it configurable.

---

## TASK-0007: Settings Persistence & Login Startup Registration
**PR:** #7 | **Branch:** goals/7-settings-persistence | **Approved:** 2026-05-10

### What shipped
Added `electron-store` settings persistence (`src/settings.ts`), a reconfigurable `HotkeyManager.changeBinding()` method that hot-swaps global shortcuts at runtime, a dedicated `SettingsWindowManager` (`src/settings-window.ts`) with its own preload (`src/settings-preload.ts`) and renderer UI (`src/renderer/settings.html/ts/css`), and a "Settings" tray menu item. IPC handlers in `main.ts` wire the settings renderer to the main process. Login startup is applied from the persisted preference on every launch via `app.setLoginItemSettings()`.

### Key technical decisions
- `electron-store@7.x` (CJS-compatible) over v8+ (ESM-only) to avoid ESM/CJS interop complexity with the existing CommonJS desktop package
- Separate `BrowserWindow` for settings (not embedded in the panel) — panel stays lightweight; settings window is infrequently used
- Two preload scripts, one per window — least-privilege: panel gets only `hidePanel`, settings window gets only `kccSettings`
- `globalShortcut.register()` return value as the conflict detector — authoritative OS result, no UI-level blocklist
- Webpack multi-entry resolved via forge plugin config (`settings_window` entry point) — the TRD risk item was a non-issue with `@electron-forge/plugin-webpack@7`

### Codebase areas touched
- **Desktop:** `src/settings.ts` (new), `src/settings-window.ts` (new), `src/settings-preload.ts` (new), `src/renderer/settings.html/ts/css` (new), `src/renderer/kccSettings.d.ts` (new), `src/hotkey.ts` (changeBinding added), `src/tray.ts` (onOpenSettings added), `src/main.ts` (IPC handlers + startup init), `src/globals.d.ts` (two new webpack globals), `forge.config.js` (second entry point)
- **Tests:** TypeScript typecheck clean on both tsconfigs; no Playwright Electron E2E (infra not yet set up — follow-on task)

### Reviewer notes
No automated Electron E2E coverage yet — this is a known gap acknowledged in the TRD. A follow-on infra task should wire up Playwright Electron to cover the settings flow. Minor: `HotkeyManager.changeBinding()` fallback re-registration (lines 49–52) has no success check on the restore path; if the restore also fails the app silently loses its hotkey until restart.

# Plan: TASK-0007 — Settings Persistence & Login Startup Registration

**Branch:** goals/7-settings-persistence
**PRD:** research/agents/prds/goal-03-desktop-app-shell.md
**Date:** 2026-05-10

---

## What we're building

Completing Goal 3's settings layer on top of the tray/hotkey/panel shell shipped in TASK-0006.
Three main pieces: a typed `electron-store` settings store, a configurable `HotkeyManager` that
can hot-swap bindings at runtime, and a Settings window (separate BrowserWindow + preload + renderer)
wired into the tray context menu.

## Work breakdown (implementation order)

### Slice 1 — `electron-store` settings module
- Add `electron-store` as a production dependency in `packages/desktop`
- Create `src/settings.ts` — typed wrapper exposing `getHotkey()`, `setHotkey()`, `getLoginStartup()`, `setLoginStartup()`
- Schema: `{ hotkey: string, loginStartup: boolean }` with safe defaults
- Unit-testable in isolation (no Electron dependency in the module itself beyond store init)

### Slice 2 — Dynamic HotkeyManager
- Update `src/hotkey.ts` to read initial binding from the settings store instead of a hardcoded constant
- Add `changeBinding(accelerator: string): { success: boolean; conflict: boolean }` method — unregisters old, registers new, persists on success
- Keep `register()` and `unregisterAll()` semantics intact

### Slice 3 — Settings BrowserWindow + preload
- Create `src/settings-window.ts` — `SettingsWindowManager` class that creates/shows a separate BrowserWindow
  - `contextIsolation: true`, `nodeIntegration: false`, separate preload script
  - Fixed size (e.g. 480×320), not resizable
- Create `src/settings-preload.ts` — exposes `kccSettings` API via `contextBridge`:
  - `getSettings()` → `{ hotkey, loginStartup }`
  - `setHotkey(accelerator)` → `{ success, conflict, message }`
  - `setLoginStartup(enabled)` → `void`
- Add IPC handlers in `main.ts`:
  - `settings:get` → return current settings
  - `settings:set-hotkey` → call `hotkeyManager.changeBinding()`, return result
  - `settings:set-login-startup` → call `app.setLoginItemSettings()` + persist

### Slice 4 — Settings renderer UI
- Create `src/renderer/settings.html` + `src/renderer/settings.ts` + `src/renderer/settings.css`
- Show current hotkey binding; "Change Hotkey" button enters recording mode (captures the next
  keydown combo and sends it via IPC)
- Show conflict message inline if registration fails
- Show "Start on login" toggle with current state
- Minimal, functional UI — no complex framework, just the existing vanilla TS renderer pattern

### Slice 5 — Tray menu update
- Update `src/tray.ts` to accept a `onOpenSettings` callback
- Insert "Settings" between "Open" and "Quit" in the context menu template
- Rebuild the context menu when called (needed for dynamic updates)

### Slice 6 — Login startup init
- In `main.ts`, on `app.whenReady()`, read `loginStartup` from settings and call `app.setLoginItemSettings()` to enforce the saved preference
- Default: enabled on first launch (store initialised with `loginStartup: true`)

### Slice 7 — Typecheck + wire-up
- Update `tsconfig.json` and `tsconfig.renderer.json` if new entry points need to be declared
- Update `forge.config.js` if a second webpack entry is needed for the settings window
- Run `npm run typecheck` (both tsconfigs) — must be clean

## Test plan
- No automated Electron E2E tests in scope (Playwright + Electron requires significant infra not yet set up)
- Manual smoke-test checklist in PR description:
  1. Tray menu shows Settings between Open and Quit
  2. Settings window opens and shows current hotkey + loginStartup toggle
  3. Changing hotkey — new binding registers, old one deregisters
  4. Conflict detection — attempting a known-taken binding shows message
  5. Toggle login startup off, kill + relaunch — startup pref persists
  6. Custom hotkey, kill + relaunch — new hotkey re-registers
- TypeScript clean (`npm run typecheck`) is the primary automated gate

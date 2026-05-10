# TRD: Settings Persistence & Login Startup Registration

**Task:** TASK-0007
**Branch:** goals/7-settings-persistence
**PRD:** research/agents/prds/goal-03-desktop-app-shell.md
**Date:** 2026-05-10

---

## What we're building

The PRD identifies two remaining Goal 3 gaps after TASK-0006 shipped the tray, hotkey, and panel:
(1) users cannot change the hardcoded hotkey binding, and (2) login startup is not configurable or
persisted. This task adds the settings layer: a typed `electron-store` JSON file that persists
`hotkey` and `loginStartup` across restarts, a reworked `HotkeyManager` that can hot-swap bindings
at runtime, and a Settings window (separate `BrowserWindow`) reachable from the tray context menu
where users record new hotkey combos and toggle login startup.

## Technical components needed

**New backend components (Electron main process):**
- `src/settings.ts` — Typed `SettingsStore` wrapper around `electron-store`. Holds the schema
  `{ hotkey: string, loginStartup: boolean }` with platform-appropriate defaults
  (`Cmd+Shift+Space` / `Ctrl+Shift+Space`, `loginStartup: true`). Needed because no other
  persistence mechanism exists for user preferences in the desktop package.
- `src/settings-window.ts` — `SettingsWindowManager` class. Creates and shows a separate
  `BrowserWindow` for the settings UI (`contextIsolation: true`, dedicated preload). Separate window
  keeps the panel lightweight and fast per PRD open question resolution.
- `src/settings-preload.ts` — Second preload script (for the settings window). Exposes
  `kccSettings` via `contextBridge` with three methods: `getSettings()`, `setHotkey(accelerator)`,
  `setLoginStartup(enabled)`. Required because the settings window has different IPC needs than the
  panel window.

**Modified backend components:**
- `src/hotkey.ts` — `HotkeyManager` made dynamic: reads initial accelerator from `SettingsStore`
  instead of a hardcoded string; gains `changeBinding(accelerator)` method that unregisters the
  current binding, attempts to register the new one (returning success/conflict), and persists on
  success. Existing `register()` and `unregisterAll()` semantics unchanged.
- `src/tray.ts` — `TrayManager` gains a second callback (`onOpenSettings`) and adds a "Settings"
  menu item between "Open" and "Quit" per PRD Flow 2.
- `src/main.ts` — Wires `SettingsStore` into `HotkeyManager` and `TrayManager` at startup; adds
  IPC handlers for `settings:get`, `settings:set-hotkey`, `settings:set-login-startup`; enforces
  the saved `loginStartup` preference via `app.setLoginItemSettings()` on first ready.

**New frontend components (settings renderer):**
- `src/renderer/settings.html` — Settings window shell; loaded by `SettingsWindowManager`.
- `src/renderer/settings.ts` — Settings UI logic: displays current hotkey, key-recording mode on
  "Change Hotkey" click (captures first keydown), shows conflict/success feedback inline, renders
  login startup toggle with current state and sends `setLoginStartup` on change.
- `src/renderer/settings.css` — Minimal styling for the settings window (consistent with the
  existing panel renderer aesthetic).

**Schema changes:**
No schema changes — settings are persisted in an `electron-store` JSON file on the user's filesystem
(`%APPDATA%/<AppName>/config.json` on Windows, `~/Library/Application Support/<AppName>/config.json`
on macOS). No database involved.

**API changes:**
No new HTTP API endpoints. New IPC channels (Electron main ↔ renderer):
- `settings:get` → `{ hotkey: string, loginStartup: boolean }`
- `settings:set-hotkey` (accelerator: string) → `{ success: boolean, conflict: boolean, message: string }`
- `settings:set-login-startup` (enabled: boolean) → `void`

## Key architectural decisions

- **`electron-store` over a manual JSON file** — `electron-store` handles safe atomic writes,
  schema migration, and platform path resolution. It's the standard Electron settings pattern and
  avoids re-implementing serialisation edge cases.
- **Separate BrowserWindow for settings** — The PRD explicitly recommends this over embedding
  settings in the panel. Panel stays fast (no settings state loaded unless opened); settings window
  is infrequently used and can afford a slightly heavier load.
- **Two preload scripts, one per window** — The panel preload (`src/preload.ts`) exposes only
  `hidePanel`. The settings preload (`src/settings-preload.ts`) exposes only `kccSettings`. Keeping
  them separate follows the principle of least privilege — each window gets only the IPC surface it
  needs.
- **Rely on Electron's `globalShortcut.register` return value for conflict detection** — Per the
  PRD open question, no blocklist. Electron's registration result is cross-platform and
  authoritative; a UI-level blocklist would diverge from actual OS behaviour.
- **`loginStartup: true` default** — PRD specifies "enabled by default on first launch". The store
  is initialised with this default; on first app launch, `app.setLoginItemSettings({ openAtLogin: true })`
  is called immediately.
- **No new webpack entry for the settings window at this time** — The existing Electron Forge +
  webpack config uses `MAIN_WINDOW_WEBPACK_ENTRY` / `MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY` globals
  injected by the plugin. If forge supports a second entry point via the plugin config, we'll use
  it; otherwise the settings window loads the HTML file directly from `__dirname` (acceptable for a
  non-shipping dev build). The exact webpack approach will be determined during implementation and
  documented in the plan file update.

## Test coverage plan

- **TypeScript typecheck** (`npm run typecheck` — both tsconfigs): primary automated gate. All new
  modules must typecheck cleanly with strict mode.
- **Manual smoke-test checklist** (in PR description): covers all PRD flows — tray menu item,
  settings window open, hotkey change + persistence, conflict detection, login startup toggle +
  persistence, kill+relaunch regression.
- **No Playwright E2E for Electron in this task** — Playwright Electron support requires packaging
  and a CI environment with a display. Out of scope for this task; noted as a future infra item.

## Out of scope (technical)

- Automated E2E tests for the Electron settings UI (Playwright + Electron infra not yet set up)
- Theming or visual customisation of the Settings window
- Multiple hotkey bindings (one global hotkey is sufficient per PRD)
- Linux support (PRD out-of-scope)
- CI/CD build pipeline (separate task, deferred)
- Any changes to `packages/web`, `packages/core`, `packages/overlay`, or `database/`

## Risks and open questions

- **Forge webpack multi-entry config** — Electron Forge's webpack plugin may or may not support a
  second named entry for the settings window out of the box. If it does not, loading the settings
  HTML directly from disk is a viable fallback for the dev build. Either way, typecheck must pass.
  Risk: low (falls back gracefully).
- **`electron-store` ESM/CJS compatibility** — `electron-store` v8+ is ESM-only. The existing
  desktop package uses CommonJS (Node.js `require`). We may need to pin to `electron-store@^7.x`
  (CJS-compatible) or add ESM interop. This will be confirmed at `npm install` time. Risk: low
  (pinning to v7 is a known pattern in Electron projects).
- **`globalShortcut` in dev mode** — Some key combos may behave differently in Electron's dev mode
  vs packaged app. Conflict detection UI will be tested in dev mode; known dev-mode quirks will be
  noted in the PR.

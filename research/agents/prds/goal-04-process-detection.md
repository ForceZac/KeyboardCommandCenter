# PRD: Goal 04 — Active Window Process Detection

**Status:** approved
**Author:** VaultBot (retroactive — Goal 4 implementation was already underway)
**Date:** 2026-05-10
**Roadmap section:** Goal 4: Active Window Process Detection

---

## Problem statement

The desktop app shell (Goal 3) exists but has no awareness of what the user is doing. Without knowing which application is in focus, the shortcut panel has nothing to pre-populate — users must manually search for the app they want every time they invoke the hotkey. This breaks the "instant lookup" promise. Goal 4 adds the intelligence layer: detect the active window, map the process to a known app, and surface that context to both the panel and the tray.

## User stories

- As a developer, I want the panel to automatically show shortcuts for whatever app I'm currently using, so I never have to manually select an app after invoking the hotkey.
- As a power user, I want my tray to show a "Recent Apps" submenu with the last 5 apps I used, so I can quickly jump to any of them without having the panel hotkey memorized.
- As a user, I want detection to be optional and toggleable, so I can disable it if I want privacy or reduced CPU usage.
- As a user, I want detection to work on both Windows and macOS, so the app is useful regardless of my platform.

## Success metrics

- Active window detection latency < 50ms per poll on Windows (Win32) and macOS (NSWorkspace).
- Process-to-app mapping covers all 50+ seeded apps.
- Tray "Recent Apps" submenu shows up to 5 apps, most recent first, updated on each tray menu open.
- CPU overhead of polling service < 1% on a modern machine at default 1500ms interval.
- Detection can be toggled on/off via Settings; state persists across restarts.
- No crashes or unhandled exceptions from native module failures (graceful degradation to null).

## UX flows

**Flow 1: Auto-detected app in panel**
1. User is working in VS Code (any recognized app).
2. Detection polling service fires every ~1500ms, calls `getActiveWindow()`, resolves to "vs-code" via `lookupApp()`.
3. User presses global hotkey.
4. Panel opens pre-loaded with VS Code shortcuts (no manual search required).
5. If user switches to Figma and re-opens panel, Figma shortcuts are shown automatically.

**Flow 2: Recently-detected apps in tray**
1. User right-clicks the tray icon.
2. Context menu shows a "Recent Apps" submenu between "Open" and "Settings".
3. Submenu lists up to 5 recently-used apps by display name, most recent first.
4. Clicking an app opens the shortcut panel pre-loaded with that app's shortcuts.
5. If no apps have been detected yet, submenu shows a disabled "No recent apps" item.
6. If detection is disabled in settings, submenu shows a disabled "Detection off" item.

**Flow 3: Unknown process**
1. User switches to an app not in the process map.
2. Detection service sends `appSlug: null` to renderer with the raw process name.
3. Panel shows a neutral "App not recognized" state.
4. Process name is appended to `~/.shortcutvault/unrecognized-processes.log` for future database expansion.

## Scope

### In scope
- Rust napi-rs native module (`packages/desktop/native/`) exposing `getActiveWindow()` with Win32 (QueryFullProcessImageNameW) and macOS (NSWorkspace) adapters (TASK-0009)
- Static JSON process-to-app mapping file covering all 50+ seeded apps with common aliases (TASK-0008)
- TypeScript `lookupApp(processName, bundleId?)` function returning app slug or null
- Background polling service in Electron main process: configurable interval (default 1500ms), debounced IPC emission on change, session memory for last 5 unique apps (TASK-0010)
- IPC channels: `detection:app-changed` (push) and `detection:get-recent-apps` (query)
- electron-store settings: detection enable/disable toggle (persists across restarts), polling interval
- Unrecognized process logging to `~/.shortcutvault/unrecognized-processes.log`
- Tray "Recent Apps" submenu: up to 5 apps, rebuilds on each tray menu open, graceful empty/disabled states (TASK-0011)

### Not in scope
- Linux process detection (Goal 10)
- Shortcut panel content or layout changes (Goal 5)
- Overlay mode (Goal 6)
- Persisting recent apps list across restarts
- Keystroke detection

## Technical notes

- Native module integrates with Electron Forge webpack pipeline via napi-rs
- TypeScript wrapper in `src/platform/active-window.ts` with graceful null on native module failure
- Polling service uses `setInterval`; stops cleanly when detection is disabled
- IPC only fires on app change (debounced), not on every tick — prevents renderer flooding
- Recent-apps list is an in-memory array (last 5 unique slugs), purged on app restart
- Tray submenu reads from recent-apps list via `detection:get-recent-apps` IPC on each menu build

## Tasks

| Task | Title | Status |
|------|-------|--------|
| TASK-0008 | Process-to-App Mapping Table | Shipped (PR #8) |
| TASK-0009 | Rust Native Module for Active Window Detection | Shipped (PR #9) |
| TASK-0010 | Detection Polling Service & IPC Integration | Shipped (PR #10) |
| TASK-0011 | Tray "Recent Apps" Submenu | Ready |

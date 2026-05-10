# PRD: Goal 03 — Desktop App Shell (Electron + Tray)

**Status:** draft
**Author:** Product Manager
**Date:** 2026-05-10
**Roadmap section:** Goal 3: Desktop App Shell (Electron + Tray)

---

## Problem

The web interface (Goal 2) works for browsing and searching shortcuts, but power users want shortcuts available instantly without opening a browser. A lightweight desktop app that lives in the system tray and responds to a global hotkey is the core differentiator — it makes shortcut lookup zero-friction. The app needs to feel invisible when idle (low memory, no dock presence) and instant when summoned.

The basic shell (tray icon, hotkey, panel window) shipped in TASK-0006. What remains is the settings layer: users need to customize their hotkey binding, control whether the app starts on login, and have those preferences survive restarts. Without persistent settings, the app is hardcoded to defaults the user can't change.

## User stories

- As a power user, I want to change the global hotkey to a binding that doesn't conflict with my other tools, so I can use ShortcutVault alongside apps like Alfred, Raycast, or IDE shortcuts.
- As a user, I want the app to start automatically when I log in, so I don't have to remember to launch it manually every session.
- As a user, I want to disable login startup if I prefer to launch manually, and have that preference remembered.
- As a user, I want my settings to persist across app restarts and updates, so I don't have to reconfigure after every relaunch.
- As a user, I want clear feedback when my chosen hotkey conflicts with another application, so I can pick a binding that works.

## UX flow

**Flow 1: First launch (already shipped)**
1. User installs and launches the app.
2. App starts in system tray — no main window, no dock icon (macOS).
3. Tray icon shows context menu: "Open ShortcutVault" and "Quit".
4. User presses default hotkey (Ctrl+Shift+Space / Cmd+Shift+Space) — floating panel appears centered in top third of screen.
5. User presses Escape or clicks outside — panel dismisses.

**Flow 2: Accessing settings**
1. User right-clicks the tray icon.
2. Context menu shows: "Open ShortcutVault", "Settings", "Quit".
3. User clicks "Settings" — a Settings window opens.

**Flow 3: Changing the global hotkey**
1. User opens Settings window.
2. Current hotkey binding is displayed (e.g. "Ctrl+Shift+Space").
3. User clicks "Change Hotkey" — input field enters recording mode.
4. User presses their desired key combination.
5. App validates the binding:
   - If the key combo is available: binding is saved, old hotkey unregistered, new hotkey registered immediately. Success confirmation shown.
   - If the key combo is already claimed by another app: notification explains the conflict, previous binding remains active. User can try a different combo.
6. New binding persists across app restarts.

**Flow 4: Toggling login startup**
1. User opens Settings window.
2. A toggle labeled "Start on login" is shown (enabled by default).
3. User toggles it off — app no longer registers as a login item.
4. User toggles it on — app registers via `app.setLoginItemSettings`.
5. Preference persists in local storage.

**Flow 5: App restart with saved settings**
1. User quits and relaunches the app (or system restarts).
2. App reads saved settings from `electron-store` JSON file.
3. Custom hotkey binding is re-registered (not the default).
4. Login startup state matches saved preference.
5. App resumes in tray with user's configuration intact.

## Success metrics

- App starts on login when enabled, does not start when disabled — verified on Windows and macOS.
- Custom hotkey binding survives app restart (kill + relaunch) — verified by changing hotkey, restarting, and confirming the new binding triggers the panel.
- Hotkey conflict detection works: attempting to bind a key combo claimed by the OS or another app shows a user-visible notification and does not break the existing binding.
- Settings window opens in <200ms from tray menu click.
- App idles at <50MB RAM with settings loaded (no regression from TASK-0006 baseline).
- Settings stored as a single JSON file via `electron-store` — file is human-readable and survives app updates.
- Tray context menu includes "Settings" between "Open" and "Quit".

## Scope

**In:**
- Settings window accessible from tray context menu
- `electron-store` integration for persistent local settings (JSON file)
- Configurable global hotkey:
  - Settings UI shows current binding
  - Key recording mode to capture new binding
  - Hot-swap: unregister old, register new, no restart required
  - Conflict detection with user-facing error message
- Login startup registration via `app.setLoginItemSettings`:
  - Enabled by default on first launch
  - Toggle in Settings UI
  - Persisted via electron-store
- "Settings" item in tray context menu (between "Open" and "Quit")
- Windows and macOS support

**Out:**
- CI/CD build pipeline (separate task, deferred)
- Real shortcut panel content (Goal 5)
- Process detection (Goal 4)
- Overlay mode (Goal 6)
- Code signing / notarization (Goal 9)
- Linux support (Goal 10)
- Auto-update mechanism (Goal 9)
- Installer UX or distribution (Goal 9)
- Theming or visual customization of Settings window
- Multiple hotkey bindings (one global hotkey is sufficient for now)

## Constraints and requirements

- **electron-store** for settings persistence — stores as JSON in the platform's default app data directory (`%APPDATA%` on Windows, `~/Library/Application Support/` on macOS). No database needed for settings.
- **Security:** Settings window must use `contextIsolation: true` and a preload script for IPC, consistent with the existing security model in the panel window.
- **Memory:** Settings feature must not increase idle memory above the 50MB target.
- **Hotkey registration:** Use Electron's `globalShortcut` API. Must handle the case where the OS rejects registration (e.g., reserved system shortcuts like Ctrl+Alt+Delete).
- **Login startup:** `app.setLoginItemSettings({ openAtLogin: true/false })`. On macOS, this uses Login Items (no helper app needed for basic support). On Windows, this uses the registry Run key.

## Open questions

- Should we validate hotkey bindings against a known blocklist of OS-reserved shortcuts (e.g., Ctrl+Alt+Delete, Cmd+Q), or rely solely on Electron's `globalShortcut.register` returning false? **Recommendation:** rely on Electron's registration result — it's authoritative and cross-platform. Add a blocklist only if we find cases where Electron silently accepts a binding that doesn't work.
- Should the Settings window be a separate BrowserWindow or a view within the panel? **Recommendation:** separate BrowserWindow — settings are accessed infrequently, and a separate window keeps the panel lightweight and fast.

## Dependencies

- **Goal 1** — Shortcut Data Schema (complete)
- **TASK-0006** — Electron App Shell (shipped) — provides the tray, hotkey, and panel infrastructure this task builds on

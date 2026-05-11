# Goal 10 — Linux Support

**Roadmap phase:** Phase 5 — Platform Expansion
**PRD:** KeyboardCommandCenter/research/agents/prds/goal-10-linux-support.md

Goal 10 extends Keyboard Command Center to Linux, the primary platform for developer power users who are among the most shortcut-conscious users in the market. It covers the full stack of Linux support: Rust-native active window detection for X11 (extending the macOS/Windows native module), Wayland detection via DBus for GNOME and KDE with a manual app-selection fallback for unsupported compositors, overlay compatibility with both display server protocols, and Linux desktop packaging (AppImage + .deb with CI support). Each task is scoped to a single layer of the stack so they can be reviewed and merged independently.

---

## TASK-0036: Rust Native Module — Linux X11 Active Window Detection
**PR:** #31 | **Branch:** goals/36-linux-x11-detection | **Approved:** 2026-05-11 (Round 2)

### What shipped
A Linux X11 backend for the Rust native module (`packages/desktop/native/`) that reads the active window's process name and window title via `libxcb` and the EWMH `_NET_ACTIVE_WINDOW` / `_NET_WM_PID` properties. The module compiles behind `cfg(target_os = "linux")` and is gated by a feature flag so Windows/macOS builds are unaffected. TypeScript detection service updated to dispatch to the new Linux adapter when platform is `linux`.

### Key technical decisions
- **libxcb over Xlib:** libxcb is async-safe and more idiomatic for Rust FFI; avoids the threading issues Xlib has under Electron.
- **EWMH properties for PID lookup:** `_NET_WM_PID` gives the process ID without requiring `ptrace` or `/proc` traversal; falls back gracefully when the property is absent.
- **Feature-gated compilation:** `[target.'cfg(target_os = "linux")'.dependencies]` in Cargo.toml keeps the native module buildable on all platforms.

### Codebase areas touched
- **Backend (Rust):** `packages/desktop/native/src/linux.rs` (new — X11 adapter), `packages/desktop/native/src/lib.rs` (platform dispatch)
- **Backend (TypeScript):** `packages/desktop/src/platform/active-window.ts` (Linux dispatch), `packages/desktop/src/detection.ts`
- **Tests:** Vitest integration tests for the TypeScript detection layer; Rust unit tests in `linux.rs`

### Reviewer notes
Round 2 addressed missing tests and a missing null-check when `_NET_WM_PID` is absent. Detection falls back to process name only in that case — acceptable given the rarity of EWMH-non-compliant X11 WMs.

---

## TASK-0037: Wayland Active Window Detection — GNOME & KDE DBus with Manual Fallback
**PR:** #32 | **Branch:** goals/37-wayland-active-window-detection | **Approved:** 2026-05-11 (Round 1)

### What shipped
Wayland active window detection via pure-Rust `zbus` (no `libdbus-1-dev` required). GNOME sessions use `org.gnome.Shell.Introspect`; KDE Plasma sessions use `org.kde.KWin.Scripting`. Unsupported compositors (Sway, Hyprland, etc.) or DBus failures return a `DetectionUnavailable` result. A "Select your app" dropdown renders in the panel header when detection is unavailable, with session persistence (last-used app first). A subtle banner explains the limitation to the user.

### Key technical decisions
- **zbus (pure Rust) over libdbus:** eliminates the `libdbus-1-dev` build dependency, simplifying CI and packaging.
- **`DetectionUnavailable` propagation:** flows from Rust → TypeScript → IPC → renderer cleanly; the renderer pattern-matches on the result type to show the manual fallback UI rather than hardcoding per-compositor branches in TypeScript.
- **Session persistence via `sessionStorage`:** manual app selection is forgotten on restart, which is the correct UX for a "best we can do on unsupported Wayland" fallback.

### Codebase areas touched
- **Backend (Rust):** `native/src/linux_session.rs`, `native/src/linux_wayland.rs`, `native/src/lib.rs`
- **Backend (TypeScript):** `detection.ts` (DetectionUnavailable branch), `platform/active-window.ts`
- **Frontend (renderer):** `wayland-unavailable.ts` (manual app selector UI, escHtml sanitization)
- **Tests:** 25 Vitest tests in `wayland-unavailable.test.ts`; mock DBus response parsing

### Reviewer notes
`escHtml` is applied to all user-visible values in the manual selector. The `DetectionUnavailable` path is entirely untested on real Wayland hardware; manual test matrix documented in plan file.

---

## TASK-0038: Overlay X11 Compatibility — Transparency & Click-Through
**PR:** #33 | **Branch:** goals/38-overlay-x11-compat | **Approved:** 2026-05-11 (Round 1)

### What shipped
The overlay window now works on Linux in two modes. X11: `BrowserWindow` created with `type: 'panel'` (maps to `_NET_WM_WINDOW_TYPE_DOCK` — keeps overlay above other windows), `setIgnoreMouseEvents(true, { forward: true })` for full click-through, `setAlwaysOnTop(true, 'floating')`. Wayland degraded mode: always-on-top without click-through (`setAlwaysOnTop(true, 'pop-up-menu')`), configurable auto-dismiss timer (default 8 s, 0 = never, resets on each `detection:app-changed` event), "Experimental" badge and dismiss timeout control in overlay settings. `overlay:is-supported` now returns `true` on all platforms; new `overlay:is-degraded` IPC returns `true` on Wayland. Tray icon creation wrapped in try-catch — graceful null fallback on headless/minimal WMs (i3, Sway) with startup log message.

### Key technical decisions
- **Session detection in TypeScript, not Rust:** `platform/linux-session.ts` reads `WAYLAND_DISPLAY` / `XDG_SESSION_TYPE` env vars directly in the Electron main process, cached at module load time. Avoids an IPC round-trip to the Rust module at overlay construction time.
- **`type: 'panel'` for X11 window type hint:** maps to `_NET_WM_WINDOW_TYPE_DOCK` via Electron's Linux BrowserWindow implementation — the correct compositor hint for overlays requiring always-on-top above fullscreen windows.
- **No `setIgnoreMouseEvents` on Wayland:** Electron's Ozone/Wayland backend does not implement mouse event forwarding; call is skipped to avoid the misleading no-op and potential breakage on future Electron versions.
- **Dismiss timer in `OverlayWindowManager`:** single private timer, cleared on `hide()` and `destroy()`, reset on each `detection:app-changed` so the overlay stays visible while the user is actively reading shortcuts.
- **Tray non-fatal:** consistent with existing `globalShortcut.register()` graceful failure pattern; `this.tray` set to `null`, all downstream calls guarded via optional chaining.

### Codebase areas touched
- **Backend:** `packages/desktop/src/platform/linux-session.ts` (new — detectLinuxSession, isWaylandSession, cached), `packages/desktop/src/overlay-window.ts` (X11/Wayland branch, dismiss timer), `packages/desktop/src/settings.ts` (waylandDismissTimeoutMs), `packages/desktop/src/main.ts` (IPC changes), `packages/desktop/src/tray.ts` (graceful failure)
- **Frontend (settings renderer):** `renderer/settings.html` (experimental badge, dismiss timeout row), `renderer/settings.ts` (conditional reveal), `settings-preload.ts` (isDegraded, setWaylandDismissTimeout), `renderer/kccSettings.d.ts` (type declarations)
- **Tests:** 43 new Vitest tests — `linux-session.test.ts` (14), `overlay-window.test.ts` (+16 timer/branch tests with fake timers), `overlay-settings.test.ts` (+9 Wayland timeout + preload surface), `tray.test.ts` (+4 graceful failure)

### Reviewer notes
No E2E tests — per PRD constraint; testing is manual on Ubuntu GNOME X11, Ubuntu GNOME Wayland, and Arch KDE X11 (documented in plan file). The dismiss timer fires `hide()` on detection events even when the overlay is hidden — `hide()` is null-safe and idempotent, so this is harmless. The `[hotkey]` placeholder in the tray startup log message is a literal string (the actual configured hotkey is not injected), consistent with the TRD spec — minor UX note for a follow-on task.

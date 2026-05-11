# TRD: Overlay X11 Compatibility — Transparency & Click-Through

**Task:** TASK-0038
**Branch:** goals/38-overlay-x11-compat
**PRD:** research/agents/prds/goal-10-linux-support.md
**Date:** 2026-05-11

---

## What we're building

The overlay window currently returns `false` from `overlay:is-supported` on Linux, hiding the feature entirely. This task makes the overlay work on Linux in two modes: full transparency + click-through on X11 (matching Windows/macOS), and a degraded always-on-top experience on Wayland that auto-dismisses on a configurable timeout. The task also handles tray icon absence gracefully on minimal window managers and adds an "experimental" label to the overlay settings UI when running under Wayland.

The PRD defines two distinct experiences: Flow 5 (X11 overlay — full parity) and Flow 6 (Wayland degraded overlay — always-on-top without click-through, auto-dismiss, "experimental" label). Both are in scope.

---

## Technical components needed

**New backend components:**
- `platform/linux-session.ts` — detects Wayland vs X11 at startup by reading `WAYLAND_DISPLAY` and `XDG_SESSION_TYPE` env vars; exports `detectLinuxSession(): 'x11' | 'wayland' | 'unknown'` and `isWaylandSession(): boolean`; result is cached at module load time so all callers share one detection

**Modified backend components:**
- `overlay-window.ts` — `getOrCreateWindow()` branches on Linux session type: on X11, adds `type: 'panel'` BrowserWindow option to set the `_NET_WM_WINDOW_TYPE_DOCK` X11 window type hint (needed for reliable always-on-top and click-through under compositors like Mutter/KWin on X11); on Wayland, omits `setIgnoreMouseEvents` (click-through is not reliably available on Wayland Electron); also adds dismiss timer logic: when running on Wayland, schedules `hide()` after `waylandDismissTimeoutMs` milliseconds on each `show()`, clears the timer on `hide()` and `destroy()`
- `settings.ts` — adds `waylandDismissTimeoutMs: number` (default: 8000) to `OverlayPrefs` interface and the `electron-store` schema; adds `getOverlayWaylandDismissTimeoutMs()` getter and `setOverlayWaylandDismissTimeoutMs(ms: number)` setter
- `main.ts` — changes `overlay:is-supported` handler to return `true` on all platforms including Linux (overlay now ships on Linux); adds new `overlay:is-degraded` handler returning `isWaylandSession()` (true when on Wayland — renderer uses this to show experimental badge and reveal the timeout setting); adds new `overlay:set-wayland-dismiss-timeout` handler that persists and forwards the value to `OverlayWindowManager`
- `tray.ts` — wraps `new Tray(icon)` in a try-catch; on failure, logs `'[kcc] No system tray detected — use [hotkey] to open the shortcut panel.'` and sets `this.tray = null`; all subsequent `this.tray` references guarded against null via optional chaining

**New frontend components:**
- None — overlay UI renders identically on all platforms; the "experimental" label and dismiss timeout control are in the settings window (vanilla TS renderer, not the overlay renderer)

**Modified frontend components:**
- `renderer/settings.html` — adds `<span id="overlay-experimental-badge">Experimental</span>` in the overlay fieldset legend (hidden by default); adds a new `overlay-row` for the Wayland dismiss timeout input (hidden by default, revealed by settings.ts when `isDegraded()` returns true)
- `renderer/settings.ts` — after loading overlay prefs, calls `window.kccSettings.overlay.isDegraded()`; if true, reveals the experimental badge and dismiss timeout row; wires the dismiss timeout input (`change` event) to `window.kccSettings.overlay.setWaylandDismissTimeout(ms)`
- `settings-preload.ts` — exposes `overlay.isDegraded()` and `overlay.setWaylandDismissTimeout(ms)` via contextBridge alongside existing overlay methods
- `renderer/kccSettings.d.ts` — adds `isDegraded(): Promise<boolean>` and `setWaylandDismissTimeout(ms: number): Promise<void>` to the `overlay` namespace type declaration

**Schema changes:**
- No database schema changes
- `OverlayPrefs` (electron-store schema in `settings.ts`) — adds `waylandDismissTimeoutMs: number`; backward-compatible (existing installs get the default value via electron-store's `defaults`)

**API changes (IPC):**
- `overlay:is-supported` — changes from `process.platform !== 'linux'` to `true`; now returns `true` on Linux (overlay supported, potentially degraded)
- New `overlay:is-degraded` — returns `boolean`; true when running on Wayland Linux
- New `overlay:set-wayland-dismiss-timeout` — accepts `{ timeoutMs: number }`; persists and forwards to overlay manager

---

## Key architectural decisions

- **Session detection in TypeScript, not Rust** — the overlay window is created in the Electron main process (TypeScript). Reading `WAYLAND_DISPLAY`/`XDG_SESSION_TYPE` directly in TypeScript avoids an IPC round-trip to the Rust module (which isn't started yet when the overlay manager is constructed). Consistent with how TASK-0037's Rust module reads the same env vars for the detection side.

- **`type: 'panel'` for X11 window type hint** — Electron's `BrowserWindow` `type` option maps to `_NET_WM_WINDOW_TYPE_DOCK` on Linux, which tells X11 compositors to always keep the window on top and above fullscreen windows. This is the correct approach for an overlay; no native FFI or additional crate needed.

- **No click-through on Wayland** — `setIgnoreMouseEvents(true)` is a no-op under Electron on Wayland (the Ozone/Wayland backend does not implement mouse event forwarding via the Wayland protocol). We don't call it on Wayland to avoid the misleading API call; instead we document the limitation and auto-dismiss as mitigation.

- **Auto-dismiss timer in `OverlayWindowManager`** — simpler than a separate service; the manager already owns show/hide. The timer is reset on each new detection event so the overlay stays up while the user is actively looking at shortcuts, and disappears after inactivity.

- **`overlay:is-supported` returns `true` on all platforms** — the overlay section is now shown on Linux. Callers use `overlay:is-degraded` to decide whether to show the experimental badge. This is cleaner than a ternary in `is-supported` and matches the PRD intent (overlay "ships on Linux, degraded on Wayland").

- **Tray failure is non-fatal** — consistent with PRD requirement and the precedent set by `globalShortcut.register()` failure handling in `hotkey.ts`. The app is fully functional via the global hotkey even without a tray icon.

---

## Test coverage plan

- **Unit tests (Vitest):**
  - `linux-session.test.ts` (new) — env var combinations (WAYLAND_DISPLAY set/unset, XDG_SESSION_TYPE x11/wayland/empty), caching behavior, `isWaylandSession()` return values
  - `overlay-window.test.ts` (additions) — Wayland branch skips `setIgnoreMouseEvents`; X11 branch includes `type: 'panel'`; dismiss timer fires `hide()` after timeout; timer cleared on `hide()`; timer reset on `sendToRenderer('detection:app-changed', ...)`
  - `overlay-preload.test.ts` (additions) — `isDegraded` and `setWaylandDismissTimeout` are exposed on the contextBridge surface
  - `tray.test.ts` (additions) — Tray constructor throws → catch logs startup message → `this.tray === null` → subsequent `refreshMenu()` / `destroy()` calls do not throw

- **No E2E tests** — per PRD constraint ("testing is manual"); the test matrix (Ubuntu GNOME X11, Ubuntu GNOME Wayland, Arch KDE X11) is documented in the plan file

---

## Out of scope (technical)

- `wlr-layer-shell` protocol integration for click-through on Sway/Hyprland (future goal)
- Wayland click-through on GNOME or KDE (not technically feasible without compositor protocol)
- New overlay UI components — the overlay renderer (packages/overlay/) is not modified; only the window creation and settings UI change
- AppImage/`.deb` packaging (TASK-0039)
- Landing page Linux download links (separate task)
- Detection feature changes — TASK-0038 uses existing `detection:app-changed` events; it does not modify detection logic

---

## Risks and open questions

- **`type: 'panel'` on X11** — behavior under different X11 compositors (Mutter on GNOME-X11, KWin on KDE-X11, Openbox, i3) needs manual testing. If `type: 'panel'` causes unexpected behavior (e.g., no frame that prevents `setIgnoreMouseEvents` from working), fall back to omitting `type` and relying on `setAlwaysOnTop(true, 'screen-saver')` level instead. TRD reviewer should note if this decision needs adjustment.

- **Wayland auto-dismiss UX** — 8 seconds default may be too short when a user is looking at many shortcuts. A future task could add a "keep open" toggle, but per PRD scope this is out of scope.

- **`overlay:is-degraded` preload naming** — the settings preload currently uses `window.kccSettings.overlay.*` naming. The new `isDegraded` method follows this convention; confirm with reviewer that this is the right namespace (alternative: `window.kccSettings.getLinuxSession()` as a platform API).

- **Dismiss timeout input units** — plan exposes the raw `ms` value to the renderer but shows seconds in the UI (0–60s range). The conversion (seconds in UI × 1000 = ms stored) needs to be consistent across the setter, getter, and display.

# Plan: TASK-0037 — Wayland Active Window Detection (GNOME & KDE DBus + Manual Fallback)

**Branch:** goals/37-wayland-active-window-detection
**PRD:** research/agents/prds/goal-10-linux-support.md (Flow 4)
**TRD:** research/plans/goals/37-wayland-active-window-detection-trd.md

---

## Goal

Extend the Rust native module (built in TASK-0036) to detect the Wayland session type at startup
and, when on Wayland, attempt compositor-specific active window detection via DBus (GNOME and KDE).
When detection is unavailable (unsupported compositor or DBus call fails), surface a `DetectionUnavailable`
result to the TypeScript layer, which renders a "Select your app" manual fallback UI in the panel header.

---

## Work breakdown

### Phase 1 — Rust: session type detection + dispatch

1. Add `zbus` crate to `Cargo.toml` under `[target.'cfg(target_os = "linux")'.dependencies]`.
2. Create `src/platform/linux_session.rs`:
   - `pub fn detect_session() -> SessionType` — reads `WAYLAND_DISPLAY` / `XDG_SESSION_TYPE` env vars.
   - Returns `SessionType::Wayland` or `SessionType::X11`.
3. Refactor `src/platform/linux.rs` (from TASK-0036):
   - Rename the existing detection logic to `linux_x11.rs` (or factor into a sub-module).
   - The public `get_active_window()` entry point in `linux.rs` calls `detect_session()` and dispatches
     to `linux_x11::get_active_window()` (X11 path) or `linux_wayland::get_active_window()` (Wayland path).
4. Create `src/platform/linux_wayland.rs`:
   - `pub fn get_active_window() -> Option<ActiveWindowResult>` — tries GNOME DBus, then KDE DBus,
     returns `ActiveWindowResult::Unavailable` for any other compositor or DBus failure.
   - `gnome_detect()` — calls `org.gnome.Shell.Introspect` → `GetRunningApplications` / focused window API.
   - `kde_detect()` — calls `org.kde.KWin.Scripting` to query active window properties.
5. Extend `ActiveWindowData` / napi-rs export in `lib.rs`:
   - The JS-visible return type gains an optional `detectionUnavailable: boolean` field (or a discriminated
     result type). When `true`, `processName` and `windowTitle` are empty strings.
6. Add unit tests in `src/platform/tests/`:
   - `session_detection_tests.rs` — tests for `WAYLAND_DISPLAY` / `XDG_SESSION_TYPE` parsing.
   - `wayland_dbus_tests.rs` — tests for DBus response parsing logic (mock responses as byte payloads).

### Phase 2 — TypeScript: IPC + state

7. Update `packages/desktop/src/detection/active-window.ts` to handle `detectionUnavailable: true`:
   - Emit a new IPC event `detection:unavailable` to the renderer when the native module returns this state.
   - Persist the `detectionUnavailable` flag in the polling state.
8. Update preload to expose `detection:unavailable` IPC channel.

### Phase 3 — Frontend: manual fallback UI

9. `packages/desktop/src/renderer/components/ManualAppSelector.tsx` — "Select your app" search dropdown:
   - Fetches app list from `packages/desktop` (core app list, already used for process mapping).
   - Shows last-used app first (persisted in localStorage or Electron `store` for session).
   - On selection, fires `ipc.setManualApp(appId)` which overrides the active-app detection result.
10. `packages/desktop/src/renderer/components/WaylandBanner.tsx` — subtle info banner:
    - Text: "Automatic app detection isn't available on your Wayland compositor. Pick your app manually."
    - Dismissible per session.
11. Wire into `PanelHeader` (or equivalent panel root component): render `ManualAppSelector` +
    `WaylandBanner` when `detectionUnavailable` is true.

### Phase 4 — Tests

12. Vitest unit tests for the IPC `detection:unavailable` handler.
13. Manual test matrix documented (no automated E2E — per PRD constraints).

---

## Order of operations

1. Rust changes first (session detection, dispatch, wayland adapter, unit tests)
2. TypeScript IPC plumbing
3. Frontend manual fallback UI components
4. Vitest unit tests for IPC handler
5. Commit each slice, push after every commit

---

## What is NOT in this plan

- X11 detection (TASK-0036)
- Overlay Wayland support (TASK-0038)
- wlr-layer-shell integration
- Packaging or CI
- Compositors beyond GNOME and KDE for active detection

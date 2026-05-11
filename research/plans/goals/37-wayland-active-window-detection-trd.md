# TRD: Wayland Active Window Detection — GNOME & KDE DBus with Manual Fallback

**Task:** TASK-0037
**Branch:** goals/37-wayland-active-window-detection
**PRD:** research/agents/prds/goal-10-linux-support.md (Flow 4: Active window detection on Wayland)
**Date:** 2026-05-11

---

## What we're building

TASK-0036 added X11 active window detection to the Rust native module. This task extends that module
to handle Wayland sessions. On Wayland, compositor-specific DBus APIs are the only reliable way to
identify the focused window — the X11 `_NET_ACTIVE_WINDOW` EWMH property is not available. For GNOME
and KDE Plasma (the two compositors that provide stable DBus introspection APIs), we query the focused
window via `org.gnome.Shell.Introspect` and `org.kde.KWin.Scripting` respectively. For all other
compositors (Sway, Hyprland, Mutter-based non-GNOME, etc.), we return a `DetectionUnavailable` sentinel
that the TypeScript layer translates into a manual app-selection UI in the panel header, matching the
PRD's "best-effort with fallback" requirement.

---

## Technical components needed

### New backend components (Rust, `packages/desktop/native/`)

- **`src/platform/linux_session.rs`** — session type detector. Reads `WAYLAND_DISPLAY` and
  `XDG_SESSION_TYPE` env vars to return a `SessionType` enum (`X11` | `Wayland`). Needed to gate
  the Wayland code path at runtime without guessing from display state.

- **`src/platform/linux_wayland.rs`** — Wayland detection adapter. Exposes a single public entry
  point that tries GNOME DBus, then KDE DBus, then returns `DetectionUnavailable`. Uses the `zbus`
  crate for DBus communication. Two internal functions: one per compositor. Needed to isolate
  compositor-specific protocol details from the shared dispatch logic.

### Modified backend components (Rust)

- **`src/platform/linux.rs`** (TASK-0036) — the public `get_active_window()` function is updated
  to call `linux_session::detect_session()` and dispatch to the existing X11 path (unchanged logic)
  or to `linux_wayland::get_active_window()`. No changes to the X11 detection logic itself.

- **`src/lib.rs`** (napi-rs export) — the exported `ActiveWindowInfo` struct gains a
  `detection_unavailable: bool` field. The JS API stays backward-compatible: this field is `false`
  on every current code path (macOS, Windows, X11), and `true` only when the Wayland adapter cannot
  identify the focused app. `process_name` and `window_title` are empty strings when unavailable.

- **`Cargo.toml`** — adds `zbus = { version = "4", features = ["tokio"] }` under the existing
  `[target.'cfg(target_os = "linux")'.dependencies]` block. `zbus` provides async DBus calls;
  tokio feature brings in the async runtime already present in the binary via napi-rs.

### Modified backend components (TypeScript, `packages/desktop/`)

- **`src/detection/active-window.ts`** — the polling loop that calls the native module already
  handles `None` from the X11 path. It is extended to check `detectionUnavailable` and, when true,
  emit `detection:unavailable` via IPC to the renderer instead of `detection:app-changed`. The
  manual app override set by the user (`setManualApp` IPC) is stored in process memory and injected
  into the polling loop's return value so the panel displays the correct app.

- **`src/preload/index.ts`** (or equivalent preload file) — exposes two new IPC channels to the
  renderer:
  - `detection:unavailable` — main → renderer push (event, no payload needed)
  - `detection:set-manual-app` — renderer → main invoke (payload: `appId: string`)

### New frontend components (`packages/desktop/src/renderer/components/`)

- **`ManualAppSelector.tsx`** — a search-as-you-type dropdown that renders in the panel header when
  `detectionUnavailable` is true. Fetches the app list from the existing IPC channel that serves app
  data to the panel. Stores the last-used app in `sessionStorage` (sufficient for session persistence —
  clears on restart). Fires `detection:set-manual-app` on selection. Last-used app appears first
  in the list.

- **`WaylandBanner.tsx`** — a one-line info bar rendered above the shortcut list when
  `detectionUnavailable` is true. Text: "Automatic app detection isn't available on your Wayland
  compositor. Pick your app manually." Dismissible per session (dismiss state in `sessionStorage`).

### API changes (IPC)

- `detection:unavailable` — new push event, main → renderer. Fired when the native module returns
  `detectionUnavailable: true`. No payload.
- `detection:set-manual-app` — new invoke handler, renderer → main. Payload: `{ appId: string }`.
  Main stores the selection and uses it as the active app for the current session.

### Schema changes

None. Manual app selection is session-only state (in-memory on the main process side, `sessionStorage`
on the renderer side). No Electron Store writes needed.

---

## Key architectural decisions

- **`zbus` over raw DBus FFI** — `zbus` is a pure-Rust async DBus library with no C runtime
  dependency (`libdbus-1-dev` is not needed). This keeps the build simpler and avoids the complexity
  of linking against system libdbus across distributions.

- **Dispatch in `linux.rs`, not in `mod.rs`** — the existing platform dispatch in `mod.rs` branches
  on `target_os`. Wayland vs. X11 is a runtime distinction, not a compile-time one, so the dispatch
  lives inside the Linux branch in `linux.rs`. The `mod.rs` interface is unchanged, which keeps the
  macOS and Windows paths untouched.

- **`detectionUnavailable` as a field, not a new return type** — changing the napi-rs return type to
  a discriminated union would require client-side type narrowing in every existing consumer. Adding a
  boolean field is backward-compatible: all non-Linux and X11 paths set it to `false`, and the renderer
  only needs to check it in one place (the panel root).

- **`sessionStorage` for manual selection persistence** — the PRD says "persists for the session
  (last-used app first)." Using `sessionStorage` in the renderer and in-memory state in main maps
  directly to that requirement with zero infrastructure: the selection resets on app restart, which
  is the right behavior for a "session" scope.

- **`GNOME Shell Introspect` over `Shell.Eval`** — per the PRD open question recommendation.
  `org.gnome.Shell.Eval` is deprecated and disabled by default in GNOME 45+. `org.gnome.Shell.Introspect`
  is the stable intended API and does not require a special GNOME extension. If the user hasn't
  granted permission, the DBus call fails and we fall through to `DetectionUnavailable` — no special
  prompt in this task (v1 scope).

---

## Test coverage plan

- **Unit tests (Rust, `src/platform/tests/`):**
  - Session detection: env var combinations (`WAYLAND_DISPLAY` set, `XDG_SESSION_TYPE=wayland`,
    `XDG_SESSION_TYPE=x11`, neither set → default X11).
  - DBus response parsing: feed mock `zbus::Message` payloads to the GNOME and KDE parsing functions;
    assert correct `process_name` and `window_title` extraction.
  - `DetectionUnavailable` propagation: when both DBus adapters return `None`, the wayland adapter
    returns `ActiveWindowResult::Unavailable` and `lib.rs` sets `detection_unavailable: true`.

- **Vitest unit tests (`packages/desktop/`):**
  - `active-window.test.ts`: mock native module returning `detectionUnavailable: true`; assert
    `detection:unavailable` IPC event is emitted and `detection:set-manual-app` handler stores the
    manual override and returns it on the next poll.

- **No automated E2E tests** — per PRD constraint ("Testing is manual"). The manual test matrix
  (Ubuntu/GNOME/Wayland, Ubuntu/X11, KDE/Wayland, unsupported compositor) is documented in the
  plan file.

---

## Out of scope (technical)

- X11 detection logic changes (TASK-0036 owns that path)
- Overlay Wayland behavior (TASK-0038)
- `wlr-layer-shell` compositor integration
- GNOME permission prompt for `Shell.Introspect` (v2)
- Sway, Hyprland, and other compositor-specific detection (unsupported → `DetectionUnavailable`)
- AppImage / `.deb` packaging and CI changes
- Wayland click-through for overlay

---

## Risks and open questions

- **`org.gnome.Shell.Introspect` API shape** — the exact method name and return type on the
  `GetRunningApplications` / focused window path should be confirmed against GNOME Shell source before
  implementation. If the API differs from docs, the unit tests (which mock responses) will still pass,
  but the real DBus calls will fail at runtime and fall through to `DetectionUnavailable` gracefully.

- **KDE DBus scripting stability** — `org.kde.KWin.Scripting` is documented but the scripting
  interface used to query active window requires loading a JS script into KWin at runtime. The
  alternative `org.kde.KWin.VirtualDesktopManager` or `org.kde.KWin.PlasmaWindow` interfaces may
  be more appropriate. Implementation should confirm the correct DBus path against current KWin docs.

- **TASK-0036 not yet merged** — this branch is created from `main`, which does not include
  `goals/36-linux-x11-detection`. The `linux.rs` platform adapter we extend here does not exist
  on `main`. The TRD is written assuming TASK-0036 will be merged before this branch's code is built.
  If both tasks need to be built simultaneously, this branch will need to be rebased onto
  `goals/36-linux-x11-detection`. Note this for the Reviewer.

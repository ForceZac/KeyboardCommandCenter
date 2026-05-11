# Plan: TASK-0036 — Rust Native Module — Linux X11 Active Window Detection

**Branch:** goals/36-linux-x11-detection
**PRD:** research/agents/prds/goal-10-linux-support.md
**TRD:** research/plans/goals/36-linux-x11-detection-trd.md

---

## Work breakdown

### 1. Cargo.toml — add Linux X11 dependency
- Add `[target.'cfg(target_os = "linux")'.dependencies]` block with `x11rb` crate (pure-Rust X11 bindings, safe API)
- Only compiled on Linux; no effect on Windows/macOS builds

### 2. src/platform/linux.rs — new Linux adapter
- Implement `pub fn get_active_window() -> Option<ActiveWindowData>`
- Step 1: connect to X11 display via `x11rb::connect(None)`
- Step 2: get root window, query `_NET_ACTIVE_WINDOW` atom for currently focused window ID
- Step 3: query `_NET_WM_PID` on the active window to obtain PID
- Step 4: read `/proc/<pid>/comm` for process name (up to 15 chars — may be truncated)
- Step 5: if comm is exactly 15 characters (possible truncation), also read `/proc/<pid>/cmdline` and use `argv[0]` basename as a higher-fidelity name
- Step 6: query `_NET_WM_NAME` or `WM_NAME` on the active window for the window title
- Return `ActiveWindowData { process_name, window_title, bundle_id: None }`
- Full fallback chain: if `_NET_ACTIVE_WINDOW` fails, try `XGetInputFocus` equivalent via x11rb

### 3. src/platform/mod.rs — wire Linux adapter into dispatch
- Add `#[cfg(target_os = "linux")] mod linux;`
- Add `#[cfg(target_os = "linux")] return linux::get_active_window();` in `get_active_window_info()`
- Remove the existing `// Unsupported platform` None fallback (or keep it for truly unknown platforms)

### 4. process-map.json — add Linux-specific process name entries
- Add 30+ Linux process name → app-id mappings to `byProcess`
- Focus on: process names that differ from Windows/macOS entries, truncated `/proc/comm` variants, and Linux-native apps
- Add any new `displayNames` entries needed for Linux-only apps

### 5. Unit tests — src/platform/linux.rs (test module)
- Test: comm name exactly 15 chars → fallback to cmdline parsing is exercised (logic test, no X11 server needed)
- Test: proc name reading logic with mock file content
- All tests guarded behind `#[cfg(target_os = "linux")]`

### 6. Integration test stubs
- Add integration test stubs in a `tests/` directory or inline in linux.rs
- Guard with `#[cfg(all(target_os = "linux", test))]`
- Stubs document the manual test matrix (actual X11 call requires a live X11 session — skip in CI)

## Build order

1. Cargo.toml (dependency gate — must compile before anything else)
2. linux.rs adapter (new file)
3. platform/mod.rs update (wire it in)
4. process-map.json additions
5. Unit tests in linux.rs
6. Integration test stubs

## What's NOT in this task
- Wayland detection (TASK-0037)
- Overlay window X11 hints (Goal 10, later task)
- AppImage/.deb packaging (TASK-0038)
- CI pipeline changes
- Landing page Linux download links
- TypeScript-side process-map.ts changes (the JSON is read directly — no changes needed)

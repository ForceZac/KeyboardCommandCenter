# TRD: Rust Native Module — Linux X11 Active Window Detection

**Task:** TASK-0036
**Branch:** goals/36-linux-x11-detection
**PRD:** research/agents/prds/goal-10-linux-support.md
**Date:** 2026-05-11

---

## What we're building

The Rust native module (`packages/desktop/native/`) currently returns `None` for all non-Windows, non-macOS platforms. This task adds a `cfg(target_os = "linux")` implementation that detects the active window on X11 sessions, matching the `ActiveWindowInfo` shape that Windows and macOS adapters already return. We also extend `process-map.json` with Linux-specific process name entries (including truncated `/proc/comm` variants) so the TypeScript mapping layer resolves Linux process names correctly. This covers PRD Flow 3 (X11 active window detection).

## Technical components needed

**New backend components:**
- `src/platform/linux.rs` — X11 platform adapter implementing `get_active_window() -> Option<ActiveWindowData>`; reads `_NET_ACTIVE_WINDOW` from the root window to find the focused window, queries `_NET_WM_PID` to get its PID, then resolves the process name from `/proc/<pid>/comm` with `/proc/<pid>/cmdline` fallback for truncated names; queries `_NET_WM_NAME` or `WM_NAME` for the window title

**Modified backend components:**
- `src/platform/mod.rs` — add `#[cfg(target_os = "linux")] mod linux;` and a Linux dispatch arm in `get_active_window_info()`; the existing `#[cfg(not(any(target_os = "macos", target_os = "windows")))] None` fallback becomes the Linux adapter's call site
- `Cargo.toml` — add `[target.'cfg(target_os = "linux")'.dependencies]` block with `x11rb = { version = "0.13", features = ["allow-unsafe-code"] }` (pure-Rust X11 bindings); no effect on Windows/macOS builds

**New frontend components:**
- None

**Schema changes:**
- No schema changes

**API changes:**
- No new endpoints — the existing `getActiveWindow()` N-API export already surfaces whatever the platform adapter returns; Linux will now return data instead of `null`

**Data changes:**
- `packages/desktop/src/process-map.json` (`byProcess` section) — add 30+ Linux process name entries for apps already in the database. Key additions include:
  - **Firefox variants:** `firefox-esr`, `firefox` (already present as lowercase), `waterfox`, `librewolf`
  - **Chrome/Chromium:** `google-chrome`, `google-chrome-s` (15-char truncation of `google-chrome-stable`), `chromium`, `chromium-browser`
  - **VS Code:** `code` (already present), `code-insiders`
  - **GIMP:** `gimp`, `gimp-2.10`, `gimp-2.99`, `gimp-3.0`
  - **JetBrains IDEs (Linux executables):** `idea.sh`, `webstorm.sh`, `pycharm.sh`, `goland.sh`, `clion.sh`, `clion`
  - **Slack:** `slack` (already present); Linux binary name matches
  - **Discord:** `discord` (already present); `Discord` (capitalized variant)
  - **Blender:** `blender` (already present); no truncation issue
  - **Neovim:** `nvim` (already present)
  - **Emacs:** `emacs` (already present); `emacs-30.1`
  - **OBS:** `obs` (already present); `com.obsproject.` (Flatpak prefix — process name truncates)
  - **Sublime Text:** `subl` (already present); `sublime_text`
  - **Spotify:** `spotify` (already present)
  - **Steam:** `steam` (already present); `steam-runtime`, `pressure-ves` (15-char truncation of `pressure-vessel-*`)
  - **LibreOffice:** `soffice` (LibreOffice main process), `soffice.bin`
  - **Terminal emulators (Linux-only apps):** `gnome-terminal`, `gnome-termina` (15-char truncation of `gnome-terminal-server`), `konsole`, `xterm`, `alacritty`, `kitty`, `tilix`, `terminator`
  - These map to app IDs that already exist or will need display name entries

## Key architectural decisions

- **`x11rb` over `xcb` bindings:** `x11rb` is a pure-Rust, safe X11 client library with an idiomatic API. The `xcb` crate wraps the C `libxcb` library, requiring a C toolchain and `-lxcb` link at runtime. `x11rb` produces a fully static X11 client, simplifying the AppImage dependency story — no `libxcb.so` needed at runtime when linked statically. It also produces cleaner Rust code without unsafe blocks for the core connection/request flow.

- **`_NET_ACTIVE_WINDOW` as primary detection path:** This EWMH property is set by virtually all modern X11 window managers (Openbox, i3, Xfce's Xfwm, Metacity, etc.) on the root window. It points to the currently focused window. This is the same approach used by tools like `xdotool` and `xprop`. If the atom is not set (some minimal WMs), the code falls back to `x11rb`'s equivalent of `XGetInputFocus` to get the focused window directly.

- **`_NET_WM_PID` → `/proc/<pid>/comm` for process name:** Rather than querying `_NET_WM_NAME` alone (which is the window title, not the process name), we get the PID from the window's `_NET_WM_PID` property and read the process name from `/proc`. This matches the PRD's Flow 3 description and is more reliable than parsing window titles (which are app-defined and highly variable). A window that doesn't set `_NET_WM_PID` is handled by returning `None`.

- **15-char `/proc/comm` truncation handling:** Linux's `/proc/<pid>/comm` is capped at 15 characters (TASK_COMM_LEN = 16 including null terminator). Any process name longer than 15 chars will be silently truncated. We detect this by checking `comm.len() == 15` and, if so, also reading `/proc/<pid>/cmdline` to get the full `argv[0]`, stripping the directory prefix and any argument suffix. The longer `cmdline`-derived name is used for the mapping lookup, with the `comm` name as a fallback. This handles cases like `google-chrome-stable` → `google-chrome-s` (comm) vs full name from cmdline.

- **No change to `index.d.ts` or `lib.rs`:** The `ActiveWindowInfo` struct and `getActiveWindow()` export are already defined in `lib.rs`. The Linux adapter returns the same `ActiveWindowData` struct that `lib.rs` converts. No TypeScript type changes needed.

- **`bundle_id` is always `None` on Linux:** Linux has no concept of bundle identifiers. The field is typed `Option<String>` and already documented as undefined on Windows — Linux follows the same convention.

## Test coverage plan

- **Unit tests (in `src/platform/linux.rs`, `#[cfg(target_os = "linux")]`):**
  - Process name resolution logic: given a 15-char `comm` string and a `cmdline` with a longer name, verify the cmdline-derived name is selected
  - Process name resolution: given a `comm` shorter than 15 chars, verify `comm` is used directly (no cmdline read needed)
  - `process-map.json` lookup unit tests: verify the new Linux entries resolve correctly (e.g., `google-chrome-s` → `google-chrome`, `gimp-2.10` → `gimp`, `soffice` → `libreoffice`)
  - These tests run without a live X11 server — they test the pure logic only

- **Integration test stubs (guarded behind `#[cfg(all(target_os = "linux", test))]`):**
  - `test_x11_connect` — stub that marks the test as `#[ignore]` and documents it must be run manually on an X11 session (`cargo test -- --ignored`)
  - `test_get_active_window_returns_data` — stub that calls `linux::get_active_window()` and asserts `Some(_)` — also `#[ignore]`, requires X11

- **Existing test preservation:** The Windows and macOS adapter tests (compiled only on their respective targets) are untouched. The `mod.rs` dispatch change does not alter the macos/windows paths.

## Out of scope (technical)

- Wayland detection via DBus (`TASK-0037`)
- Overlay window X11 type hints (`_NET_WM_WINDOW_TYPE_DOCK`, click-through) — later Goal 10 task
- AppImage and `.deb` packaging configuration (`TASK-0038`)
- GitHub Actions Linux CI job (`TASK-0038`)
- Landing page Linux download section (Goal 9/10 boundary — deferred)
- TypeScript-side changes to `process-map.ts` or `active-window.ts` — the JSON is loaded at runtime, no compile-time changes needed
- `libappindicator` tray compatibility — separate from window detection
- Sway/i3/Hyprland process-map entries for compositor processes — these are WM-level, not app-level

## Risks and open questions

- **`_NET_WM_PID` not set by all apps:** Some X11 apps (particularly older GTK2 apps and some Wine windows) do not set `_NET_WM_PID`. In this case the adapter returns `None`. This is acceptable per the PRD's "80% accuracy" target — the panel will show the "unrecognized app" fallback state.

- **`x11rb` version compatibility:** `x11rb` 0.13.x is the current stable release. If the crate's API changes between 0.13 and a potential 0.14 release during development, the lock file will pin us to 0.13. This is expected Cargo behavior and not a risk.

- **CI build environment:** The CI Linux job (from TASK-0038) will need `libx11-dev` / `libxcb1-dev` installed to compile `x11rb` (it uses xcb under the hood even though the API is pure Rust). This is documented as a build dependency. Since TASK-0038 is blocked on this task, that concern is noted here for the TASK-0038 author.

- **Process map coverage:** The 30+ entries added here cover the apps already in the KCC database. Apps not in the database are not in scope for the process map (the mapping layer only needs to match what the DB has). The list will grow as the database grows.

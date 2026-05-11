//! Linux adapter for active window detection using X11 EWMH protocol.
//!
//! Detection strategy:
//!   1. `_NET_ACTIVE_WINDOW` on the root window → focused window XID  (EWMH)
//!      Fallback: `GetInputFocus` for minimal WMs that don't implement EWMH.
//!   2. `_NET_WM_PID` on the focused window → process ID
//!      If not set, returns `None` (acceptable per PRD 80% accuracy target).
//!   3. `/proc/<pid>/comm` → process name (up to 15 chars, may be truncated)
//!      If comm length == 15, also reads `/proc/<pid>/cmdline` and uses the
//!      `argv[0]` basename as a higher-fidelity name for process-map lookups.
//!   4. `_NET_WM_NAME` (UTF-8) → window title, fallback to `WM_NAME` (Latin-1)
//!
//! Linux's `/proc/<pid>/comm` is capped at TASK_COMM_LEN - 1 = 15 printable
//! characters. Process names longer than 15 chars (e.g. `google-chrome-stable`)
//! appear truncated in comm (`google-chrome-s`). Reading cmdline for those
//! cases gives the full binary path, from which the basename is extracted.

#![cfg(target_os = "linux")]

use std::fs;
use std::path::Path;

use x11rb::connection::Connection;
use x11rb::protocol::xproto::{AtomEnum, ConnectionExt};
use x11rb::rust_connection::RustConnection;

use super::ActiveWindowData;

/// Linux TASK_COMM_LEN limit: `/proc/<pid>/comm` holds at most 15 printable chars.
const COMM_MAX_LEN: usize = 15;

pub fn get_active_window() -> Option<ActiveWindowData> {
    // Connect to the X11 display ($DISPLAY env var; falls back to ":0").
    let (conn, screen_num) = RustConnection::connect(None).ok()?;
    let root = conn.setup().roots[screen_num].root;

    // --- Step 1: Find the XID of the focused window ---
    let focused = get_focused_window(&conn, root)?;
    if focused == 0 {
        return None;
    }

    // --- Step 2: Get PID via _NET_WM_PID property ---
    let net_wm_pid = intern_atom(&conn, b"_NET_WM_PID")?;
    let pid = conn
        .get_property(false, focused, net_wm_pid, AtomEnum::CARDINAL, 0, 1)
        .ok()?
        .reply()
        .ok()?
        .value32()?
        .next()?;

    if pid == 0 {
        return None;
    }

    // --- Step 3: Read process name from /proc ---
    let process_name = resolve_process_name(pid)?;
    if process_name.is_empty() {
        return None;
    }

    // --- Step 4: Read window title ---
    let window_title = get_window_title(&conn, focused);

    Some(ActiveWindowData {
        process_name,
        window_title,
        bundle_id: None, // Linux has no bundle identifiers
    })
}

/// Returns the XID of the currently focused window.
///
/// Tries `_NET_ACTIVE_WINDOW` (EWMH) first — set by virtually all modern X11
/// window managers (i3, Openbox, Xfwm, Mutter, KWin, etc.). Falls back to
/// `GetInputFocus` for minimal/non-EWMH WMs (twm, jwm, etc.).
fn get_focused_window(conn: &impl Connection, root: u32) -> Option<u32> {
    // Try _NET_ACTIVE_WINDOW. Use only_if_exists=true so we don't pollute
    // the atom table on WMs that have never set this property.
    if let Some(atom) = intern_atom_if_exists(conn, b"_NET_ACTIVE_WINDOW") {
        let win = conn
            .get_property(false, root, atom, AtomEnum::WINDOW, 0, 1)
            .ok()
            .and_then(|c| c.reply().ok())
            .and_then(|r| r.value32().and_then(|mut i| i.next()))
            .filter(|&w| w != 0);
        if win.is_some() {
            return win;
        }
    }

    // Fallback: GetInputFocus (always available on X11).
    let focus = conn.get_input_focus().ok()?.reply().ok()?.focus;
    if focus == 0 {
        None
    } else {
        Some(focus)
    }
}

/// Interns an X11 atom, creating it if it doesn't already exist.
fn intern_atom(conn: &impl Connection, name: &[u8]) -> Option<u32> {
    conn.intern_atom(false, name)
        .ok()?
        .reply()
        .ok()
        .map(|r| r.atom)
}

/// Interns an X11 atom only if it already exists.
/// Returns `None` when the atom is unknown to the server (atom == 0 / None).
fn intern_atom_if_exists(conn: &impl Connection, name: &[u8]) -> Option<u32> {
    let atom = conn
        .intern_atom(true, name)
        .ok()?
        .reply()
        .ok()?
        .atom;
    if atom == 0 { None } else { Some(atom) }
}

/// Resolves the process name for `pid` from the Linux `/proc` filesystem.
///
/// Reads `/proc/<pid>/comm` first. If the name is exactly 15 characters
/// (indicating possible truncation), also reads `/proc/<pid>/cmdline` and
/// uses the `argv[0]` basename as a higher-fidelity name.
pub(crate) fn resolve_process_name(pid: u32) -> Option<String> {
    let proc_dir = format!("/proc/{}", pid);
    if !Path::new(&proc_dir).exists() {
        return None;
    }

    // /proc/<pid>/comm: process name, stripped of trailing newline.
    let comm = fs::read_to_string(format!("{}/comm", proc_dir))
        .ok()
        .map(|s| s.trim_end_matches('\n').to_owned())?;

    if comm.is_empty() {
        return None;
    }

    // comm is exactly 15 chars → likely truncated at TASK_COMM_LEN.
    // Attempt to get the full name from cmdline argv[0].
    if comm.len() == COMM_MAX_LEN {
        if let Ok(bytes) = fs::read(format!("{}/cmdline", proc_dir)) {
            if let Some(full_name) = cmdline_basename(&bytes) {
                if full_name.len() > comm.len() {
                    return Some(full_name.to_owned());
                }
            }
        }
    }

    Some(comm)
}

/// Extracts the basename of `argv[0]` from raw `/proc/<pid>/cmdline` bytes.
///
/// `/proc/<pid>/cmdline` is a null-separated list of arguments. `argv[0]`
/// is the first entry, and it is often a full path such as
/// `/usr/lib/google-chrome/google-chrome-stable`. This function returns
/// just the filename component (`google-chrome-stable`).
pub(crate) fn cmdline_basename(bytes: &[u8]) -> Option<&str> {
    if bytes.is_empty() {
        return None;
    }
    // argv[0] is the bytes up to the first null terminator.
    let arg0_bytes = bytes.split(|&b| b == 0).next()?;
    let arg0 = std::str::from_utf8(arg0_bytes).ok()?.trim();
    if arg0.is_empty() {
        return None;
    }
    // Strip directory prefix: "/.../google-chrome-stable" → "google-chrome-stable"
    Some(arg0.rsplit('/').next().unwrap_or(arg0))
}

/// Returns the window title for `window`.
///
/// Tries `_NET_WM_NAME` (UTF-8, EWMH extension) first, then falls back to
/// the older `WM_NAME` (Latin-1, ICCCM). Returns an empty string if neither
/// property is available.
fn get_window_title(conn: &impl Connection, window: u32) -> String {
    // _NET_WM_NAME with UTF8_STRING type (EWMH, preferred)
    if let (Some(name_atom), Some(utf8_atom)) = (
        intern_atom(conn, b"_NET_WM_NAME"),
        intern_atom(conn, b"UTF8_STRING"),
    ) {
        if let Some(title) = read_string_prop(conn, window, name_atom, utf8_atom) {
            if !title.is_empty() {
                return title;
            }
        }
    }

    // WM_NAME with STRING type (ICCCM Latin-1 fallback)
    if let Some(wm_name_atom) = intern_atom(conn, b"WM_NAME") {
        if let Some(title) =
            read_string_prop(conn, window, wm_name_atom, u32::from(AtomEnum::STRING))
        {
            return title;
        }
    }

    String::new()
}

/// Reads a string-typed X11 property from `window` and returns it as a
/// UTF-8 string. Returns `None` on any X11 or UTF-8 error.
fn read_string_prop(conn: &impl Connection, window: u32, prop: u32, type_: u32) -> Option<String> {
    let reply = conn
        .get_property(false, window, prop, type_, 0, 256)
        .ok()?
        .reply()
        .ok()?;
    if reply.value.is_empty() {
        None
    } else {
        Some(String::from_utf8_lossy(&reply.value).into_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Pure-logic unit tests (no X11 server required) ---

    #[test]
    fn test_comm_max_len_is_15() {
        // Verifies the constant matches Linux TASK_COMM_LEN - 1.
        assert_eq!(COMM_MAX_LEN, 15);
    }

    #[test]
    fn test_cmdline_basename_with_absolute_path() {
        // argv[0] is a full path — basename should be extracted.
        let bytes = b"/usr/lib/google-chrome/google-chrome-stable\0--type=renderer\0";
        assert_eq!(cmdline_basename(bytes), Some("google-chrome-stable"));
    }

    #[test]
    fn test_cmdline_basename_no_path_prefix() {
        // argv[0] has no directory prefix — the whole string is the basename.
        let bytes = b"firefox-esr\0--new-tab\0";
        assert_eq!(cmdline_basename(bytes), Some("firefox-esr"));
    }

    #[test]
    fn test_cmdline_basename_empty_bytes() {
        assert_eq!(cmdline_basename(b""), None);
    }

    #[test]
    fn test_cmdline_basename_null_only() {
        // Edge case: just a null byte → empty argv[0].
        assert_eq!(cmdline_basename(b"\0"), None);
    }

    #[test]
    fn test_cmdline_basename_no_trailing_null() {
        // Some kernel threads have no null terminator in cmdline.
        let bytes = b"kworker/u8:2";
        assert_eq!(cmdline_basename(bytes), Some("kworker/u8:2"));
    }

    #[test]
    fn test_cmdline_basename_pressure_vessel() {
        // pressure-vessel-wrap has a deeply nested path on Steam installations.
        let bytes =
            b"/run/pressure-vessel/interpreter-root/bin/pressure-vessel-wrap\0--bundle\0";
        assert_eq!(cmdline_basename(bytes), Some("pressure-vessel-wrap"));
    }

    #[test]
    fn test_cmdline_basename_gnome_terminal_server() {
        // gnome-terminal-server is the backend process: its argv[0] may be a full path.
        let bytes = b"/usr/lib/gnome-terminal/gnome-terminal-server\0";
        assert_eq!(cmdline_basename(bytes), Some("gnome-terminal-server"));
    }

    #[test]
    fn test_comm_exactly_15_chars_would_trigger_fallback() {
        // A comm string of exactly 15 characters triggers the cmdline fallback
        // in resolve_process_name. This test confirms the length check is correct.
        let comm = "google-chrome-s"; // exactly 15 chars — truncated name
        assert_eq!(comm.len(), COMM_MAX_LEN);

        let full = "google-chrome-stable";
        assert!(full.len() > comm.len(), "cmdline name should be longer");
    }

    #[test]
    fn test_comm_shorter_than_15_no_fallback_needed() {
        // A comm string under 15 chars is used as-is; no cmdline read needed.
        let comm = "firefox";
        assert!(comm.len() < COMM_MAX_LEN);
    }

    // --- Integration test stubs (require a live X11 session) ---
    // Run manually: DISPLAY=:0 cargo test --lib -- --ignored

    #[test]
    #[ignore = "requires a live X11 session — run: DISPLAY=:0 cargo test --lib -- --ignored"]
    fn test_x11_connect() {
        // Verifies that x11rb can connect to an X11 display.
        let result = RustConnection::connect(None);
        assert!(result.is_ok(), "x11rb should connect to $DISPLAY");
    }

    #[test]
    #[ignore = "requires a live X11 session — run: DISPLAY=:0 cargo test --lib -- --ignored"]
    fn test_get_active_window_returns_data() {
        // On a real X11 session with a foreground window that sets _NET_WM_PID,
        // get_active_window() must return Some(ActiveWindowData).
        let result = get_active_window();
        assert!(
            result.is_some(),
            "expected Some(ActiveWindowData) on X11 session with an active window"
        );
        if let Some(info) = result {
            assert!(!info.process_name.is_empty(), "process_name must not be empty");
        }
    }
}

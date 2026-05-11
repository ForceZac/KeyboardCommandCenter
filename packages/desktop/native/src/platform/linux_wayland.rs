//! Wayland active window detection via compositor DBus APIs.
//!
//! Detection strategy:
//!   1. GNOME: `org.gnome.Shell.Introspect::GetWindows()` — returns per-window
//!      properties including `has-focus`, `wm-class`, and `title`. Find the
//!      focused window and extract its class and title.
//!   2. KDE Plasma: `org.kde.KWin::queryWindowInfo()` — returns a property dict
//!      for the currently active window. Extract `appId` and `title`.
//!   3. All other compositors (Sway, Hyprland, Mutter-based non-GNOME, etc.):
//!      both DBus calls fail → return `DetectionUnavailable`.
//!
//! The `zbus` crate (async, pure-Rust, no libdbus-1-dev) is used for all DBus
//! communication. A single-threaded Tokio runtime is created per call to run
//! the async code synchronously from within the napi-rs sync entry point.
//!
//! # Graceful failure
//! Every code path that can fail returns `Option::None`, which the caller
//! (`linux.rs`) converts to `ActiveWindowData { detection_unavailable: true }`.
//! No DBus failure ever propagates as a panic or unhandled error.

#![cfg(target_os = "linux")]

use std::collections::HashMap;

use super::ActiveWindowData;

// ── Public entry point ───────────────────────────────────────────────────────

/// Returns active window data for Wayland sessions.
///
/// Tries GNOME DBus detection first, then KDE. If both fail (unsupported
/// compositor, DBus errors, or unexpected API shapes), returns an
/// `ActiveWindowData` with `detection_unavailable: true`.
pub fn get_active_window() -> Option<ActiveWindowData> {
    let rt = match tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
    {
        Ok(rt) => rt,
        // Tokio runtime construction failure is extremely rare (system resource
        // exhaustion); treat it as detection unavailable rather than crashing.
        Err(_) => return Some(unavailable()),
    };

    let detected = rt.block_on(async {
        if let Some(result) = gnome_detect().await {
            return Some(result);
        }
        kde_detect().await
    });

    match detected {
        Some((process_name, window_title)) => Some(ActiveWindowData {
            process_name,
            window_title,
            bundle_id: None,
            detection_unavailable: false,
        }),
        None => Some(unavailable()),
    }
}

fn unavailable() -> ActiveWindowData {
    ActiveWindowData {
        process_name: String::new(),
        window_title: String::new(),
        bundle_id: None,
        detection_unavailable: true,
    }
}

// ── GNOME detection ──────────────────────────────────────────────────────────

/// A single window entry parsed from GNOME Shell Introspect `GetWindows()`.
#[derive(Debug, PartialEq)]
pub(crate) struct GnomeWindowEntry {
    /// True when `has-focus` property is true for this window.
    pub has_focus: bool,
    /// WM_CLASS of the window (e.g. "code", "firefox", "org.gnome.Nautilus").
    pub wm_class: String,
    /// Window title string.
    pub title: String,
}

/// Finds the focused window in a list of GNOME window entries.
///
/// This is the pure, testable parsing function. The DBus call that
/// produces the input list is in `gnome_detect()`.
pub(crate) fn find_focused_gnome_window(entries: &[GnomeWindowEntry]) -> Option<(String, String)> {
    entries
        .iter()
        .find(|e| e.has_focus && !e.wm_class.is_empty())
        .map(|e| (e.wm_class.clone(), e.title.clone()))
}

/// Calls `org.gnome.Shell.Introspect::GetWindows()` and returns (wm_class, title)
/// for the focused window, or `None` on any error.
async fn gnome_detect() -> Option<(String, String)> {
    use zbus::zvariant::OwnedValue;
    use zbus::Connection;

    let conn = Connection::session().await.ok()?;

    // GetWindows() → a{ta{sv}}: dict from window XID (u64) to properties dict.
    let msg = conn
        .call_method(
            Some("org.gnome.Shell"),
            "/org/gnome/Shell/Introspect",
            Some("org.gnome.Shell.Introspect"),
            "GetWindows",
            &(),
        )
        .await
        .ok()?;

    let raw: HashMap<u64, HashMap<String, OwnedValue>> = msg.body().deserialize().ok()?;
    let entries = parse_gnome_response(&raw);
    find_focused_gnome_window(&entries)
}

/// Converts the raw DBus response dict into a `Vec<GnomeWindowEntry>`.
/// Ignores any property that cannot be parsed as the expected type.
fn parse_gnome_response(
    raw: &HashMap<u64, HashMap<String, zbus::zvariant::OwnedValue>>,
) -> Vec<GnomeWindowEntry> {
    use std::ops::Deref;
    use zbus::zvariant::Value;

    raw.values()
        .map(|props| {
            let has_focus = props
                .get("has-focus")
                .and_then(|v| match v.deref() {
                    Value::Bool(b) => Some(*b),
                    _ => None,
                })
                .unwrap_or(false);

            let wm_class = props
                .get("wm-class")
                .and_then(|v| match v.deref() {
                    Value::Str(s) => {
                        let trimmed = s.as_str().trim();
                        if trimmed.is_empty() { None } else { Some(trimmed.to_owned()) }
                    }
                    _ => None,
                })
                .unwrap_or_default();

            let title = props
                .get("title")
                .and_then(|v| match v.deref() {
                    Value::Str(s) => Some(s.as_str().to_owned()),
                    _ => None,
                })
                .unwrap_or_default();

            GnomeWindowEntry { has_focus, wm_class, title }
        })
        .collect()
}

// ── KDE detection ────────────────────────────────────────────────────────────

/// Active window info parsed from KDE KWin DBus response.
#[derive(Debug, PartialEq)]
pub(crate) struct KdeWindowInfo {
    /// Application identifier (e.g. "org.kde.dolphin", "code").
    pub app_id: String,
    /// Window title string.
    pub title: String,
}

/// Extracts (app_id, title) from a `KdeWindowInfo`, or `None` when app_id is empty.
pub(crate) fn process_kde_window_info(info: &KdeWindowInfo) -> Option<(String, String)> {
    if info.app_id.is_empty() {
        None
    } else {
        Some((info.app_id.clone(), info.title.clone()))
    }
}

/// Calls `org.kde.KWin::queryWindowInfo()` and returns (app_id, title)
/// for the active window, or `None` on any error.
async fn kde_detect() -> Option<(String, String)> {
    use zbus::zvariant::OwnedValue;
    use zbus::Connection;

    let conn = Connection::session().await.ok()?;

    // queryWindowInfo() → a{sv}: property dict for the active window.
    // This method is available in KWin 5.19+ (Plasma 5.19+).
    let msg = conn
        .call_method(
            Some("org.kde.KWin"),
            "/KWin",
            Some("org.kde.KWin"),
            "queryWindowInfo",
            &(),
        )
        .await
        .ok()?;

    let props: HashMap<String, OwnedValue> = msg.body().deserialize().ok()?;
    let info = parse_kde_response(&props)?;
    process_kde_window_info(&info)
}

/// Converts the raw KDE DBus property dict into a `KdeWindowInfo`.
fn parse_kde_response(
    props: &HashMap<String, zbus::zvariant::OwnedValue>,
) -> Option<KdeWindowInfo> {
    use std::ops::Deref;
    use zbus::zvariant::Value;

    let get_str = |key: &str| -> String {
        props
            .get(key)
            .and_then(|v| match v.deref() {
                Value::Str(s) => {
                    let trimmed = s.as_str().trim();
                    if trimmed.is_empty() { None } else { Some(trimmed.to_owned()) }
                }
                _ => None,
            })
            .unwrap_or_default()
    };

    // KWin may expose the app identifier as "appId" (Plasma 5/6) or "resourceClass"
    // (older KWin). Try both, preferring "appId".
    let app_id = {
        let a = get_str("appId");
        if a.is_empty() {
            get_str("resourceClass")
        } else {
            a
        }
    };

    if app_id.is_empty() {
        return None;
    }

    let title = get_str("caption");

    Some(KdeWindowInfo { app_id, title })
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── GnomeWindowEntry / find_focused_gnome_window ─────────────────────────

    fn gnome_entry(has_focus: bool, wm_class: &str, title: &str) -> GnomeWindowEntry {
        GnomeWindowEntry {
            has_focus,
            wm_class: wm_class.to_owned(),
            title: title.to_owned(),
        }
    }

    #[test]
    fn gnome_focused_window_found() {
        let entries = vec![
            gnome_entry(false, "firefox", "Mozilla Firefox"),
            gnome_entry(true, "code", "main.rs — KeyboardCommandCenter"),
        ];
        assert_eq!(
            find_focused_gnome_window(&entries),
            Some(("code".to_owned(), "main.rs — KeyboardCommandCenter".to_owned()))
        );
    }

    #[test]
    fn gnome_no_focused_window_returns_none() {
        let entries = vec![
            gnome_entry(false, "firefox", "Mozilla Firefox"),
            gnome_entry(false, "code", "Visual Studio Code"),
        ];
        assert_eq!(find_focused_gnome_window(&entries), None);
    }

    #[test]
    fn gnome_empty_entries_returns_none() {
        assert_eq!(find_focused_gnome_window(&[]), None);
    }

    #[test]
    fn gnome_focused_but_empty_wm_class_skipped() {
        // A focused window with no wm-class should not be returned.
        let entries = vec![
            gnome_entry(true, "", ""),
            gnome_entry(true, "nautilus", "Files"),
        ];
        assert_eq!(
            find_focused_gnome_window(&entries),
            Some(("nautilus".to_owned(), "Files".to_owned()))
        );
    }

    #[test]
    fn gnome_first_focused_window_returned() {
        // If multiple windows have has-focus (shouldn't happen in practice),
        // the first one encountered is returned.
        let entries = vec![
            gnome_entry(true, "code", "editor"),
            gnome_entry(true, "firefox", "browser"),
        ];
        let result = find_focused_gnome_window(&entries);
        // Either "code" or "firefox" — both are valid; we just need a result.
        assert!(result.is_some());
    }

    #[test]
    fn gnome_focused_window_empty_title_is_ok() {
        // wm-class present and focused → return even if title is empty.
        let entries = vec![gnome_entry(true, "xterm", "")];
        assert_eq!(
            find_focused_gnome_window(&entries),
            Some(("xterm".to_owned(), String::new()))
        );
    }

    // ── KdeWindowInfo / process_kde_window_info ──────────────────────────────

    fn kde_info(app_id: &str, title: &str) -> KdeWindowInfo {
        KdeWindowInfo {
            app_id: app_id.to_owned(),
            title: title.to_owned(),
        }
    }

    #[test]
    fn kde_window_info_with_app_id_returns_some() {
        let info = kde_info("org.kde.dolphin", "Dolphin — /home/user");
        assert_eq!(
            process_kde_window_info(&info),
            Some(("org.kde.dolphin".to_owned(), "Dolphin — /home/user".to_owned()))
        );
    }

    #[test]
    fn kde_window_info_empty_app_id_returns_none() {
        let info = kde_info("", "Some Window");
        assert_eq!(process_kde_window_info(&info), None);
    }

    #[test]
    fn kde_window_info_empty_title_is_ok() {
        let info = kde_info("konsole", "");
        assert_eq!(
            process_kde_window_info(&info),
            Some(("konsole".to_owned(), String::new()))
        );
    }

    // ── DetectionUnavailable propagation ─────────────────────────────────────

    #[test]
    fn unavailable_sets_correct_fields() {
        let data = unavailable();
        assert!(data.detection_unavailable);
        assert!(data.process_name.is_empty());
        assert!(data.window_title.is_empty());
        assert!(data.bundle_id.is_none());
    }
}

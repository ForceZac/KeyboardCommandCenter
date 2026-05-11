//! Session type detection for Linux.
//!
//! Determines whether the current session is X11 or Wayland by inspecting
//! standard environment variables set by the display server / login manager.
//!
//! Detection order (most reliable first):
//!   1. `WAYLAND_DISPLAY` — set by every Wayland compositor when a Wayland socket
//!      is available. Non-empty value means Wayland is active.
//!   2. `XDG_SESSION_TYPE` — set by `logind` / PAM on most modern Linux distros
//!      (systemd-based systems). Value `"wayland"` (case-insensitive) confirms the
//!      session is Wayland.
//!
//! Defaults to X11 if neither variable indicates Wayland, which is the safe
//! fallback — the X11 detection code handles failure gracefully when there is
//! no X11 server available.

#![cfg(target_os = "linux")]

/// The display server protocol in use for this session.
#[derive(Debug, PartialEq, Eq)]
pub enum SessionType {
    X11,
    Wayland,
}

/// Detects the current session type by reading environment variables.
///
/// This is the production entry point. Callers that need testability
/// should use `detect_session_from_env` directly.
pub fn detect_session() -> SessionType {
    let wayland_display = std::env::var("WAYLAND_DISPLAY").ok();
    let xdg_session_type = std::env::var("XDG_SESSION_TYPE").ok();
    detect_session_from_env(wayland_display.as_deref(), xdg_session_type.as_deref())
}

/// Pure detection logic — takes env var values so tests don't need to mutate
/// process-level environment state.
pub(crate) fn detect_session_from_env(
    wayland_display: Option<&str>,
    xdg_session_type: Option<&str>,
) -> SessionType {
    // WAYLAND_DISPLAY is set (non-empty) whenever a Wayland compositor is running.
    if let Some(wd) = wayland_display {
        if !wd.is_empty() {
            return SessionType::Wayland;
        }
    }

    // XDG_SESSION_TYPE is the canonical PAM/logind indicator.
    if let Some(st) = xdg_session_type {
        if st.to_lowercase() == "wayland" {
            return SessionType::Wayland;
        }
    }

    SessionType::X11
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wayland_display_set_returns_wayland() {
        assert_eq!(
            detect_session_from_env(Some("/run/user/1000/wayland-0"), None),
            SessionType::Wayland
        );
    }

    #[test]
    fn xdg_session_type_wayland_returns_wayland() {
        assert_eq!(
            detect_session_from_env(None, Some("wayland")),
            SessionType::Wayland
        );
    }

    #[test]
    fn xdg_session_type_wayland_case_insensitive() {
        assert_eq!(
            detect_session_from_env(None, Some("WAYLAND")),
            SessionType::Wayland
        );
        assert_eq!(
            detect_session_from_env(None, Some("Wayland")),
            SessionType::Wayland
        );
    }

    #[test]
    fn xdg_session_type_x11_returns_x11() {
        assert_eq!(
            detect_session_from_env(None, Some("x11")),
            SessionType::X11
        );
    }

    #[test]
    fn neither_env_var_returns_x11() {
        assert_eq!(detect_session_from_env(None, None), SessionType::X11);
    }

    #[test]
    fn empty_wayland_display_falls_through_to_xdg() {
        // Empty WAYLAND_DISPLAY should not trigger Wayland detection.
        assert_eq!(
            detect_session_from_env(Some(""), Some("x11")),
            SessionType::X11
        );
    }

    #[test]
    fn empty_wayland_display_with_wayland_xdg_returns_wayland() {
        // Empty WAYLAND_DISPLAY + XDG_SESSION_TYPE=wayland → Wayland.
        assert_eq!(
            detect_session_from_env(Some(""), Some("wayland")),
            SessionType::Wayland
        );
    }

    #[test]
    fn wayland_display_takes_priority_over_xdg() {
        // WAYLAND_DISPLAY non-empty is definitive even if XDG says x11.
        assert_eq!(
            detect_session_from_env(Some("wayland-0"), Some("x11")),
            SessionType::Wayland
        );
    }
}

//! Platform adapter interface for active window detection.
//!
//! The strategy pattern is enforced at Rust compile time via `#[cfg(target_os)]`.
//! Only the adapter for the current build target is compiled — no dead platform
//! code is shipped in the binary.

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
mod linux_session;
#[cfg(target_os = "linux")]
mod linux_wayland;

/// Internal representation of the active window info.
/// Converted to `ActiveWindowInfo` (the napi-rs exported struct) in `lib.rs`.
pub struct ActiveWindowData {
  pub process_name: String,
  pub window_title: String,
  pub bundle_id: Option<String>,
  /// True only when the Wayland adapter cannot identify the focused application
  /// (unsupported compositor or DBus call failed). Always false on macOS, Windows,
  /// and Linux X11. When true, `process_name` and `window_title` are empty strings.
  pub detection_unavailable: bool,
}

/// Dispatches to the platform-specific adapter and returns `Some(ActiveWindowData)`
/// on success, or `None` if detection fails or the platform is unsupported.
pub fn get_active_window_info() -> Option<ActiveWindowData> {
  #[cfg(target_os = "macos")]
  return macos::get_active_window();

  #[cfg(target_os = "windows")]
  return windows::get_active_window();

  #[cfg(target_os = "linux")]
  return linux::get_active_window();

  // Unsupported platform (e.g. BSDs, WASM — genuinely not supported)
  #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
  None
}

//! kcc-native: napi-rs entry point for the KeyboardCommandCenter native module.
//!
//! Exposes `getActiveWindow()` to Node.js via the N-API stable ABI.
//! Platform detection is handled by the `platform` module — this file only
//! registers the napi function and converts between Rust and JS types.

#![deny(clippy::all)]

use napi_derive::napi;

mod platform;
use platform::get_active_window_info;

/// The result returned by `getActiveWindow()`.
/// All fields that may be unavailable are typed as `Option<String>` so napi-rs
/// maps them to `string | undefined` in the generated TypeScript definitions.
#[napi(object)]
pub struct ActiveWindowInfo {
  /// The process executable name (e.g. "Code", "chrome", "Photoshop").
  /// Always present when detection succeeds.
  pub process_name: String,
  /// The window title or application display name.
  /// May be empty if the OS does not expose a title for the frontmost app.
  pub window_title: String,
  /// macOS bundle identifier (e.g. "com.microsoft.VSCode").
  /// Always `undefined` on Windows.
  pub bundle_id: Option<String>,
}

/// Returns information about the currently active (foreground) window,
/// or `null` if detection fails or the platform is unsupported.
///
/// This is a synchronous call — the OS APIs used on both Windows and macOS
/// return immediately without blocking. If a call unexpectedly takes >1ms,
/// the polling service in TASK-0010 can add its own debounce.
#[napi]
pub fn get_active_window() -> Option<ActiveWindowInfo> {
  get_active_window_info().map(|info| ActiveWindowInfo {
    process_name: info.process_name,
    window_title: info.window_title,
    bundle_id: info.bundle_id,
  })
}

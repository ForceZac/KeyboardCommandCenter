//! macOS adapter for active window detection.
//!
//! Uses `NSWorkspace.shared.frontmostApplication` (AppKit) to obtain the
//! frontmost application's process name, display name, and bundle identifier.
//! No Accessibility entitlement is required — NSWorkspace does not need
//! special permissions to read the foreground application identity.
//!
//! Window title note: `NSWorkspace.shared.frontmostApplication` does not expose
//! the actual window title — that requires `AXUIElement` (Accessibility API).
//! Per the PRD, process name is the primary signal; window title is nice-to-have.
//! We return `localizedName` (app display name, e.g. "Visual Studio Code") as
//! `window_title` — sufficient for the mapping layer in TASK-0010.

#[cfg(target_os = "macos")]

use objc2::rc::Retained;
use objc2_app_kit::{NSWorkspace, NSRunningApplication};
use objc2_foundation::{NSString, NSURL};

use super::ActiveWindowData;

pub fn get_active_window() -> Option<ActiveWindowData> {
  // SAFETY: All calls are to safe AppKit APIs. NSWorkspace methods are
  // documented as safe to call from any thread when accessing shared state.
  unsafe {
    let workspace = NSWorkspace::sharedWorkspace();
    let app: Option<Retained<NSRunningApplication>> = workspace.frontmostApplication();
    let app = app?;

    // `executableURL` returns the path to the app binary.
    // We extract the last path component to get the executable name.
    let exe_name: String = app
      .executableURL()
      .and_then(|url: Retained<NSURL>| {
        url.lastPathComponent()
          .map(|s: Retained<NSString>| s.to_string())
      })
      .unwrap_or_else(|| {
        // Fall back to localizedName if executableURL is unavailable
        app.localizedName()
          .map(|s: Retained<NSString>| s.to_string())
          .unwrap_or_default()
      });

    // `localizedName` is the display name shown in the Dock/menu bar.
    // Used as `window_title` — see module doc for rationale.
    let display_name: String = app
      .localizedName()
      .map(|s: Retained<NSString>| s.to_string())
      .unwrap_or_default();

    // `bundleIdentifier` is the reverse-DNS app identifier (e.g. "com.apple.Safari").
    let bundle_id: Option<String> = app
      .bundleIdentifier()
      .map(|s: Retained<NSString>| s.to_string());

    Some(ActiveWindowData {
      process_name: exe_name,
      window_title: display_name,
      bundle_id,
      detection_unavailable: false,
    })
  }
}

/**
 * STUB: Placeholder for the TASK-0009 (goals/9-rust-native-module) implementation.
 * Reconcile at merge time — replace with the real file from that branch.
 *
 * The interface is stable and matches the TASK-0009 TRD exactly.
 * DetectionService imports from this path; no other files need to change at merge.
 */

export interface ActiveWindowInfo {
  /** Process executable name (e.g. "Code", "chrome", "Photoshop"). */
  processName: string;
  /**
   * Window title or app display name.
   * On macOS: the localizedName. On Windows: the window title string.
   * May be an empty string if unavailable.
   */
  windowTitle: string;
  /** macOS bundle identifier (e.g. "com.microsoft.VSCode"). Undefined on Windows. */
  bundleId?: string;
}

/**
 * Returns information about the currently active window, or null when the
 * native module is not yet built. The real implementation (TASK-0009) uses
 * a compiled Rust .node binary loaded via napi-rs.
 */
export function getActiveWindow(): ActiveWindowInfo | null {
  // Stub — native module from TASK-0009 not yet merged.
  return null;
}

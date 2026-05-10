/**
 * platform.ts — Detect the current OS at runtime using navigator.platform.
 *
 * navigator.platform is deprecated in web specs but remains fully functional
 * in Electron's Chromium renderer. It is the correct tool here given the
 * controlled runtime environment (Electron, not an arbitrary browser).
 *
 * Linux is out of scope per the Goal 5 PRD — only macos and windows are returned.
 */

/** OS platform slug matching the PlatformSlug values used in the database. */
export type RendererPlatform = 'macos' | 'windows';

/**
 * Returns the current platform slug based on navigator.platform.
 * Defaults to 'windows' for any non-Mac platform (Linux, unknown).
 */
export function getPlatform(): RendererPlatform {
  // navigator.platform contains "Mac" on macOS (e.g. "MacIntel", "MacM1").
  // On Windows it is "Win32" or "Win64".
  if (navigator.platform.startsWith('Mac')) {
    return 'macos';
  }
  return 'windows';
}

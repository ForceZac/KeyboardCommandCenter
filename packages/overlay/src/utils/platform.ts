/**
 * platform.ts — Detect the current OS at runtime using navigator.platform.
 *
 * Duplicated from packages/desktop/src/renderer/platform.ts per separation-of-concerns
 * rules (overlay cannot import from desktop). The snippet is two lines — duplication
 * is the correct call per feedback_separation_of_concerns.md.
 *
 * Linux is out of scope for the overlay (Goal 10); only macos and windows are returned.
 */

export type RendererPlatform = 'macos' | 'windows';

/**
 * Returns the current platform slug based on navigator.platform.
 * Defaults to 'windows' for any non-Mac platform.
 */
export function getPlatform(): RendererPlatform {
  if (navigator.platform.startsWith('Mac')) {
    return 'macos';
  }
  return 'windows';
}

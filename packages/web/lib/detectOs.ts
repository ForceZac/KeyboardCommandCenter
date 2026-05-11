/**
 * Detects the user's OS from a User-Agent string.
 * Returns 'macos', 'windows', or 'unknown' (Linux, mobile, bots, etc.).
 * Pure function — no side effects, no imports.
 */
export type DetectedOS = 'macos' | 'windows' | 'unknown';

export const detectOs = (ua: string): DetectedOS => {
  if (!ua) return 'unknown';
  const lower = ua.toLowerCase();
  // Check macOS before checking for generic 'mac' — iOS also includes 'mac' on iPadOS
  if (lower.includes('macintosh') || lower.includes('mac os x')) {
    // Exclude iOS devices (iPhone/iPad report Mac OS X in their UA)
    if (lower.includes('iphone') || lower.includes('ipad')) return 'unknown';
    return 'macos';
  }
  if (lower.includes('windows')) return 'windows';
  return 'unknown';
};

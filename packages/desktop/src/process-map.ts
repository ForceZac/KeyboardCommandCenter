import mapData from './process-map.json';

/**
 * Shape of the process-map JSON — two flat lookup indexes keyed by
 * normalized process name and macOS bundle ID respectively, plus a
 * display name map keyed by app slug.
 */
export type ProcessMap = {
  byProcess: Record<string, string>;
  byBundleId: Record<string, string>;
  displayNames: Record<string, string>;
};

const processMap: ProcessMap = mapData as ProcessMap;

/**
 * Look up an application slug from a raw process name and optional bundle ID.
 *
 * Lookup order:
 *   1. Bundle ID (macOS only — more stable across app updates).
 *   2. Normalized process name (lowercased, `.exe` suffix stripped).
 *
 * Returns the database app slug (e.g. "vscode", "slack") or `null` when no
 * mapping exists for the given inputs.
 */
export function lookupApp(
  processName: string,
  bundleId?: string,
): string | null {
  if (!processName && !bundleId) return null;

  // Bundle ID path — try first when available (macOS).
  if (bundleId) {
    const slug = processMap.byBundleId[bundleId.trim()];
    if (slug) return slug;
  }

  // Process name path — normalize to lowercase and strip .exe suffix.
  const normalized = processName
    .toLowerCase()
    .trim()
    .replace(/\.exe$/i, '');

  if (!normalized) return null;

  return processMap.byProcess[normalized] ?? null;
}

/**
 * Returns a human-readable display name for an app slug.
 *
 * Looks up the slug in the `displayNames` map from process-map.json.
 * Falls back to title-casing the slug (replacing hyphens with spaces)
 * if the slug is not found in the map.
 *
 * Examples:
 *   getDisplayName("google-chrome")  → "Google Chrome"
 *   getDisplayName("vscode")         → "VS Code"
 *   getDisplayName("unknown-app")    → "Unknown App"   (title-case fallback)
 */
export function getDisplayName(slug: string): string {
  const mapped = processMap.displayNames[slug];
  if (mapped) return mapped;

  // Title-case fallback: "some-app-name" → "Some App Name"
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

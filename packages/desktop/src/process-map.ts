import mapData from './process-map.json';

type ProcessMap = {
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
 *   2. Normalized process name (lowercased, trimmed, `.exe` suffix stripped).
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

  // Process name path — normalize to lowercase, trim, strip .exe suffix.
  const normalized = processName
    .toLowerCase()
    .trim()
    .replace(/\.exe$/i, '');

  if (!normalized) return null;

  return processMap.byProcess[normalized] ?? null;
}

/**
 * Return a human-readable display name for an app slug.
 *
 * Uses the displayNames lookup table in process-map.json when available;
 * falls back to title-casing the slug (e.g. "my-cool-app" → "My Cool App").
 */
export function getDisplayName(slug: string): string {
  const mapped = processMap.displayNames[slug];
  if (mapped) return mapped;
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Returns all known app entries from the process-map display names table,
 * sorted alphabetically by display name.
 *
 * Used by the Wayland manual app selector UI (TASK-0037) to populate the
 * searchable dropdown of all recognized apps.
 */
export function getAllApps(): { slug: string; name: string }[] {
  return Object.entries(processMap.displayNames)
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

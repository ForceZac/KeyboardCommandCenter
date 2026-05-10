import mapData from './process-map.json';

type ProcessMap = {
  byProcess: Record<string, string>;
  byBundleId: Record<string, string>;
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

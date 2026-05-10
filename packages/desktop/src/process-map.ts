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
 * Looks up an application slug from a raw process name and optional bundle ID.
 * Returns the database app slug (e.g. "vscode", "slack") or null for unknown processes.
 *
 * Stub implementation always returns null — real lookup pending PROP-0003 reconciliation.
 * See: research/agents/proposals.md#PROP-0003
 */
export function lookupApp(
  _processName: string,
  _bundleId?: string,
): string | null {
  // Stub — TASK-0008 reconciliation still pending (see PROP-0003).
  return null;
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

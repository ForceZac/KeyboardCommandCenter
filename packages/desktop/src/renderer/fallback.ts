/**
 * fallback.ts — Renders panel fallback state HTML strings.
 *
 * Covers three cases (TASK-0016 / PRD Flows 3 & 4):
 *   1. No app detected (processName === '')
 *   2. Unrecognized app (appSlug === null, processName non-empty)
 *   3. Recognized app with no shortcuts (empty contexts)
 *
 * Design follows shortcut-list.ts: pure functions, HTML-string output,
 * no DOM side-effects. All user-visible strings are HTML-escaped.
 */

import { escHtml } from './keycap';

export interface RecentAppEntry {
  slug: string;
  name: string;
}

// ── Recent apps list helpers ──────────────────────────────────────────────

/** Renders the list of recently-detected apps the user can click to load. */
export function renderRecentAppsList(apps: RecentAppEntry[]): string {
  if (apps.length === 0) return renderEmptyRecentApps();
  const items = apps
    .map(
      ({ slug, name }) =>
        `<div class="recent-app-item" data-slug="${escHtml(slug)}">${escHtml(name)}</div>`,
    )
    .join('');
  return `<div class="recent-apps-section"><p class="recent-apps-label">Recent apps</p><div class="recent-apps-list">${items}</div></div>`;
}

/** Rendered when the detection history is empty (cold start, first run). */
export function renderEmptyRecentApps(): string {
  return '<p class="recent-apps-empty">No recently-used apps</p>';
}

// ── Fallback state renderers ──────────────────────────────────────────────

/** Case 1: detection service found no active window. */
export function renderNoDetection(recentApps: RecentAppEntry[]): string {
  return (
    `<div class="fallback-message">No app detected</div>` +
    `<p class="fallback-subtitle">Switch to an app to see its shortcuts.</p>` +
    renderRecentAppsList(recentApps)
  );
}

/** Case 2: active window found but the process is not in the database. */
export function renderUnrecognizedApp(processName: string, recentApps: RecentAppEntry[]): string {
  return (
    `<div class="fallback-message">Shortcuts not available for ${escHtml(processName)}</div>` +
    `<p class="fallback-subtitle">This app isn't in the database yet.</p>` +
    renderRecentAppsList(recentApps)
  );
}

/** Case 3: recognized app slug but zero shortcuts stored in the database. */
export function renderNoShortcuts(appName: string, recentApps: RecentAppEntry[]): string {
  return (
    `<div class="fallback-message">No shortcuts found for ${escHtml(appName)}</div>` +
    `<p class="fallback-subtitle">Shortcuts for this app haven't been added yet.</p>` +
    renderRecentAppsList(recentApps)
  );
}

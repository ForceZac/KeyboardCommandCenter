/**
 * wayland-unavailable.ts — Renders the Wayland detection-unavailable UI.
 *
 * Shown in the panel when the Rust native module signals that automatic active
 * window detection is not available (unsupported Wayland compositor or DBus
 * calls failed).
 *
 * Design follows the existing renderer pattern: pure functions that return HTML
 * strings; no DOM side-effects. The caller is responsible for injecting the
 * returned HTML into the DOM.
 *
 * TASK-0037 / PRD Flow 4.
 */

import { escHtml } from './keycap';

/** Minimal app entry used to populate the selector list. */
export interface AppEntry {
  slug: string;
  name: string;
}

/**
 * Renders the complete Wayland unavailable UI: a subtle info banner and a
 * searchable manual app selector. The caller injects this into the fallback
 * container.
 *
 * @param apps        Full sorted list of known apps (from `getAllApps()` IPC).
 * @param lastUsedSlug  Slug of the last app the user selected, or null on first show.
 */
export function renderWaylandUnavailable(
  apps: AppEntry[],
  lastUsedSlug: string | null,
): string {
  return renderWaylandBanner() + renderManualAppSelector(apps, lastUsedSlug);
}

/**
 * Renders the subtle banner explaining why manual selection is needed.
 * Dismissible via a close button (the renderer handles the click).
 */
export function renderWaylandBanner(): string {
  return (
    `<div id="wayland-banner" class="wayland-banner">` +
    `<span class="wayland-banner-text">` +
    `Automatic app detection isn't available on your Wayland compositor. Pick your app manually.` +
    `</span>` +
    `<button id="wayland-banner-dismiss" class="wayland-banner-dismiss" aria-label="Dismiss">✕</button>` +
    `</div>`
  );
}

/**
 * Renders the searchable manual app selector.
 *
 * Structure:
 *   - Text input for filtering the list
 *   - Scrollable list of app entries; each has data-slug for click handling
 *   - Last-used app rendered first (if known and present in the list)
 *
 * Click handling is done via delegated listeners in index.ts.
 */
export function renderManualAppSelector(
  apps: AppEntry[],
  lastUsedSlug: string | null,
): string {
  const sorted = sortAppsWithLastUsedFirst(apps, lastUsedSlug);

  const items = sorted
    .map(
      ({ slug, name }) =>
        `<div class="manual-app-item${slug === lastUsedSlug ? ' manual-app-item--last-used' : ''}" data-slug="${escHtml(slug)}">${escHtml(name)}</div>`,
    )
    .join('');

  return (
    `<div id="manual-app-selector" class="manual-app-selector">` +
    `<p class="manual-app-selector-label">Select your app</p>` +
    `<input id="manual-app-search" class="manual-app-search" type="search" ` +
    `placeholder="Search apps…" autocomplete="off" spellcheck="false" />` +
    `<div id="manual-app-list" class="manual-app-list">${items}</div>` +
    `</div>`
  );
}

/**
 * Filters the app list to entries whose name contains the query string
 * (case-insensitive). Used by the search input handler in index.ts.
 */
export function filterApps(apps: AppEntry[], query: string): AppEntry[] {
  const lower = query.toLowerCase().trim();
  if (!lower) return apps;
  return apps.filter((a) => a.name.toLowerCase().includes(lower));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a copy of `apps` with the last-used app moved to position 0 when it
 * exists in the list. The rest of the list retains its original order.
 */
function sortAppsWithLastUsedFirst(apps: AppEntry[], lastUsedSlug: string | null): AppEntry[] {
  if (!lastUsedSlug) return apps;
  const idx = apps.findIndex((a) => a.slug === lastUsedSlug);
  if (idx <= 0) return apps; // already first or not found — no change needed
  const copy = [...apps];
  const [entry] = copy.splice(idx, 1);
  if (entry) copy.unshift(entry);
  return copy;
}

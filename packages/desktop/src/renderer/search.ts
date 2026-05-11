/**
 * search.ts — Real-time shortcut filter for the panel renderer.
 *
 * Handles both views:
 * - App Shortcuts view: filters `.shortcut-row` elements by data-cmd / data-combo
 * - My Favorites view: filters `.fav-row` elements by data-cmd / data-app
 *
 * Operates on the live DOM — no re-render. Data attributes are pre-lowercased
 * at render time so filter logic is a single includes() call per row.
 *
 * Design (per TRD):
 * - Visibility toggled via HTMLElement.hidden — spec-standard, no class churn.
 * - Context group headings (.context-group) are hidden when all their rows are
 *   hidden (App Shortcuts view only).
 * - No library deps — vanilla TypeScript only.
 */

export type ActiveView = 'app-shortcuts' | 'favorites';

/**
 * Attach an `input` event listener to the search input.
 * Call once on DOMContentLoaded.
 *
 * The listener re-reads the active view at filter time so it always filters the
 * correct container without needing to rebind on every tab switch.
 */
export function initSearch(
  input: HTMLInputElement,
  shortcutsContainer: HTMLElement,
  favoritesContainer: HTMLElement,
  noResults: HTMLElement,
  getActiveView: () => ActiveView,
): void {
  input.addEventListener('input', () => {
    applyFilter(input.value, shortcutsContainer, favoritesContainer, noResults, getActiveView());
  });
}

/**
 * Filter the visible list by query string.
 *
 * In App Shortcuts view: matches against data-cmd and data-combo on .shortcut-row elements.
 *                        Context groups whose every row is hidden are also hidden.
 * In My Favorites view:  matches against data-cmd and data-app on .fav-row elements.
 *
 * Shows the no-results message when filtering produces zero visible rows.
 * Empty or whitespace-only query restores all rows.
 */
export function applyFilter(
  query: string,
  shortcutsContainer: HTMLElement,
  favoritesContainer: HTMLElement,
  noResults: HTMLElement,
  activeView: ActiveView,
): void {
  const lowerQuery = query.toLowerCase().trim();
  let anyVisible = false;

  if (activeView === 'favorites') {
    // ── My Favorites view ─────────────────────────────────────────────────
    const rows = favoritesContainer.querySelectorAll<HTMLElement>('.fav-row');

    if (lowerQuery === '') {
      rows.forEach((row) => { row.hidden = false; });
      anyVisible = rows.length > 0;
    } else {
      rows.forEach((row) => {
        const cmd = row.dataset['cmd'] ?? '';
        const app = row.dataset['app'] ?? '';
        const matches = cmd.includes(lowerQuery) || app.includes(lowerQuery);
        row.hidden = !matches;
        if (matches) anyVisible = true;
      });
    }
  } else {
    // ── App Shortcuts view ─────────────────────────────────────────────────
    const rows = shortcutsContainer.querySelectorAll<HTMLElement>('.shortcut-row');

    if (lowerQuery === '') {
      rows.forEach((row) => { row.hidden = false; });
      anyVisible = rows.length > 0;
    } else {
      rows.forEach((row) => {
        const cmd = row.dataset['cmd'] ?? '';
        const combo = row.dataset['combo'] ?? '';
        const matches = cmd.includes(lowerQuery) || combo.includes(lowerQuery);
        row.hidden = !matches;
        if (matches) anyVisible = true;
      });
    }

    // Hide context group headings whose every shortcut row is hidden.
    const groups = shortcutsContainer.querySelectorAll<HTMLElement>('.context-group');
    groups.forEach((group) => {
      const groupRows = group.querySelectorAll<HTMLElement>('.shortcut-row');
      const allHidden = Array.from(groupRows).every((r) => r.hidden);
      group.hidden = allHidden;
    });
  }

  // Show the "no results" message only when filtering and nothing matches.
  noResults.hidden = lowerQuery === '' || anyVisible;
}

/**
 * Reset the search state: clear the input value and make all rows visible.
 * Call on each app-changed event before loading new shortcut content.
 */
export function resetFilter(
  input: HTMLInputElement,
  shortcutsContainer: HTMLElement,
  favoritesContainer: HTMLElement,
  noResults: HTMLElement,
  activeView: ActiveView,
): void {
  input.value = '';
  applyFilter('', shortcutsContainer, favoritesContainer, noResults, activeView);
}

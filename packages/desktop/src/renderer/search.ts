/**
 * search.ts — Real-time shortcut filter for the panel renderer.
 *
 * Operates on the live DOM produced by shortcut-list.ts. Each .shortcut-row
 * carries data-cmd and data-combo attributes (pre-lowercased at render time)
 * that this module matches against — no HTML parsing, no re-render.
 *
 * Design (per TRD):
 * - Visibility toggled via HTMLElement.hidden — spec-standard, no class churn.
 * - Context group headings (.context-group) are hidden when all their rows are
 *   hidden, via a one-pass O(n-groups) walk after updating rows.
 * - No library deps — vanilla TypeScript only.
 */

/**
 * Attach an `input` event listener to the search input.
 * Call once on DOMContentLoaded.
 */
export function initSearch(
  input: HTMLInputElement,
  container: HTMLElement,
  noResults: HTMLElement,
): void {
  input.addEventListener('input', () => {
    applyFilter(input.value, container, noResults);
  });
}

/**
 * Filter the shortcut list by query string.
 *
 * Shows rows whose data-cmd or data-combo contains the lowercased query as a
 * substring (case-insensitive). Hides context groups whose every row is hidden.
 * Shows the no-results message when nothing matches.
 *
 * Empty or whitespace-only query restores all rows (same effect as resetFilter,
 * but without touching the input value).
 */
export function applyFilter(
  query: string,
  container: HTMLElement,
  noResults: HTMLElement,
): void {
  const lowerQuery = query.toLowerCase().trim();

  const rows = container.querySelectorAll<HTMLElement>('.shortcut-row');
  let anyVisible = false;

  if (lowerQuery === '') {
    // Empty query → show everything.
    rows.forEach((row) => {
      row.hidden = false;
    });
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
  // Walk groups once; check their child rows.
  const groups = container.querySelectorAll<HTMLElement>('.context-group');
  groups.forEach((group) => {
    const groupRows = group.querySelectorAll<HTMLElement>('.shortcut-row');
    const allHidden = Array.from(groupRows).every((r) => r.hidden);
    group.hidden = allHidden;
  });

  // Show the "no results" message only when filtering and nothing matches.
  noResults.hidden = lowerQuery === '' || anyVisible;
}

/**
 * Reset the search state: clear the input value and make all rows visible.
 * Call on each app-changed event before loading new shortcut content.
 */
export function resetFilter(
  input: HTMLInputElement,
  container: HTMLElement,
  noResults: HTMLElement,
): void {
  input.value = '';
  applyFilter('', container, noResults);
}

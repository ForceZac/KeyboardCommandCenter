/**
 * index.ts — Panel renderer entry point.
 *
 * Wires the onAppChanged IPC listener to the shortcut renderer modules.
 * On each app-changed event: fetches shortcut data (served from main-process
 * cache by TASK-0012, so typically <1ms), then renders the app header and
 * shortcut list into the DOM.
 */

import './app.css';

import { getPlatform } from './platform';
import { renderAppHeader, clearAppHeader } from './app-header';
import { renderShortcutList } from './shortcut-list';
import { initSearch, resetFilter } from './search';

// Escape key dismisses the panel via IPC → main process hides the BrowserWindow.
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    window.kcc.hidePanel();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const platformSlug = getPlatform();
  const appNameEl = document.getElementById('app-name');
  const shortcutsEl = document.getElementById('shortcuts-container') as HTMLElement;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const noResultsEl = document.getElementById('no-results') as HTMLElement;

  // Attach search listener once — applyFilter runs on every keystroke.
  if (searchInput && shortcutsEl && noResultsEl) {
    initSearch(searchInput, shortcutsEl, noResultsEl);
  }

  /**
   * Handles an app-changed event from the detection service.
   *
   * When appSlug is null (unrecognized process), clears the header and container.
   * Fallback state UI is out of scope for TASK-0013 — that is handled in TASK-0016.
   */
  async function handleAppChanged(payload: { appSlug: string | null }): Promise<void> {
    try {
      if (!payload.appSlug) {
        // No recognized app — clear the panel. Fallback UI is TASK-0016.
        if (appNameEl) appNameEl.innerHTML = clearAppHeader();
        if (shortcutsEl) shortcutsEl.innerHTML = '';
        return;
      }

      // getShortcutsForApp is served from the main-process prefetch cache
      // (TASK-0012) — typically resolves in <1ms for recently-detected apps.
      const appDetail = await window.kcc.getShortcutsForApp(payload.appSlug);

      if (!appDetail) {
        // Unknown slug or DB unreachable — clear panel, no crash.
        if (appNameEl) appNameEl.innerHTML = clearAppHeader();
        if (shortcutsEl) shortcutsEl.innerHTML = '';
        return;
      }

      if (appNameEl) appNameEl.innerHTML = renderAppHeader(appDetail.name);
      if (shortcutsEl) shortcutsEl.innerHTML = renderShortcutList(appDetail, platformSlug);

      // Reset search and focus the input so the user can type immediately.
      if (searchInput && shortcutsEl && noResultsEl) {
        resetFilter(searchInput, shortcutsEl, noResultsEl);
        searchInput.focus();
      }
    } catch (err) {
      // Renderer must never crash the panel — log and continue.
      console.error('[kcc] handleAppChanged error:', err);
    }
  }

  window.kcc.onAppChanged(handleAppChanged);
});

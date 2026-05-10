/**
 * index.ts — Panel renderer entry point.
 *
 * Wires the onAppChanged IPC listener to the shortcut renderer modules.
 * On each app-changed event: fetches shortcut data (served from main-process
 * cache by TASK-0012, so typically <1ms), then renders the app header and
 * shortcut list into the DOM — or one of three fallback states (TASK-0016).
 */

import './app.css';

import { getPlatform } from './platform';
import { renderAppHeader, clearAppHeader } from './app-header';
import { renderShortcutList } from './shortcut-list';
import { initSearch, resetFilter } from './search';
import {
  renderNoDetection,
  renderUnrecognizedApp,
  renderNoShortcuts,
  type RecentAppEntry,
} from './fallback';

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
  const searchContainerEl = document.getElementById('search-container') as HTMLElement;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const noResultsEl = document.getElementById('no-results') as HTMLElement;
  const fallbackEl = document.getElementById('fallback-container') as HTMLElement;

  // Attach search listener once — applyFilter runs on every keystroke.
  if (searchInput && shortcutsEl && noResultsEl) {
    initSearch(searchInput, shortcutsEl, noResultsEl);
  }

  // Single delegated click listener for recent-app entries in the fallback view.
  // Avoids re-attaching listeners on every re-render.
  if (fallbackEl) {
    fallbackEl.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as Element;
      const item = target.closest<HTMLElement>('.recent-app-item[data-slug]');
      if (!item) return;
      const slug = item.dataset['slug'];
      if (slug) {
        void handleAppChanged({ appSlug: slug, processName: slug, windowTitle: '' });
      }
    });
  }

  /** Shows the shortcut (happy-path) UI elements; hides the fallback container. */
  function showShortcuts(): void {
    if (shortcutsEl) shortcutsEl.hidden = false;
    if (searchContainerEl) searchContainerEl.hidden = false;
    if (fallbackEl) fallbackEl.hidden = true;
  }

  /** Shows the fallback container; hides shortcut UI elements. */
  function showFallback(html: string): void {
    if (fallbackEl) {
      fallbackEl.innerHTML = html;
      fallbackEl.hidden = false;
    }
    if (shortcutsEl) shortcutsEl.hidden = true;
    if (searchContainerEl) searchContainerEl.hidden = true;
  }

  /**
   * Fetches names for up to 5 recent app slugs from the prefetch cache.
   * Slugs whose lookup returns null are omitted (DB edge case or unknown app).
   */
  async function fetchRecentApps(): Promise<RecentAppEntry[]> {
    const slugs = await window.kcc.getRecentApps();
    const top5 = slugs.slice(0, 5);
    const results = await Promise.all(
      top5.map(async (slug) => {
        const detail = await window.kcc.getShortcutsForApp(slug);
        return detail ? { slug, name: detail.name } : null;
      }),
    );
    return results.filter((r): r is RecentAppEntry => r !== null);
  }

  /**
   * Handles an app-changed event from the detection service.
   *
   * Detection payload semantics:
   *   { appSlug: null, processName: '' }           → no active window
   *   { appSlug: null, processName: 'SomeApp.exe' } → unrecognized process
   *   { appSlug: 'vscode', ... }                   → recognized app (may have no shortcuts)
   */
  async function handleAppChanged(payload: {
    appSlug: string | null;
    processName: string;
    windowTitle: string;
  }): Promise<void> {
    try {
      // ── Case 1: No active window ──────────────────────────────────────────
      if (payload.appSlug === null && payload.processName === '') {
        if (appNameEl) appNameEl.innerHTML = clearAppHeader();
        const recentApps = await fetchRecentApps();
        showFallback(renderNoDetection(recentApps));
        return;
      }

      // ── Case 2: Active window but process not in the database ─────────────
      if (payload.appSlug === null) {
        if (appNameEl) appNameEl.innerHTML = clearAppHeader();
        const recentApps = await fetchRecentApps();
        showFallback(renderUnrecognizedApp(payload.processName, recentApps));
        return;
      }

      // ── Recognized app — fetch shortcut data ──────────────────────────────
      const appDetail = await window.kcc.getShortcutsForApp(payload.appSlug);

      // ── Case 3a: appSlug valid but DB returned null (DB unreachable etc.) ──
      if (!appDetail) {
        if (appNameEl) appNameEl.innerHTML = clearAppHeader();
        const recentApps = await fetchRecentApps();
        // Use slug as display name when the real name is unavailable.
        showFallback(renderNoShortcuts(payload.appSlug, recentApps));
        return;
      }

      // ── Case 3b: Recognized app with zero shortcuts ───────────────────────
      if (Object.keys(appDetail.contexts).length === 0) {
        if (appNameEl) appNameEl.innerHTML = renderAppHeader(appDetail.name);
        const recentApps = await fetchRecentApps();
        showFallback(renderNoShortcuts(appDetail.name, recentApps));
        return;
      }

      // ── Happy path: recognized app with shortcuts ─────────────────────────
      if (appNameEl) appNameEl.innerHTML = renderAppHeader(appDetail.name);
      showShortcuts();
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

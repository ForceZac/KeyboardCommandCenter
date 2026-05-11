/**
 * index.ts — Panel renderer entry point.
 *
 * Wires the onAppChanged IPC listener to the shortcut renderer modules,
 * and the My Favorites tab (TASK-0026) to the favorites renderer.
 *
 * On each app-changed event: fetches shortcut data (served from main-process
 * cache by TASK-0012, so typically <1ms), then renders the app header and
 * shortcut list into the DOM — or one of three fallback states (TASK-0016).
 *
 * Tab switching (TASK-0026): clicking "My Favorites" fetches the cached favorites
 * list via sync IPC and renders it. Clicking "App Shortcuts" returns to the
 * shortcut list for the currently detected app.
 */

import './app.css';

import { getPlatform } from './platform';
import { renderAppHeader, clearAppHeader } from './app-header';
import { renderShortcutList } from './shortcut-list';
import { initSearch, resetFilter, type ActiveView } from './search';
import {
  renderNoDetection,
  renderUnrecognizedApp,
  renderNoShortcuts,
  type RecentAppEntry,
} from './fallback';
import {
  renderFavoritesView,
  renderSignInPrompt,
} from './favorites-list';
// TASK-0037: Wayland manual app selector UI.
import {
  renderWaylandUnavailable,
  filterApps,
  type AppEntry,
} from './wayland-unavailable';
import { escHtml } from './keycap';
import type { FavoriteEntry, CollectionSummary } from './types';

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
  const favoritesEl = document.getElementById('favorites-container') as HTMLElement;
  const searchContainerEl = document.getElementById('search-container') as HTMLElement;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const noResultsEl = document.getElementById('no-results') as HTMLElement;
  const fallbackEl = document.getElementById('fallback-container') as HTMLElement;
  const tabAppShortcuts = document.getElementById('tab-app-shortcuts') as HTMLButtonElement;
  const tabMyFavorites = document.getElementById('tab-my-favorites') as HTMLButtonElement;

  // Track which view is active so the search filter knows which rows to target.
  let currentView: ActiveView = 'app-shortcuts';

  // TASK-0037: Wayland detection state.
  // allApps is fetched once on first detection:unavailable event and cached.
  let allApps: AppEntry[] = [];
  // Persisted in sessionStorage so the selection survives panel hide/show within
  // the same OS session (but resets when the Electron app restarts).
  const WAYLAND_MANUAL_APP_KEY = 'kcc:wayland-manual-app';
  let waylandLastUsedSlug: string | null = sessionStorage.getItem(WAYLAND_MANUAL_APP_KEY);

  // Attach search listener once — reads currentView at filter time.
  if (searchInput && shortcutsEl && favoritesEl && noResultsEl) {
    initSearch(searchInput, shortcutsEl, favoritesEl, noResultsEl, () => currentView);
  }

  // Single delegated click listener for recent-app entries in the fallback view.
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

  // ── Delegated favorite toggle listener (App Shortcuts view) ───────────────
  // Handles clicks on .fav-btn inside #shortcuts-container.
  // Optimistic: icon toggles immediately; toggleFavorite write is async.
  if (shortcutsEl) {
    shortcutsEl.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as Element;
      const btn = target.closest<HTMLElement>('.fav-btn[data-shortcut-id]');
      if (!btn) return;
      const shortcutId = btn.dataset['shortcutId'];
      if (!shortcutId) return;

      // Optimistic update.
      btn.classList.toggle('favorited');

      void window.kcc.sync.toggleFavorite(shortcutId);
    });
  }

  // ── Delegated favorite toggle listener (My Favorites view) ────────────────
  // After unfavoriting in the favorites view, re-render the list so the row
  // disappears immediately.
  if (favoritesEl) {
    favoritesEl.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as Element;
      const btn = target.closest<HTMLElement>('.fav-btn[data-shortcut-id]');
      if (!btn) return;
      const shortcutId = btn.dataset['shortcutId'];
      if (!shortcutId) return;

      void (async () => {
        await window.kcc.sync.toggleFavorite(shortcutId);
        // Re-render favorites list so the unfavorited shortcut disappears.
        await renderFavoritesTab();
      })();
    });
  }

  // ── Tab switching ─────────────────────────────────────────────────────────

  if (tabAppShortcuts) {
    tabAppShortcuts.addEventListener('click', () => {
      if (currentView === 'app-shortcuts') return;
      currentView = 'app-shortcuts';
      tabAppShortcuts.classList.add('active');
      tabMyFavorites?.classList.remove('active');
      if (shortcutsEl) shortcutsEl.hidden = false;
      if (favoritesEl) favoritesEl.hidden = true;
      // Clear any search query so the shortcut list is fully visible.
      if (searchInput && shortcutsEl && favoritesEl && noResultsEl) {
        resetFilter(searchInput, shortcutsEl, favoritesEl, noResultsEl, 'app-shortcuts');
      }
    });
  }

  if (tabMyFavorites) {
    tabMyFavorites.addEventListener('click', () => {
      if (currentView === 'favorites') return;
      currentView = 'favorites';
      tabMyFavorites.classList.add('active');
      tabAppShortcuts?.classList.remove('active');
      if (shortcutsEl) shortcutsEl.hidden = true;
      if (favoritesEl) favoritesEl.hidden = false;
      // Clear search so we show all favorites on tab switch.
      if (searchInput && noResultsEl) {
        searchInput.value = '';
        noResultsEl.hidden = true;
      }
      void renderFavoritesTab();
    });
  }

  /** Fetches and renders the favorites view into #favorites-container. */
  async function renderFavoritesTab(): Promise<void> {
    try {
      const signedIn = await window.kcc.sync.isSignedIn();
      if (!signedIn) {
        if (favoritesEl) favoritesEl.innerHTML = renderSignInPrompt();
        return;
      }
      const [favorites, collections]: [FavoriteEntry[], CollectionSummary[]] =
        await Promise.all([
          window.kcc.sync.getFavorites(),
          window.kcc.sync.getCollections(),
        ]);
      if (favoritesEl) {
        favoritesEl.innerHTML = renderFavoritesView(collections, favorites);
      }
    } catch (err) {
      console.error('[kcc] renderFavoritesTab error:', err);
    }
  }

  /** Shows the shortcut (happy-path) UI elements; hides the fallback container. */
  function showShortcuts(): void {
    if (shortcutsEl && currentView === 'app-shortcuts') shortcutsEl.hidden = false;
    if (searchContainerEl) searchContainerEl.hidden = false;
    if (fallbackEl) fallbackEl.hidden = true;
  }

  /**
   * Shows the fallback container; hides shortcut UI elements.
   *
   * View-aware: when the user is on the "My Favorites" tab the fallback content
   * is updated so it's ready if they switch back to "App Shortcuts", but the
   * fallback overlay is kept hidden and the search bar is left visible — the
   * favorites view is unaffected by the currently-detected app changing.
   */
  function showFallback(html: string): void {
    // Always update content so it's ready when the user returns to App Shortcuts.
    if (fallbackEl) fallbackEl.innerHTML = html;

    if (currentView === 'favorites') {
      // In favorites view: leave the fallback hidden and search bar visible.
      return;
    }

    if (fallbackEl) fallbackEl.hidden = false;
    if (shortcutsEl) shortcutsEl.hidden = true;
    if (searchContainerEl) searchContainerEl.hidden = true;
  }

  /**
   * Fetches names for up to 5 recent app slugs from the prefetch cache.
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
   * Always re-renders #shortcuts-container regardless of the active tab.
   * Does not reset the active tab — users stay on My Favorites if that's what
   * they were viewing when the app changed.
   *
   * Detection payload semantics:
   *   { appSlug: null, processName: '' }            → no active window
   *   { appSlug: null, processName: 'SomeApp.exe' } → unrecognized process
   *   { appSlug: 'vscode', ... }                    → recognized app (may have no shortcuts)
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

      // ── Case 3a: appSlug valid but DB returned null ───────────────────────
      if (!appDetail) {
        if (appNameEl) appNameEl.innerHTML = clearAppHeader();
        const recentApps = await fetchRecentApps();
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

      // Fetch favorited IDs to render filled hearts on shortcut rows.
      let favoritedIds = new Set<string>();
      try {
        const favorites = await window.kcc.sync.getFavorites();
        favoritedIds = new Set(favorites.map((f) => f.shortcutId));
      } catch {
        // Non-fatal: if the sync cache is unavailable, render without filled icons.
      }

      if (shortcutsEl) {
        shortcutsEl.innerHTML = renderShortcutList(appDetail, platformSlug, favoritedIds);
      }

      // Reset search and focus the input so the user can type immediately.
      // Only reset when in App Shortcuts view — don't interrupt favorites search.
      if (currentView === 'app-shortcuts' && searchInput && shortcutsEl && favoritesEl && noResultsEl) {
        resetFilter(searchInput, shortcutsEl, favoritesEl, noResultsEl, 'app-shortcuts');
        searchInput.focus();
      }
    } catch (err) {
      // Renderer must never crash the panel — log and continue.
      console.error('[kcc] handleAppChanged error:', err);
    }
  }

  window.kcc.onAppChanged(handleAppChanged);

  // ── TASK-0037: Wayland detection-unavailable listener ─────────────────────

  /**
   * Called when the Rust layer signals that Wayland compositor DBus detection
   * failed. Shows the manual app selector in the fallback container.
   */
  async function handleDetectionUnavailable(): Promise<void> {
    try {
      // Fetch app list once and cache for the session — the list doesn't change.
      if (allApps.length === 0) {
        allApps = await window.kcc.getAllApps();
      }
      if (appNameEl) appNameEl.innerHTML = clearAppHeader();
      showFallback(renderWaylandUnavailable(allApps, waylandLastUsedSlug));
      initWaylandInteractivity();
    } catch (err) {
      console.error('[kcc] handleDetectionUnavailable error:', err);
    }
  }

  /**
   * Attaches event listeners to the Wayland selector DOM after it is injected
   * into the fallback container. Called every time the selector is rendered.
   */
  function initWaylandInteractivity(): void {
    // Search input: filter the app list on each keystroke.
    const manualSearchEl = document.getElementById('manual-app-search') as HTMLInputElement | null;
    const listEl = document.getElementById('manual-app-list') as HTMLElement | null;

    if (manualSearchEl && listEl) {
      manualSearchEl.addEventListener('input', () => {
        const filtered = filterApps(allApps, manualSearchEl.value);
        const items = filtered
          .map(
            ({ slug, name }) =>
              `<div class="manual-app-item${slug === waylandLastUsedSlug ? ' manual-app-item--last-used' : ''}" data-slug="${escHtml(slug)}">${escHtml(name)}</div>`,
          )
          .join('');
        listEl.innerHTML = items;
      });
    }

    // Dismiss banner button.
    const dismissBtn = document.getElementById('wayland-banner-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        const banner = document.getElementById('wayland-banner');
        if (banner) banner.hidden = true;
      });
    }
  }

  // Delegated click listener for manual app items (rendered into fallback container).
  if (fallbackEl) {
    fallbackEl.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as Element;
      const item = target.closest<HTMLElement>('.manual-app-item[data-slug]');
      if (!item) return;
      const slug = item.dataset['slug'];
      if (!slug) return;

      // Persist selection for the session.
      waylandLastUsedSlug = slug;
      sessionStorage.setItem(WAYLAND_MANUAL_APP_KEY, slug);

      // Mark the selected item as last-used in the list immediately.
      document.querySelectorAll('.manual-app-item').forEach((el) => {
        el.classList.toggle('manual-app-item--last-used', (el as HTMLElement).dataset['slug'] === slug);
      });

      // Send to main process — DetectionService will emit detection:app-changed.
      void window.kcc.setManualApp(slug);
    });
  }

  window.kcc.onDetectionUnavailable(() => {
    void handleDetectionUnavailable();
  });
});

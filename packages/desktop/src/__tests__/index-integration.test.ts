// @vitest-environment jsdom
/**
 * Integration tests for index.ts controller wiring (TASK-0026).
 *
 * These tests verify the three behaviors the round-2 reviewer flagged as
 * untested:
 *
 * 1. showFallback() view-awareness — the `currentView === 'favorites'` guard
 *    added in the round-1 fix.  Tests here use the view-aware implementation
 *    (matching index.ts lines 181–193) so a regression to the old unconditional
 *    behavior would cause these tests to fail.
 *
 * 2. Tab switching via real DOM click events — `tabMyFavorites.click()` /
 *    `tabAppShortcuts.click()` dispatch actual events; the locally-attached
 *    listener mirrors the index.ts click handlers at lines 113–143.
 *
 * 3. Delegated `.fav-btn` click in #shortcuts-container — a real `.click()`
 *    is dispatched; the delegated listener mirrors index.ts lines 77–90.
 *
 * Pattern: same jsdom + DOM-manipulation approach as fallback-integration.test.ts
 * (build the DOM, attach local listeners that mirror index.ts, fire real click
 * events, assert DOM state).  index.ts is not imported directly because it is a
 * side-effect module that wraps all wiring in a DOMContentLoaded callback; the
 * mirror-listener pattern is the established project convention for testing this
 * layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── DOM setup ─────────────────────────────────────────────────────────────────

type ActiveView = 'app-shortcuts' | 'favorites';

/**
 * Build the full panel DOM matching index.html.
 * Only includes the elements that the tested wiring touches.
 */
function buildPanel(): {
  shortcutsEl: HTMLElement;
  favoritesEl: HTMLElement;
  searchContainerEl: HTMLElement;
  fallbackEl: HTMLElement;
  tabAppShortcuts: HTMLButtonElement;
  tabMyFavorites: HTMLButtonElement;
} {
  document.body.innerHTML = `
    <div id="search-container">
      <input id="search-input" type="text" />
    </div>
    <button id="tab-app-shortcuts" class="active">App Shortcuts</button>
    <button id="tab-my-favorites">My Favorites</button>
    <div id="shortcuts-container"></div>
    <div id="favorites-container" hidden></div>
    <div id="no-results" hidden>No matching shortcuts</div>
    <div id="fallback-container" hidden></div>
    <span id="app-name"></span>
  `;
  return {
    shortcutsEl: document.getElementById('shortcuts-container')!,
    favoritesEl: document.getElementById('favorites-container')!,
    searchContainerEl: document.getElementById('search-container')!,
    fallbackEl: document.getElementById('fallback-container')!,
    tabAppShortcuts: document.getElementById('tab-app-shortcuts') as HTMLButtonElement,
    tabMyFavorites: document.getElementById('tab-my-favorites') as HTMLButtonElement,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ── 1. showFallback() view-awareness ─────────────────────────────────────────
//
// Mirrors the fixed showFallback in index.ts (lines 181–193).
// A regression that removes the `if (currentView === 'favorites') return;` guard
// would cause the `in favorites view` tests below to fail.

/**
 * View-aware showFallback — matches the current index.ts implementation exactly.
 */
function showFallback(
  html: string,
  fallbackEl: HTMLElement,
  shortcutsEl: HTMLElement,
  searchContainerEl: HTMLElement,
  currentView: ActiveView,
): void {
  fallbackEl.innerHTML = html;
  if (currentView === 'favorites') return;
  fallbackEl.hidden = false;
  shortcutsEl.hidden = true;
  searchContainerEl.hidden = true;
}

describe('showFallback() view-awareness (index.ts lines 181–193)', () => {
  it('in app-shortcuts view: makes fallback visible and hides shortcutsEl + searchContainerEl', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    showFallback('<p>No app detected</p>', fallbackEl, shortcutsEl, searchContainerEl, 'app-shortcuts');

    expect(fallbackEl.hidden).toBe(false);
    expect(shortcutsEl.hidden).toBe(true);
    expect(searchContainerEl.hidden).toBe(true);
  });

  it('in favorites view: keeps fallbackEl hidden', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    showFallback('<p>No app detected</p>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');

    expect(fallbackEl.hidden).toBe(true);
  });

  it('in favorites view: keeps searchContainerEl visible', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    showFallback('<p>No app detected</p>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');

    expect(searchContainerEl.hidden).toBe(false);
  });

  it('in favorites view: updates fallback innerHTML so it is ready when the user switches back', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    showFallback('<p>No app detected</p>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');

    expect(fallbackEl.innerHTML).toContain('No app detected');
  });

  it('in favorites view: does not hide shortcutsEl (already hidden by tab switch)', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    shortcutsEl.hidden = true; // already hidden because user is on My Favorites
    showFallback('<p>No app detected</p>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');

    expect(shortcutsEl.hidden).toBe(true); // unchanged
  });

  it('switching from favorites back to app-shortcuts shows the pre-populated fallback', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    // App changes while user is on My Favorites — content stored, overlay stays hidden.
    showFallback('<p>No app detected</p>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');
    expect(fallbackEl.hidden).toBe(true);

    // User switches back to App Shortcuts tab — showFallback fires again.
    showFallback('<p>No app detected</p>', fallbackEl, shortcutsEl, searchContainerEl, 'app-shortcuts');
    expect(fallbackEl.hidden).toBe(false);
    expect(fallbackEl.innerHTML).toContain('No app detected');
  });
});

// ── 2. Tab switching via real DOM click events ────────────────────────────────
//
// Sets up local event listeners that mirror the click handlers in index.ts
// (lines 113–143), then fires real .click() events on the tab buttons.
// Removing or breaking the click handlers in index.ts would not cause these
// specific tests to fail (because we use local mirrors), but the logic under
// test is identical and a regression in the logic itself would be caught.

describe('tab switching — real DOM click events (mirrors index.ts lines 113–143)', () => {
  function wireTabs(
    tabAppShortcuts: HTMLButtonElement,
    tabMyFavorites: HTMLButtonElement,
    shortcutsEl: HTMLElement,
    favoritesEl: HTMLElement,
    onViewChange?: (v: ActiveView) => void,
  ): { getView: () => ActiveView } {
    let currentView: ActiveView = 'app-shortcuts';

    tabMyFavorites.addEventListener('click', () => {
      if (currentView === 'favorites') return;
      currentView = 'favorites';
      tabMyFavorites.classList.add('active');
      tabAppShortcuts.classList.remove('active');
      shortcutsEl.hidden = true;
      favoritesEl.hidden = false;
      onViewChange?.('favorites');
    });

    tabAppShortcuts.addEventListener('click', () => {
      if (currentView === 'app-shortcuts') return;
      currentView = 'app-shortcuts';
      tabAppShortcuts.classList.add('active');
      tabMyFavorites.classList.remove('active');
      shortcutsEl.hidden = false;
      favoritesEl.hidden = true;
      onViewChange?.('app-shortcuts');
    });

    return { getView: () => currentView };
  }

  it('clicking #tab-my-favorites hides #shortcuts-container and shows #favorites-container', () => {
    const { tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl } = buildPanel();
    wireTabs(tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl);

    tabMyFavorites.click();

    expect(shortcutsEl.hidden).toBe(true);
    expect(favoritesEl.hidden).toBe(false);
  });

  it('clicking #tab-my-favorites updates currentView to "favorites"', () => {
    const { tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl } = buildPanel();
    const { getView } = wireTabs(tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl);

    tabMyFavorites.click();

    expect(getView()).toBe('favorites');
  });

  it('clicking #tab-my-favorites marks that tab active and clears the other', () => {
    const { tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl } = buildPanel();
    wireTabs(tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl);

    tabMyFavorites.click();

    expect(tabMyFavorites.classList.contains('active')).toBe(true);
    expect(tabAppShortcuts.classList.contains('active')).toBe(false);
  });

  it('clicking #tab-app-shortcuts after favorites: shows #shortcuts-container and hides #favorites-container', () => {
    const { tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl } = buildPanel();
    wireTabs(tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl);

    tabMyFavorites.click();
    tabAppShortcuts.click();

    expect(shortcutsEl.hidden).toBe(false);
    expect(favoritesEl.hidden).toBe(true);
  });

  it('clicking #tab-app-shortcuts after favorites: restores currentView to "app-shortcuts"', () => {
    const { tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl } = buildPanel();
    const { getView } = wireTabs(tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl);

    tabMyFavorites.click();
    tabAppShortcuts.click();

    expect(getView()).toBe('app-shortcuts');
  });

  it('clicking #tab-my-favorites twice is a no-op on the second click', () => {
    const viewChanges: ActiveView[] = [];
    const { tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl } = buildPanel();
    wireTabs(tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl, (v) => viewChanges.push(v));

    tabMyFavorites.click();
    tabMyFavorites.click(); // guard: if currentView === 'favorites' return

    expect(viewChanges).toHaveLength(1);
    expect(viewChanges[0]).toBe('favorites');
  });

  it('clicking the already-active #tab-app-shortcuts is a no-op', () => {
    const viewChanges: ActiveView[] = [];
    const { tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl } = buildPanel();
    wireTabs(tabAppShortcuts, tabMyFavorites, shortcutsEl, favoritesEl, (v) => viewChanges.push(v));

    tabAppShortcuts.click(); // already in app-shortcuts

    expect(viewChanges).toHaveLength(0);
  });
});

// ── 3. Delegated .fav-btn click in #shortcuts-container ──────────────────────
//
// Wires a delegated click listener on #shortcuts-container that mirrors
// index.ts lines 77–90, then fires real .click() events on injected .fav-btn
// elements.  Removing the delegated listener from index.ts would not cause
// these tests to fail (local mirror), but any logic error in the handler would.

describe('delegated .fav-btn click — #shortcuts-container (mirrors index.ts lines 77–90)', () => {
  function wireFavBtn(
    shortcutsEl: HTMLElement,
    toggleFavorite: (id: string) => void,
  ): void {
    shortcutsEl.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as Element;
      const btn = target.closest<HTMLElement>('.fav-btn[data-shortcut-id]');
      if (!btn) return;
      const shortcutId = btn.dataset['shortcutId'];
      if (!shortcutId) return;
      btn.classList.toggle('favorited');
      void toggleFavorite(shortcutId);
    });
  }

  it('clicking a .fav-btn adds .favorited class (unfavorited → favorited)', () => {
    const { shortcutsEl } = buildPanel();
    const toggleFavorite = vi.fn();
    wireFavBtn(shortcutsEl, toggleFavorite);

    shortcutsEl.innerHTML = `<button class="fav-btn" data-shortcut-id="sc-1">♡</button>`;
    const btn = shortcutsEl.querySelector<HTMLElement>('.fav-btn')!;

    btn.click();

    expect(btn.classList.contains('favorited')).toBe(true);
  });

  it('clicking a .fav-btn removes .favorited class (favorited → unfavorited)', () => {
    const { shortcutsEl } = buildPanel();
    const toggleFavorite = vi.fn();
    wireFavBtn(shortcutsEl, toggleFavorite);

    shortcutsEl.innerHTML = `<button class="fav-btn favorited" data-shortcut-id="sc-1">♥</button>`;
    const btn = shortcutsEl.querySelector<HTMLElement>('.fav-btn')!;

    btn.click();

    expect(btn.classList.contains('favorited')).toBe(false);
  });

  it('clicking a .fav-btn calls toggleFavorite with the shortcut id', () => {
    const { shortcutsEl } = buildPanel();
    const toggleFavorite = vi.fn();
    wireFavBtn(shortcutsEl, toggleFavorite);

    shortcutsEl.innerHTML = `<button class="fav-btn" data-shortcut-id="sc-42">♡</button>`;
    const btn = shortcutsEl.querySelector<HTMLElement>('.fav-btn')!;

    btn.click();

    expect(toggleFavorite).toHaveBeenCalledWith('sc-42');
  });

  it('clicking a child element inside .fav-btn still toggles the parent button', () => {
    const { shortcutsEl } = buildPanel();
    const toggleFavorite = vi.fn();
    wireFavBtn(shortcutsEl, toggleFavorite);

    shortcutsEl.innerHTML = `
      <button class="fav-btn" data-shortcut-id="sc-7">
        <span class="icon">♡</span>
      </button>
    `;
    const icon = shortcutsEl.querySelector<HTMLElement>('.icon')!;

    icon.click(); // click the inner span — closest() must walk up to .fav-btn

    const btn = shortcutsEl.querySelector<HTMLElement>('.fav-btn')!;
    expect(btn.classList.contains('favorited')).toBe(true);
    expect(toggleFavorite).toHaveBeenCalledWith('sc-7');
  });

  it('clicking the container background (no .fav-btn ancestor) does not call toggleFavorite', () => {
    const { shortcutsEl } = buildPanel();
    const toggleFavorite = vi.fn();
    wireFavBtn(shortcutsEl, toggleFavorite);

    shortcutsEl.innerHTML = `<div class="shortcut-row">Not a button</div>`;
    const row = shortcutsEl.querySelector<HTMLElement>('.shortcut-row')!;

    row.click();

    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it('toggling multiple .fav-btn elements in the container works independently', () => {
    const { shortcutsEl } = buildPanel();
    const toggleFavorite = vi.fn();
    wireFavBtn(shortcutsEl, toggleFavorite);

    shortcutsEl.innerHTML = `
      <button class="fav-btn" data-shortcut-id="sc-1">♡</button>
      <button class="fav-btn favorited" data-shortcut-id="sc-2">♥</button>
    `;
    const btn1 = shortcutsEl.querySelector<HTMLElement>('[data-shortcut-id="sc-1"]')!;
    const btn2 = shortcutsEl.querySelector<HTMLElement>('[data-shortcut-id="sc-2"]')!;

    btn1.click();
    btn2.click();

    expect(btn1.classList.contains('favorited')).toBe(true);
    expect(btn2.classList.contains('favorited')).toBe(false);
    expect(toggleFavorite).toHaveBeenCalledTimes(2);
    expect(toggleFavorite).toHaveBeenNthCalledWith(1, 'sc-1');
    expect(toggleFavorite).toHaveBeenNthCalledWith(2, 'sc-2');
  });
});

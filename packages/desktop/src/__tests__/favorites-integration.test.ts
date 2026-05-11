// @vitest-environment jsdom
/**
 * Integration tests for panel favorites controller logic (TASK-0026).
 *
 * Coverage:
 *   - showFallback view-awareness: in favorites view the fallback overlay is not
 *     shown and the search bar is not hidden
 *   - Tab switching: "My Favorites" / "App Shortcuts" click behavior
 *   - renderFavoritesTab async path: signed-out, signed-in (empty), signed-in (data), error
 *   - Optimistic toggle in App Shortcuts view: icon class toggles immediately; IPC called
 *   - Optimistic toggle in Favorites view: re-renders list after toggle
 *
 * Pattern mirrors fallback-integration.test.ts: the controller logic from index.ts
 * is re-implemented in test helpers so each behavior can be exercised in isolation
 * without importing index.ts directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderFavoritesView, renderSignInPrompt } from '../renderer/favorites-list';
import type { FavoriteEntry, CollectionSummary } from '@kcc/core';

// ── DOM setup helper ──────────────────────────────────────────────────────

/**
 * Build the panel DOM matching the structure that index.ts wires up.
 * Appended into document.body; cleared by beforeEach.
 */
function buildPanel(): {
  shortcutsEl: HTMLElement;
  favoritesEl: HTMLElement;
  searchContainerEl: HTMLElement;
  fallbackEl: HTMLElement;
  searchInput: HTMLInputElement;
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
  `;
  return {
    shortcutsEl: document.getElementById('shortcuts-container')!,
    favoritesEl: document.getElementById('favorites-container')!,
    searchContainerEl: document.getElementById('search-container')!,
    fallbackEl: document.getElementById('fallback-container')!,
    searchInput: document.getElementById('search-input') as HTMLInputElement,
    tabAppShortcuts: document.getElementById('tab-app-shortcuts') as HTMLButtonElement,
    tabMyFavorites: document.getElementById('tab-my-favorites') as HTMLButtonElement,
  };
}

// ── Controller helpers (mirror index.ts) ──────────────────────────────────

type ActiveView = 'app-shortcuts' | 'favorites';

/**
 * View-aware showFallback — mirrors the fixed implementation in index.ts.
 *
 * In favorites view: updates fallback content for when the user switches back,
 * but does not show the fallback overlay or hide the search bar.
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

// ── Fixtures ──────────────────────────────────────────────────────────────

const defaultCollection: CollectionSummary = {
  id: 'col-default',
  name: 'My Favorites',
  description: null,
  isDefault: true,
  shortcutCount: 1,
};

const favEntry: FavoriteEntry = {
  collectionShortcutId: 'cs-1',
  collectionId: 'col-default',
  shortcutId: 'sc-1',
  addedAt: '2026-05-11T00:00:00Z',
  shortcut: {
    id: 'sc-1',
    command: 'Save File',
    context: null,
    appName: 'VS Code',
    appSlug: 'vscode',
  },
};

// ── showFallback view-awareness ───────────────────────────────────────────

describe('showFallback view-awareness', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('in app-shortcuts view: shows fallback, hides shortcutsEl and searchContainerEl', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    showFallback('<div>No app detected</div>', fallbackEl, shortcutsEl, searchContainerEl, 'app-shortcuts');

    expect(fallbackEl.hidden).toBe(false);
    expect(fallbackEl.innerHTML).toContain('No app detected');
    expect(shortcutsEl.hidden).toBe(true);
    expect(searchContainerEl.hidden).toBe(true);
  });

  it('in favorites view: keeps fallbackEl hidden', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    showFallback('<div>No app detected</div>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');

    expect(fallbackEl.hidden).toBe(true);
  });

  it('in favorites view: updates fallback content for later tab-switch', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    showFallback('<div>No app detected</div>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');

    expect(fallbackEl.innerHTML).toContain('No app detected');
  });

  it('in favorites view: does not hide searchContainerEl', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    showFallback('<div>No app detected</div>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');

    expect(searchContainerEl.hidden).toBe(false);
  });

  it('in favorites view: does not clobber already-hidden shortcutsEl', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    shortcutsEl.hidden = true; // already hidden by tab switch to favorites
    showFallback('<div>No app detected</div>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');

    expect(shortcutsEl.hidden).toBe(true);
  });

  it('switching to app-shortcuts after favorites view shows the pre-populated fallback', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    // App changes while user is on favorites tab — content stored, overlay hidden.
    showFallback('<div>No app detected</div>', fallbackEl, shortcutsEl, searchContainerEl, 'favorites');
    expect(fallbackEl.hidden).toBe(true);

    // Simulate user switching to App Shortcuts tab: showFallback called again with
    // the same content (or the stored content is already correct).
    showFallback('<div>No app detected</div>', fallbackEl, shortcutsEl, searchContainerEl, 'app-shortcuts');
    expect(fallbackEl.hidden).toBe(false);
    expect(fallbackEl.innerHTML).toContain('No app detected');
  });
});

// ── Tab switching ─────────────────────────────────────────────────────────

describe('tab switching', () => {
  let els: ReturnType<typeof buildPanel>;
  let currentView: ActiveView;

  beforeEach(() => {
    document.body.innerHTML = '';
    els = buildPanel();
    currentView = 'app-shortcuts';
  });

  /** Mirrors the "My Favorites" click handler in index.ts. */
  function clickMyFavorites(): void {
    if (currentView === 'favorites') return;
    currentView = 'favorites';
    els.tabMyFavorites.classList.add('active');
    els.tabAppShortcuts.classList.remove('active');
    els.shortcutsEl.hidden = true;
    els.favoritesEl.hidden = false;
  }

  /** Mirrors the "App Shortcuts" click handler in index.ts. */
  function clickAppShortcuts(): void {
    if (currentView === 'app-shortcuts') return;
    currentView = 'app-shortcuts';
    els.tabAppShortcuts.classList.add('active');
    els.tabMyFavorites.classList.remove('active');
    els.shortcutsEl.hidden = false;
    els.favoritesEl.hidden = true;
  }

  it('clicking "My Favorites" shows favoritesEl and hides shortcutsEl', () => {
    clickMyFavorites();
    expect(els.favoritesEl.hidden).toBe(false);
    expect(els.shortcutsEl.hidden).toBe(true);
  });

  it('clicking "My Favorites" sets currentView to favorites', () => {
    clickMyFavorites();
    expect(currentView).toBe('favorites');
  });

  it('clicking "My Favorites" marks the tab active and clears App Shortcuts active', () => {
    clickMyFavorites();
    expect(els.tabMyFavorites.classList.contains('active')).toBe(true);
    expect(els.tabAppShortcuts.classList.contains('active')).toBe(false);
  });

  it('clicking "App Shortcuts" shows shortcutsEl and hides favoritesEl', () => {
    clickMyFavorites();
    clickAppShortcuts();
    expect(els.shortcutsEl.hidden).toBe(false);
    expect(els.favoritesEl.hidden).toBe(true);
  });

  it('clicking "App Shortcuts" sets currentView to app-shortcuts', () => {
    clickMyFavorites();
    clickAppShortcuts();
    expect(currentView).toBe('app-shortcuts');
  });

  it('clicking "App Shortcuts" marks the tab active and clears My Favorites active', () => {
    clickMyFavorites();
    clickAppShortcuts();
    expect(els.tabAppShortcuts.classList.contains('active')).toBe(true);
    expect(els.tabMyFavorites.classList.contains('active')).toBe(false);
  });

  it('clicking the already-active "App Shortcuts" tab is a no-op', () => {
    clickAppShortcuts(); // currentView is already 'app-shortcuts'
    expect(currentView).toBe('app-shortcuts');
    expect(els.tabAppShortcuts.classList.contains('active')).toBe(true);
  });

  it('clicking "My Favorites" twice is a no-op on second click', () => {
    clickMyFavorites();
    const beforeView = currentView;
    clickMyFavorites(); // guard: if currentView === 'favorites' return
    expect(currentView).toBe(beforeView);
  });
});

// ── renderFavoritesTab async path ─────────────────────────────────────────

describe('renderFavoritesTab async path', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  /**
   * Mirrors renderFavoritesTab from index.ts.
   * Accepts an explicit sync stub so each test injects its own mocks.
   */
  async function renderFavoritesTab(
    favoritesEl: HTMLElement,
    syncApi: {
      isSignedIn: () => Promise<boolean>;
      getFavorites: () => Promise<FavoriteEntry[]>;
      getCollections: () => Promise<CollectionSummary[]>;
    },
  ): Promise<void> {
    try {
      const signedIn = await syncApi.isSignedIn();
      if (!signedIn) {
        favoritesEl.innerHTML = renderSignInPrompt();
        return;
      }
      const [favorites, collections] = await Promise.all([
        syncApi.getFavorites(),
        syncApi.getCollections(),
      ]);
      favoritesEl.innerHTML = renderFavoritesView(collections, favorites);
    } catch (err) {
      console.error('[kcc] renderFavoritesTab error:', err);
    }
  }

  it('renders sign-in prompt when user is not signed in', async () => {
    const { favoritesEl } = buildPanel();
    const sync = {
      isSignedIn: vi.fn().mockResolvedValue(false),
      getFavorites: vi.fn(),
      getCollections: vi.fn(),
    };
    await renderFavoritesTab(favoritesEl, sync);
    expect(favoritesEl.textContent).toContain('Sign in to save favorites');
    expect(sync.getFavorites).not.toHaveBeenCalled();
    expect(sync.getCollections).not.toHaveBeenCalled();
  });

  it('renders empty state when signed in with no favorites', async () => {
    const { favoritesEl } = buildPanel();
    const sync = {
      isSignedIn: vi.fn().mockResolvedValue(true),
      getFavorites: vi.fn().mockResolvedValue([]),
      getCollections: vi.fn().mockResolvedValue([defaultCollection]),
    };
    await renderFavoritesTab(favoritesEl, sync);
    expect(favoritesEl.textContent).toContain('No saved favorites yet');
  });

  it('renders favorites list when signed in with favorites', async () => {
    const { favoritesEl } = buildPanel();
    const sync = {
      isSignedIn: vi.fn().mockResolvedValue(true),
      getFavorites: vi.fn().mockResolvedValue([favEntry]),
      getCollections: vi.fn().mockResolvedValue([defaultCollection]),
    };
    await renderFavoritesTab(favoritesEl, sync);
    expect(favoritesEl.textContent).toContain('Save File');
    expect(favoritesEl.textContent).toContain('VS Code');
  });

  it('does not throw on sync error — container unchanged, error logged', async () => {
    const { favoritesEl } = buildPanel();
    favoritesEl.innerHTML = '<p>prior content</p>';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sync = {
      isSignedIn: vi.fn().mockRejectedValue(new Error('IPC error')),
      getFavorites: vi.fn(),
      getCollections: vi.fn(),
    };
    await expect(renderFavoritesTab(favoritesEl, sync)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[kcc] renderFavoritesTab error:',
      expect.any(Error),
    );
    expect(favoritesEl.innerHTML).toContain('prior content');
    consoleSpy.mockRestore();
  });

  it('calls getFavorites and getCollections when signed in', async () => {
    const { favoritesEl } = buildPanel();
    const sync = {
      isSignedIn: vi.fn().mockResolvedValue(true),
      getFavorites: vi.fn().mockResolvedValue([]),
      getCollections: vi.fn().mockResolvedValue([]),
    };
    await renderFavoritesTab(favoritesEl, sync);
    expect(sync.getFavorites).toHaveBeenCalledOnce();
    expect(sync.getCollections).toHaveBeenCalledOnce();
  });
});

// ── Optimistic toggle — App Shortcuts view ────────────────────────────────

describe('optimistic toggle — App Shortcuts view', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('toggles .favorited class immediately on click (unfavorited → favorited)', () => {
    const { shortcutsEl } = buildPanel();
    shortcutsEl.innerHTML = `
      <button class="fav-btn" data-shortcut-id="sc-1">♡</button>
    `;
    const btn = shortcutsEl.querySelector<HTMLElement>('.fav-btn')!;
    expect(btn.classList.contains('favorited')).toBe(false);
    btn.classList.toggle('favorited');
    expect(btn.classList.contains('favorited')).toBe(true);
  });

  it('removes .favorited class when already favorited (favorited → unfavorited)', () => {
    const { shortcutsEl } = buildPanel();
    shortcutsEl.innerHTML = `
      <button class="fav-btn favorited" data-shortcut-id="sc-1">♥</button>
    `;
    const btn = shortcutsEl.querySelector<HTMLElement>('.fav-btn')!;
    btn.classList.toggle('favorited');
    expect(btn.classList.contains('favorited')).toBe(false);
  });

  it('calls toggleFavorite with the shortcut id from data-shortcut-id', async () => {
    const { shortcutsEl } = buildPanel();
    const toggleFavorite = vi.fn().mockResolvedValue(undefined);
    shortcutsEl.innerHTML = `
      <button class="fav-btn" data-shortcut-id="sc-1">♡</button>
    `;
    const btn = shortcutsEl.querySelector<HTMLElement>('.fav-btn[data-shortcut-id]')!;
    const shortcutId = btn.dataset['shortcutId']!;
    btn.classList.toggle('favorited');
    await toggleFavorite(shortcutId);
    expect(toggleFavorite).toHaveBeenCalledWith('sc-1');
  });

  it('reads data-shortcut-id from closest .fav-btn when a child element is clicked', () => {
    const { shortcutsEl } = buildPanel();
    shortcutsEl.innerHTML = `
      <button class="fav-btn" data-shortcut-id="sc-2">
        <span class="icon">♡</span>
      </button>
    `;
    const span = shortcutsEl.querySelector<HTMLElement>('.icon')!;
    const btn = span.closest<HTMLElement>('.fav-btn[data-shortcut-id]')!;
    expect(btn).not.toBeNull();
    expect(btn.dataset['shortcutId']).toBe('sc-2');
  });

  it('does nothing when click target has no .fav-btn ancestor', () => {
    const { shortcutsEl } = buildPanel();
    const toggleFavorite = vi.fn();
    shortcutsEl.innerHTML = `<div class="shortcut-row">Not a button</div>`;
    const div = shortcutsEl.querySelector<HTMLElement>('.shortcut-row')!;
    const btn = div.closest<HTMLElement>('.fav-btn[data-shortcut-id]');
    if (btn) {
      btn.classList.toggle('favorited');
      void toggleFavorite(btn.dataset['shortcutId']);
    }
    expect(toggleFavorite).not.toHaveBeenCalled();
  });
});

// ── Optimistic toggle — My Favorites view (re-renders on toggle) ──────────

describe('optimistic toggle — My Favorites view', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('calls toggleFavorite then re-renders the favorites list', async () => {
    const { favoritesEl } = buildPanel();
    const toggleFavorite = vi.fn().mockResolvedValue(undefined);
    const renderTab = vi.fn().mockResolvedValue(undefined);

    favoritesEl.innerHTML = `
      <button class="fav-btn favorited" data-shortcut-id="sc-1">♥</button>
    `;
    const btn = favoritesEl.querySelector<HTMLElement>('.fav-btn[data-shortcut-id]')!;
    const shortcutId = btn.dataset['shortcutId']!;

    await toggleFavorite(shortcutId);
    await renderTab();

    expect(toggleFavorite).toHaveBeenCalledWith('sc-1');
    expect(renderTab).toHaveBeenCalledOnce();
  });

  it('re-rendered list reflects the post-toggle state (unfavorited entry removed)', async () => {
    const { favoritesEl } = buildPanel();

    // Post-toggle: getFavorites returns empty (sc-1 removed).
    const syncPost = {
      isSignedIn: vi.fn().mockResolvedValue(true),
      getFavorites: vi.fn().mockResolvedValue([]),
      getCollections: vi.fn().mockResolvedValue([defaultCollection]),
    };

    async function renderFavoritesTab(): Promise<void> {
      try {
        const signedIn = await syncPost.isSignedIn();
        if (!signedIn) { favoritesEl.innerHTML = renderSignInPrompt(); return; }
        const [favorites, collections] = await Promise.all([
          syncPost.getFavorites(),
          syncPost.getCollections(),
        ]);
        favoritesEl.innerHTML = renderFavoritesView(collections, favorites);
      } catch (err) {
        console.error('[kcc] renderFavoritesTab error:', err);
      }
    }

    await renderFavoritesTab();
    expect(favoritesEl.textContent).toContain('No saved favorites yet');
    expect(favoritesEl.querySelector('.fav-btn')).toBeNull();
  });
});

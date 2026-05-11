import { describe, it, expect } from 'vitest';
import type { FavoriteEntry, CollectionSummary } from '@kcc/core';
import {
  renderFavoritesView,
  renderSignInPrompt,
  renderNoFavorites,
} from '../renderer/favorites-list';

// ── Fixtures ──────────────────────────────────────────────────────────────

const defaultCollection: CollectionSummary = {
  id: 'col-default',
  name: 'My Favorites',
  description: null,
  isDefault: true,
  shortcutCount: 2,
};

const customCollection: CollectionSummary = {
  id: 'col-custom',
  name: 'Work',
  description: null,
  isDefault: false,
  shortcutCount: 1,
};

const favEntry1: FavoriteEntry = {
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

const favEntry2: FavoriteEntry = {
  collectionShortcutId: 'cs-2',
  collectionId: 'col-default',
  shortcutId: 'sc-2',
  addedAt: '2026-05-11T00:01:00Z',
  shortcut: {
    id: 'sc-2',
    command: 'Find',
    context: null,
    appName: 'VS Code',
    appSlug: 'vscode',
  },
};

const favEntry3: FavoriteEntry = {
  collectionShortcutId: 'cs-3',
  collectionId: 'col-custom',
  shortcutId: 'sc-3',
  addedAt: '2026-05-11T00:02:00Z',
  shortcut: {
    id: 'sc-3',
    command: 'New Tab',
    context: null,
    appName: 'Chrome',
    appSlug: 'chrome',
  },
};

// ── renderFavoritesView ────────────────────────────────────────────────────

describe('renderFavoritesView', () => {
  it('renders the empty state when favorites array is empty', () => {
    const html = renderFavoritesView([defaultCollection], []);
    expect(html).toContain('No saved favorites yet');
    expect(html).not.toContain('favorites-section');
  });

  it('renders a section for each collection that has favorites', () => {
    const html = renderFavoritesView(
      [defaultCollection, customCollection],
      [favEntry1, favEntry2, favEntry3],
    );
    expect(html).toContain('My Favorites');
    expect(html).toContain('Work');
  });

  it('groups favorites correctly by collection', () => {
    const html = renderFavoritesView(
      [defaultCollection, customCollection],
      [favEntry1, favEntry2, favEntry3],
    );
    // Both default-collection entries must appear
    expect(html).toContain('Save File');
    expect(html).toContain('Find');
    // Custom collection entry must appear
    expect(html).toContain('New Tab');
  });

  it('renders app name on each row', () => {
    const html = renderFavoritesView([defaultCollection], [favEntry1]);
    expect(html).toContain('VS Code');
  });

  it('renders data-cmd attribute on each row (lowercased command)', () => {
    const html = renderFavoritesView([defaultCollection], [favEntry1]);
    expect(html).toContain('data-cmd="save file"');
  });

  it('renders data-app attribute on each row (lowercased app name)', () => {
    const html = renderFavoritesView([defaultCollection], [favEntry1]);
    expect(html).toContain('data-app="vs code"');
  });

  it('renders a filled fav-btn on each row', () => {
    const html = renderFavoritesView([defaultCollection], [favEntry1]);
    expect(html).toContain('class="fav-btn favorited"');
  });

  it('renders data-shortcut-id on each fav-btn', () => {
    const html = renderFavoritesView([defaultCollection], [favEntry1]);
    expect(html).toContain(`data-shortcut-id="${favEntry1.shortcutId}"`);
  });

  it('HTML-escapes collection name', () => {
    const xssCollection: CollectionSummary = {
      id: 'col-xss',
      name: '<script>alert(1)</script>',
      description: null,
      isDefault: false,
      shortcutCount: 1,
    };
    const xssFav: FavoriteEntry = {
      ...favEntry1,
      collectionId: 'col-xss',
    };
    const html = renderFavoritesView([xssCollection], [xssFav]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('HTML-escapes shortcut command', () => {
    const xssFav: FavoriteEntry = {
      ...favEntry1,
      shortcut: {
        ...favEntry1.shortcut,
        command: '<img src=x onerror=alert(1)>',
      },
    };
    const html = renderFavoritesView([defaultCollection], [xssFav]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('HTML-escapes app name', () => {
    const xssFav: FavoriteEntry = {
      ...favEntry1,
      shortcut: {
        ...favEntry1.shortcut,
        appName: '<b>bold</b>',
      },
    };
    const html = renderFavoritesView([defaultCollection], [xssFav]);
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('renders default collection first even if it appears last in collections array', () => {
    const html = renderFavoritesView(
      [customCollection, defaultCollection], // default listed last
      [favEntry1, favEntry3],               // favEntry1 is default, favEntry3 is custom
    );
    // Default section heading should appear before custom section heading
    const defaultPos = html.indexOf('My Favorites');
    const customPos = html.indexOf('Work');
    expect(defaultPos).toBeLessThan(customPos);
  });

  it('handles favorites from an unknown collection gracefully', () => {
    const orphanFav: FavoriteEntry = {
      ...favEntry1,
      collectionId: 'col-unknown',
    };
    // No CollectionSummary provided for 'col-unknown' — should still render.
    const html = renderFavoritesView([], [orphanFav]);
    expect(html).toContain('Save File');
    // Falls back to the default section name.
    expect(html).toContain('Favorites');
  });

  it('renders only sections for collections that have at least one favorite', () => {
    // customCollection has no entries in this call.
    const html = renderFavoritesView(
      [defaultCollection, customCollection],
      [favEntry1],
    );
    // Only default collection section should appear.
    expect(html).toContain('My Favorites');
    expect(html).not.toContain('Work');
  });
});

// ── renderSignInPrompt ─────────────────────────────────────────────────────

describe('renderSignInPrompt', () => {
  it('renders a sign-in message', () => {
    const html = renderSignInPrompt();
    expect(html).toContain('Sign in to save favorites');
  });

  it('mentions the tray menu', () => {
    const html = renderSignInPrompt();
    expect(html).toContain('tray');
  });

  it('does not render any shortcut data', () => {
    const html = renderSignInPrompt();
    expect(html).not.toContain('fav-row');
    expect(html).not.toContain('favorites-section');
  });
});

// ── renderNoFavorites ─────────────────────────────────────────────────────

describe('renderNoFavorites', () => {
  it('renders an empty-state message', () => {
    const html = renderNoFavorites();
    expect(html).toContain('No saved favorites yet');
  });

  it('does not render any shortcut rows', () => {
    const html = renderNoFavorites();
    expect(html).not.toContain('fav-row');
  });
});

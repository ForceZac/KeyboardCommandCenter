/**
 * favorites-list.ts — Renders the My Favorites view in the panel.
 *
 * Reads from the in-memory sync cache (TASK-0025) via window.kcc.sync.
 * All reads complete synchronously in <10ms — no network calls, no spinners.
 *
 * Design decisions (per TRD):
 * - Renders fresh on each tab switch and after each toggle in favorites view.
 * - Favorites grouped by collectionId, matched to CollectionSummary for display name.
 * - Rows carry data-cmd and data-app attributes for search filtering.
 * - Key combos are intentionally omitted — FavoriteEntry does not carry platform
 *   bindings; adding them would require a per-shortcut IPC lookup (latency + complexity).
 */

import type { FavoriteEntry, CollectionSummary } from './types';
import { escHtml } from './keycap';

/**
 * Renders the full favorites view: shortcuts grouped by collection.
 *
 * Each collection section has a heading and one `.fav-row` per shortcut.
 * The default collection ("My Favorites") is rendered first; others follow
 * in the order they appear in `collections`.
 *
 * Returns the empty-state block when `favorites` is empty.
 */
export function renderFavoritesView(
  collections: CollectionSummary[],
  favorites: FavoriteEntry[],
): string {
  if (favorites.length === 0) {
    return renderNoFavorites();
  }

  // Group favorites by collectionId.
  const byCollection = new Map<string, FavoriteEntry[]>();
  for (const fav of favorites) {
    const group = byCollection.get(fav.collectionId);
    if (group) {
      group.push(fav);
    } else {
      byCollection.set(fav.collectionId, [fav]);
    }
  }

  // Build a lookup from collectionId → name (from known collections).
  const collectionName = new Map<string, string>(
    collections.map((c) => [c.id, c.name]),
  );

  // Render: default collection first, then the rest in received order.
  const defaultCollection = collections.find((c) => c.isDefault);
  const orderedIds: string[] = [];

  if (defaultCollection && byCollection.has(defaultCollection.id)) {
    orderedIds.push(defaultCollection.id);
  }
  for (const id of byCollection.keys()) {
    if (id !== defaultCollection?.id) {
      orderedIds.push(id);
    }
  }

  return orderedIds
    .map((collId) => {
      const entries = byCollection.get(collId) ?? [];
      const name = collectionName.get(collId) ?? 'Favorites';
      return renderFavoritesSection(name, entries);
    })
    .join('');
}

/** Renders one collection section with a heading and its shortcut rows. */
function renderFavoritesSection(collectionName: string, entries: FavoriteEntry[]): string {
  const rows = entries.map(renderFavRow).join('');
  return (
    `<div class="favorites-section">` +
      `<div class="favorites-section-header">${escHtml(collectionName)}</div>` +
      rows +
    `</div>`
  );
}

/**
 * Renders one favorites row.
 *
 * Layout: command name (top) + app name (sub-label), with a filled heart button.
 * The fav-btn is always filled in the favorites view (the shortcut is already saved).
 * data-cmd and data-app attributes enable search filtering.
 */
function renderFavRow(fav: FavoriteEntry): string {
  const dataCmdAttr = escHtml(fav.shortcut.command.toLowerCase());
  const dataAppAttr = escHtml(fav.shortcut.appName.toLowerCase());
  const shortcutId = escHtml(fav.shortcutId);

  return (
    `<div class="fav-row" data-cmd="${dataCmdAttr}" data-app="${dataAppAttr}">` +
      `<div class="fav-row-info">` +
        `<span class="fav-row-cmd">${escHtml(fav.shortcut.command)}</span>` +
        `<span class="fav-row-app">${escHtml(fav.shortcut.appName)}</span>` +
      `</div>` +
      `<button class="fav-btn favorited" data-shortcut-id="${shortcutId}" aria-label="Toggle favorite">♥</button>` +
    `</div>`
  );
}

/**
 * Renders the empty state: shown when the user is signed in but has no favorites yet.
 */
export function renderNoFavorites(): string {
  return (
    `<div class="favorites-empty">` +
      `<div class="favorites-empty-msg">No saved favorites yet</div>` +
    `</div>`
  );
}

/**
 * Renders the sign-in prompt: shown when the user is not authenticated.
 * Directs them to sign in via the tray menu.
 */
export function renderSignInPrompt(): string {
  return (
    `<div class="favorites-signin">` +
      `<div class="favorites-signin-msg">Sign in to save favorites</div>` +
      `<div class="favorites-signin-sub">Use Sign In from the tray menu to get started.</div>` +
    `</div>`
  );
}

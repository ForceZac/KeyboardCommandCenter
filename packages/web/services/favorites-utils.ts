import type { FavoriteEntry } from '@kcc/core';

/**
 * Shared row-to-FavoriteEntry mapper used by FavoritesService and CollectionsService.
 * TASK-0025 (desktop sync engine) imports FavoriteEntry from @kcc/core, so this mapper
 * is the single canonical place that defines the shape — avoids a third copy there.
 */
export function mapRowToFavoriteEntry(row: {
  id: string;
  collectionId: string;
  shortcutId: string;
  createdAt: Date;
  shortcut: {
    id: string;
    command: string;
    context: string | null;
    application: { name: string; slug: string };
  };
}): FavoriteEntry {
  return {
    collectionShortcutId: row.id,
    collectionId: row.collectionId,
    shortcutId: row.shortcutId,
    addedAt: row.createdAt.toISOString(),
    shortcut: {
      id: row.shortcut.id,
      command: row.shortcut.command,
      context: row.shortcut.context,
      appName: row.shortcut.application.name,
      appSlug: row.shortcut.application.slug,
    },
  };
}

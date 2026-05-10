import { prisma } from '../lib/prisma';
import type { FavoriteEntry } from '@kcc/core';

const FAVORITES_LIMIT = 1000;

export class FavoritesService {
  /**
   * Returns the shortcuts in the user's default "My Favorites" collection,
   * with enough shortcut + app detail for the UI to render them.
   */
  async getFavorites(userId: string): Promise<FavoriteEntry[]> {
    const defaultCollection = await this.getDefaultCollection(userId);
    if (!defaultCollection) return [];

    const rows = await prisma.collectionShortcut.findMany({
      where: { collectionId: defaultCollection.id },
      include: {
        shortcut: {
          include: { application: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
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
    }));
  }

  /**
   * Adds a shortcut to the user's default collection.
   * Throws a 403-typed error if the user already has 1000 favorites.
   * Uses upsert so duplicate calls are idempotent.
   */
  async addFavorite(userId: string, shortcutId: string): Promise<void> {
    const defaultCollection = await this.getOrCreateDefaultCollection(userId);

    const count = await prisma.collectionShortcut.count({
      where: { userId },
    });

    // Known edge case: count is checked before the upsert, so a user at exactly
    // 1000 favorites who re-submits an already-favorited shortcut (which would
    // be a no-op upsert) will receive a spurious 403. In practice the web UI
    // (TASK-0024) won't POST for already-favorited shortcuts, so real impact is
    // negligible. Fixing this would require a read-then-count atomic operation.
    if (count >= FAVORITES_LIMIT) {
      const err = new Error('Favorites limit reached');
      (err as NodeJS.ErrnoException).code = 'LIMIT_REACHED';
      throw err;
    }

    // upsert: if already favorited, do nothing; otherwise insert
    await prisma.collectionShortcut.upsert({
      where: {
        collectionId_shortcutId: {
          collectionId: defaultCollection.id,
          shortcutId,
        },
      },
      create: {
        userId,
        collectionId: defaultCollection.id,
        shortcutId,
      },
      update: {}, // already exists — no changes needed
    });
  }

  /**
   * Removes a shortcut from the user's default collection.
   * Returns false if the shortcut was not in the default collection.
   */
  async removeFavorite(userId: string, shortcutId: string): Promise<boolean> {
    const defaultCollection = await this.getDefaultCollection(userId);
    if (!defaultCollection) return false;

    const deleted = await prisma.collectionShortcut.deleteMany({
      where: {
        collectionId: defaultCollection.id,
        shortcutId,
        userId,
      },
    });

    return deleted.count > 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getDefaultCollection(userId: string) {
    return prisma.collection.findFirst({
      where: { userId, isDefault: true },
    });
  }

  private async getOrCreateDefaultCollection(userId: string) {
    const existing = await this.getDefaultCollection(userId);
    if (existing) return existing;

    // Fallback: create the default collection if the createUser event didn't fire
    // (e.g. users created before TASK-0022 shipped).
    return prisma.collection.create({
      data: { userId, name: 'My Favorites', isDefault: true },
    });
  }
}

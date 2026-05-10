import { prisma } from '../lib/prisma';
import type { CollectionSummary, FavoriteEntry } from '@kcc/core';

const COLLECTIONS_LIMIT = 50;

export class CollectionsService {
  /** Returns all collections for the user, each with a shortcut count. */
  async listCollections(userId: string): Promise<CollectionSummary[]> {
    const rows = await prisma.collection.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { shortcuts: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isDefault: row.isDefault,
      shortcutCount: row._count.shortcuts,
    }));
  }

  /**
   * Creates a new named collection.
   * Throws a LIMIT_REACHED error if the user already has 50 collections.
   */
  async createCollection(
    userId: string,
    name: string,
    description?: string,
  ): Promise<CollectionSummary> {
    const count = await prisma.collection.count({ where: { userId } });

    if (count >= COLLECTIONS_LIMIT) {
      const err = new Error('Collections limit reached');
      (err as NodeJS.ErrnoException).code = 'LIMIT_REACHED';
      throw err;
    }

    const created = await prisma.collection.create({
      data: { userId, name, description },
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      isDefault: created.isDefault,
      shortcutCount: 0,
    };
  }

  /**
   * Updates name and/or description of a collection.
   * Returns null if the collection does not exist or is not owned by the user.
   */
  async updateCollection(
    userId: string,
    collectionId: string,
    patch: { name?: string; description?: string },
  ): Promise<CollectionSummary | null> {
    const existing = await prisma.collection.findFirst({
      where: { id: collectionId, userId },
      include: { _count: { select: { shortcuts: true } } },
    });

    if (!existing) return null;

    const updated = await prisma.collection.update({
      where: { id: collectionId },
      data: patch,
      include: { _count: { select: { shortcuts: true } } },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isDefault: updated.isDefault,
      shortcutCount: updated._count.shortcuts,
    };
  }

  /**
   * Deletes a collection (and cascades its shortcuts via DB constraint).
   * Returns 'deleted' on success, 'not_found' if it doesn't exist/isn't owned,
   * or 'is_default' if the caller tries to delete the default collection.
   */
  async deleteCollection(
    userId: string,
    collectionId: string,
  ): Promise<'deleted' | 'not_found' | 'is_default'> {
    const existing = await prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!existing) return 'not_found';
    if (existing.isDefault) return 'is_default';

    await prisma.collection.delete({ where: { id: collectionId } });
    return 'deleted';
  }

  /**
   * Returns shortcuts in a specific collection.
   * Returns null if the collection does not exist or is not owned by the user.
   */
  async getCollectionShortcuts(
    userId: string,
    collectionId: string,
  ): Promise<FavoriteEntry[] | null> {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!collection) return null;

    const rows = await prisma.collectionShortcut.findMany({
      where: { collectionId },
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
}

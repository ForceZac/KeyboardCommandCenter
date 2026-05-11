'use client';

import Link from 'next/link';
import { useCollections } from '@/hooks/useCollections';
import { useCollectionDetail } from '@/hooks/useCollectionDetail';

interface Props {
  collectionId: string;
}

/**
 * Collection detail page — interactive client shell.
 * Shows all shortcuts in the collection with individual remove buttons.
 */
export default function CollectionDetailPageClient({ collectionId }: Props) {
  const { collections } = useCollections();
  const { shortcuts, isLoading, removeShortcut, isRemoving } =
    useCollectionDetail(collectionId);

  const collection = collections.find((c) => c.id === collectionId);
  const collectionName = collection?.name ?? 'Collection';

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link
          href="/collections"
          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          My Collections
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium truncate">
          {collectionName}
        </span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {collectionName}
        </h1>
        {collection?.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{collection.description}</p>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : shortcuts.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          No shortcuts in this collection yet.{' '}
          <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Browse shortcuts
          </Link>{' '}
          and use the dropdown on the heart icon to add them here.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {shortcuts.map((entry) => (
            <div
              key={entry.collectionShortcutId}
              className="group flex items-center justify-between gap-4 py-3 px-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {entry.shortcut.command}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {entry.shortcut.appName}
                  {entry.shortcut.context ? ` · ${entry.shortcut.context}` : ''}
                </p>
              </div>
              <button
                onClick={() => removeShortcut(entry.shortcutId)}
                disabled={isRemoving}
                aria-label={`Remove ${entry.shortcut.command} from ${collectionName}`}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0 px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700 transition-all disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
        {shortcuts.length} {shortcuts.length === 1 ? 'shortcut' : 'shortcuts'}
      </p>
    </main>
  );
}

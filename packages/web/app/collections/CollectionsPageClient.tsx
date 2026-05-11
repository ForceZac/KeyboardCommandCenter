'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCollections } from '@/hooks/useCollections';
import CollectionCard from '@/components/CollectionCard';

/**
 * My Collections page — interactive client shell.
 * Shows a grid of collection cards with create/rename/delete actions.
 */
export default function CollectionsPageClient() {
  const { collections, isLoading, create, isCreating, rename, remove } = useCollections();

  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    create(
      { name, description: newDescription.trim() || undefined },
      {
        onSuccess: () => {
          setNewName('');
          setNewDescription('');
          setShowNewForm(false);
        },
      },
    );
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Collections</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Organize your saved shortcuts into named collections.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          New Collection
        </button>
      </div>

      {/* New collection form */}
      {showNewForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Create new collection
          </h2>
          <div>
            <label
              htmlFor="new-collection-name"
              className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="new-collection-name"
              type="text"
              maxLength={100}
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Vim shortcuts"
              className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label
              htmlFor="new-collection-description"
              className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
            >
              Description (optional)
            </label>
            <input
              id="new-collection-description"
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What&apos;s in this collection?"
              className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {isCreating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewForm(false);
                setNewName('');
                setNewDescription('');
              }}
              className="px-4 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading collections…</div>
      ) : collections.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          No collections yet. Create one above or{' '}
          <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            browse shortcuts
          </Link>{' '}
          and click the heart icon to save favorites.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onRename={(patch) => rename({ id: collection.id, patch })}
              onDelete={() => remove(collection.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

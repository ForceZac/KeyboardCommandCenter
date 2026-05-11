'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CollectionSummary } from '@kcc/core';

interface Props {
  collection: CollectionSummary;
  onRename: (patch: { name?: string; description?: string }) => void;
  onDelete: () => void;
}

/**
 * CollectionCard — one card in the My Collections grid.
 * Shows name, description, shortcut count, and edit/delete actions.
 * The default "My Favorites" collection cannot be deleted.
 */
export default function CollectionCard({ collection, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [editDescription, setEditDescription] = useState(collection.description ?? '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name) return;
    onRename({
      name,
      description: editDescription.trim() || undefined,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={handleRenameSubmit}
        className="rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-800 p-4 space-y-2 shadow-sm"
      >
        <input
          type="text"
          maxLength={100}
          required
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          autoFocus
          className="w-full px-2 py-1 text-sm rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="text"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-2 py-1 text-sm rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-3 py-1 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setEditName(collection.name);
              setEditDescription(collection.description ?? '');
            }}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="relative rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm">
      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <button
          onClick={() => setEditing(true)}
          aria-label={`Edit ${collection.name}`}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
            />
          </svg>
        </button>
        {!collection.isDefault && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            aria-label={`Delete ${collection.name}`}
            className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Card body — links to collection detail */}
      <Link href={`/collections/${collection.id}`} className="block pr-16">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {collection.name}
        </h3>
        {collection.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {collection.description}
          </p>
        )}
        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
          {collection.shortcutCount}{' '}
          {collection.shortcutCount === 1 ? 'shortcut' : 'shortcuts'}
        </p>
      </Link>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div
          className="absolute inset-0 rounded-lg bg-white/95 dark:bg-gray-800/95 flex flex-col items-center justify-center p-4 gap-3"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
        >
          <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
            Delete &ldquo;{collection.name}&rdquo;?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}
              className="px-3 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

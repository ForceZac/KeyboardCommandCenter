'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useFavorites } from '@/hooks/useFavorites';
import { useCollections } from '@/hooks/useCollections';
import { addToCollection, removeFromCollection, fetchCollectionShortcuts } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  shortcutId: string;
}

/**
 * FavoriteToggle — heart icon button with collection dropdown.
 *
 * - Fills instantly on click (optimistic, rolls back on error via useFavorites).
 * - Dropdown lists named collections with add/remove per collection.
 * - Unauthenticated users see a sign-in prompt dialog instead of API calls.
 */
export default function FavoriteToggle({ shortcutId }: Props) {
  const { data: session } = useSession();
  const { isFavorited, toggle } = useFavorites();
  const { collections } = useCollections();
  const queryClient = useQueryClient();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  // Track which named collections contain this shortcut (lazy-loaded on dropdown open)
  const [collectionMembership, setCollectionMembership] = useState<Set<string>>(new Set());
  const [membershipLoading, setMembershipLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const favorited = isFavorited(shortcutId);
  const namedCollections = collections.filter((c) => !c.isDefault);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // When dropdown opens, lazily fetch membership for each named collection
  useEffect(() => {
    if (!dropdownOpen || namedCollections.length === 0) return;

    setMembershipLoading(true);
    Promise.all(
      namedCollections.map(async (c) => {
        // Use the TanStack Query cache if available; otherwise fetch
        const cached = queryClient.getQueryData<{ shortcutId: string }[]>([
          'collection-detail',
          c.id,
        ]);
        if (cached) return { id: c.id, has: cached.some((e) => e.shortcutId === shortcutId) };
        // Minimal check: fetch collection shortcuts just to test membership
        try {
          const data = await fetchCollectionShortcuts(c.id);
          return { id: c.id, has: data.some((e) => e.shortcutId === shortcutId) };
        } catch {
          return { id: c.id, has: false };
        }
      }),
    ).then((results) => {
      const inSet = new Set(results.filter((r) => r.has).map((r) => r.id));
      setCollectionMembership(inSet);
      setMembershipLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropdownOpen]);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) {
      setShowSignInPrompt(true);
      return;
    }
    toggle(shortcutId);
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) {
      setShowSignInPrompt(true);
      return;
    }
    setDropdownOpen((o) => !o);
  };

  const handleCollectionToggle = async (collectionId: string) => {
    const inCollection = collectionMembership.has(collectionId);
    // Optimistic update
    setCollectionMembership((prev) => {
      const next = new Set(prev);
      if (inCollection) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
    try {
      if (inCollection) {
        await removeFromCollection(collectionId, shortcutId);
      } else {
        await addToCollection(collectionId, shortcutId);
      }
      // Invalidate the detail cache so the collection detail page stays fresh
      queryClient.invalidateQueries({ queryKey: ['collection-detail', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    } catch {
      // Roll back on error
      setCollectionMembership((prev) => {
        const next = new Set(prev);
        if (inCollection) {
          next.add(collectionId);
        } else {
          next.delete(collectionId);
        }
        return next;
      });
    }
  };

  return (
    <>
      <div className="relative flex items-center" ref={dropdownRef}>
        {/* Heart button */}
        <button
          onClick={handleHeartClick}
          aria-label={favorited ? 'Remove from My Favorites' : 'Add to My Favorites'}
          className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {favorited ? (
            // Filled heart
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 text-red-500"
            >
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
          ) : (
            // Outline heart
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
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          )}
        </button>

        {/* Dropdown chevron — only show when signed in and there are named collections */}
        {session && namedCollections.length > 0 && (
          <button
            onClick={handleDropdownToggle}
            aria-label="Add to collection"
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3 h-3"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* Collection dropdown */}
        {dropdownOpen && (
          <div className="absolute right-0 top-8 z-50 w-52 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Add to collection
              </p>
            </div>
            {membershipLoading ? (
              <div className="px-3 py-2 text-xs text-gray-400">Loading…</div>
            ) : (
              <div className="py-1">
                {namedCollections.map((c) => {
                  const inCollection = collectionMembership.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleCollectionToggle(c.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <span className="w-4 flex-shrink-0">
                        {inCollection && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sign-in prompt modal */}
      {showSignInPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowSignInPrompt(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Sign in to save favorites
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create a free account to save shortcuts and organize them into collections.
            </p>
            <div className="flex gap-3">
              <a
                href="/api/auth/signin"
                className="flex-1 text-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Sign in
              </a>
              <button
                onClick={() => setShowSignInPrompt(false)}
                className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

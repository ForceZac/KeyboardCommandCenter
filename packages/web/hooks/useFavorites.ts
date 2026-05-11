'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { fetchFavorites, addFavorite, removeFavorite } from '@/lib/api';
import type { FavoriteEntry } from '@kcc/core';

const QUERY_KEY = ['favorites'] as const;

/**
 * TanStack Query hook for the user's default "My Favorites" collection.
 *
 * - `isFavorited(shortcutId)` — O(1) Set lookup from the cached list
 * - `toggle(shortcutId)` — optimistic UI: flips the icon immediately,
 *   rolls back on API error
 */
export function useFavorites() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const query = useQuery<FavoriteEntry[]>({
    queryKey: QUERY_KEY,
    queryFn: fetchFavorites,
    staleTime: 60_000,
    enabled: !!session,
  });

  const favoritedIds = new Set((query.data ?? []).map((f) => f.shortcutId));

  const isFavorited = (shortcutId: string) => favoritedIds.has(shortcutId);

  const addMutation = useMutation({
    mutationFn: (shortcutId: string) => addFavorite(shortcutId),
    onMutate: async (shortcutId: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<FavoriteEntry[]>(QUERY_KEY);
      queryClient.setQueryData<FavoriteEntry[]>(QUERY_KEY, (old = []) => [
        ...old,
        {
          collectionShortcutId: `optimistic-${shortcutId}`,
          collectionId: '',
          shortcutId,
          addedAt: new Date().toISOString(),
          shortcut: {
            id: shortcutId,
            command: '',
            context: null,
            appName: '',
            appSlug: '',
          },
        },
      ]);
      return { previous };
    },
    onError: (_err, _shortcutId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (shortcutId: string) => removeFavorite(shortcutId),
    onMutate: async (shortcutId: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<FavoriteEntry[]>(QUERY_KEY);
      queryClient.setQueryData<FavoriteEntry[]>(QUERY_KEY, (old = []) =>
        old.filter((f) => f.shortcutId !== shortcutId),
      );
      return { previous };
    },
    onError: (_err, _shortcutId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const toggle = (shortcutId: string) => {
    if (isFavorited(shortcutId)) {
      removeMutation.mutate(shortcutId);
    } else {
      addMutation.mutate(shortcutId);
    }
  };

  return {
    favorites: query.data ?? [],
    isLoading: query.isLoading,
    isFavorited,
    toggle,
    isToggling:
      addMutation.isPending ||
      removeMutation.isPending,
  };
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCollectionShortcuts, removeFromCollection } from '@/lib/api';
import type { FavoriteEntry } from '@kcc/core';

const queryKey = (id: string) => ['collection-detail', id] as const;

/**
 * TanStack Query hook for the shortcuts within a specific named collection.
 * Exposes `removeShortcut` with an optimistic list update.
 */
export function useCollectionDetail(collectionId: string) {
  const queryClient = useQueryClient();
  const key = queryKey(collectionId);

  const query = useQuery<FavoriteEntry[]>({
    queryKey: key,
    queryFn: () => fetchCollectionShortcuts(collectionId),
    staleTime: 60_000,
    enabled: Boolean(collectionId),
  });

  const removeMutation = useMutation({
    mutationFn: (shortcutId: string) =>
      removeFromCollection(collectionId, shortcutId),
    onMutate: async (shortcutId: string) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FavoriteEntry[]>(key);
      queryClient.setQueryData<FavoriteEntry[]>(key, (old = []) =>
        old.filter((f) => f.shortcutId !== shortcutId),
      );
      return { previous };
    },
    onError: (_err, _shortcutId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      // Also invalidate the collections list so shortcut counts update
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  return {
    shortcuts: query.data ?? [],
    isLoading: query.isLoading,
    removeShortcut: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
  };
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  fetchCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '@/lib/api';
import type { CollectionSummary } from '@kcc/core';

const QUERY_KEY = ['collections'] as const;

/**
 * TanStack Query hook for the user's collections list.
 *
 * Exposes `create`, `rename`, and `remove` mutations with optimistic list updates.
 * The default "My Favorites" collection cannot be deleted (enforced server-side,
 * and the UI should disable the delete button when `isDefault` is true).
 */
export function useCollections() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const query = useQuery<CollectionSummary[]>({
    queryKey: QUERY_KEY,
    queryFn: fetchCollections,
    staleTime: 60_000,
    enabled: !!session,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createCollection(name, description),
    onMutate: async ({ name, description }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<CollectionSummary[]>(QUERY_KEY);
      queryClient.setQueryData<CollectionSummary[]>(QUERY_KEY, (old = []) => [
        ...old,
        {
          id: `optimistic-${Date.now()}`,
          name,
          description: description ?? null,
          isDefault: false,
          shortcutCount: 0,
        },
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { name?: string; description?: string };
    }) => updateCollection(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<CollectionSummary[]>(QUERY_KEY);
      queryClient.setQueryData<CollectionSummary[]>(QUERY_KEY, (old = []) =>
        old.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<CollectionSummary[]>(QUERY_KEY);
      queryClient.setQueryData<CollectionSummary[]>(QUERY_KEY, (old = []) =>
        old.filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    collections: query.data ?? [],
    isLoading: query.isLoading,
    create: createMutation.mutate,
    isCreating: createMutation.isPending,
    rename: renameMutation.mutate,
    isRenaming: renameMutation.isPending,
    remove: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
  };
}

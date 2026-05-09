import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchShortcuts } from '@/lib/api';

/**
 * TanStack Query hook for shortcut search.
 * Only fires when the query is 2+ non-whitespace characters.
 * Keeps previous results visible while re-fetching to prevent flicker.
 */
export function useSearch(query: string, platform?: string) {
  return useQuery({
    queryKey: ['search', query, platform],
    queryFn: () => searchShortcuts(query, platform),
    enabled: query.trim().length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

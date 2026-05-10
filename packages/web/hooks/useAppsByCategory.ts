import { useQuery } from '@tanstack/react-query';
import { fetchAppsByCategory } from '@/lib/api';
import type { AppSummary } from '@kcc/core';

/**
 * TanStack Query hook for apps in a category.
 * Cache key: ['apps', category] — stale after 2 minutes.
 */
export function useAppsByCategory(category: string) {
  return useQuery<AppSummary[]>({
    queryKey: ['apps', category],
    queryFn: () => fetchAppsByCategory(category),
    staleTime: 120_000,
  });
}

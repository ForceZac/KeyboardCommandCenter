import { useQuery } from '@tanstack/react-query';
import { fetchApp } from '@/lib/api';
import type { AppDetail } from '@kcc/core';

/**
 * TanStack Query hook for a single app's full shortcut detail.
 * Cache key: ['app', slug] — stale after 2 minutes.
 */
export function useApp(slug: string) {
  return useQuery<AppDetail>({
    queryKey: ['app', slug],
    queryFn: () => fetchApp(slug),
    staleTime: 120_000,
  });
}

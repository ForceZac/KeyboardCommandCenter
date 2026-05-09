import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '@/lib/api';

/**
 * TanStack Query hook for category list.
 * Long staleTime because categories are static seed data that rarely change.
 */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });
}

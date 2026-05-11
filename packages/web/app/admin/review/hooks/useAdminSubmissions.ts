'use client';

import { useQuery } from '@tanstack/react-query';
import { getAdminSubmissions } from '@/lib/api';
import type { IAdminSubmission } from '@kcc/core';

export function useAdminSubmissions(page = 1) {
  const query = useQuery({
    queryKey: ['admin-submissions', page],
    queryFn: () => getAdminSubmissions(page),
  });

  return {
    submissions: query.data?.submissions ?? ([] as IAdminSubmission[]),
    totalPending: query.data?.totalPending ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

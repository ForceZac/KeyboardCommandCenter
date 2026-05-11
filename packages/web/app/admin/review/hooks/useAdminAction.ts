'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSubmissionAction } from '@/lib/api';
import type { ISubmission, SubmissionAdminAction } from '@kcc/core';

export function useAdminAction() {
  const queryClient = useQueryClient();

  return useMutation<ISubmission, Error, { id: string; action: SubmissionAdminAction }>({
    mutationFn: ({ id, action }) => adminSubmissionAction(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
    },
  });
}

'use client';

import { useMutation } from '@tanstack/react-query';
import { submitShortcut } from '@/lib/api';
import type { ISubmission, SubmissionCreatePayload } from '@kcc/core';

/**
 * TanStack Query mutation hook for POST /api/submissions.
 *
 * Returns the standard useMutation result so the caller can inspect
 * isPending, isSuccess, isError, data, and error.
 */
export function useSubmitShortcut() {
  return useMutation<ISubmission, Error, SubmissionCreatePayload>({
    mutationFn: (payload) => submitShortcut(payload),
  });
}

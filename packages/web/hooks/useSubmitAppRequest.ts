'use client';

import { useMutation } from '@tanstack/react-query';
import { submitAppRequest } from '@/lib/api';
import type { ISubmission } from '@kcc/core';

export function useSubmitAppRequest() {
  return useMutation<
    ISubmission,
    Error,
    { appName: string; website?: string | null; categoryId?: string | null; platforms?: string[] }
  >({
    mutationFn: (payload) => submitAppRequest(payload),
  });
}

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkDuplicate } from '@/lib/api';
import type { ShortcutEntry } from '@kcc/core';

const DEBOUNCE_MS = 200;

/**
 * Debounced TanStack Query hook for GET /api/shortcuts/check-duplicate.
 *
 * The query fires only when `appId`, `platform`, and `keyCombo` are all
 * non-empty, and after a 200ms debounce on the `keyCombo` value.
 *
 * Returns `{ exact, fuzzy, isChecking }`.
 */
export function useDuplicateCheck(
  appId: string,
  platform: string,
  keyCombo: string,
): {
  exact: ShortcutEntry | null;
  fuzzy: ShortcutEntry[];
  isChecking: boolean;
} {
  const [debouncedCombo, setDebouncedCombo] = useState(keyCombo);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedCombo(keyCombo), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [keyCombo]);

  const enabled = Boolean(appId && platform && debouncedCombo);

  const query = useQuery<{ exact: ShortcutEntry | null; fuzzy: ShortcutEntry[] }>({
    queryKey: ['duplicate-check', appId, platform, debouncedCombo],
    queryFn: () => checkDuplicate(appId, platform, debouncedCombo),
    enabled,
    staleTime: 30_000,
  });

  return {
    exact: query.data?.exact ?? null,
    fuzzy: query.data?.fuzzy ?? [],
    isChecking: query.isFetching,
  };
}

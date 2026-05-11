// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { mockUseSession } = vi.hoisted(() => ({ mockUseSession: vi.fn() }));

vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}));

vi.mock('@/lib/api', () => ({
  fetchFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

import { useFavorites } from '../../hooks/useFavorites';
import { fetchFavorites, addFavorite, removeFavorite } from '@/lib/api';
import type { FavoriteEntry } from '@kcc/core';

const SESSION = { data: { user: { name: 'Alice', email: 'alice@example.com' } } };

const mockEntry: FavoriteEntry = {
  collectionShortcutId: 'cs-1',
  collectionId: 'col-1',
  shortcutId: 'shortcut-1',
  addedAt: '2024-01-01T00:00:00Z',
  shortcut: { id: 'shortcut-1', command: 'Cmd+C', context: null, appName: 'Finder', appSlug: 'finder' },
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { Wrapper, queryClient };
}

describe('useFavorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(SESSION);
  });

  it('isFavorited returns true for a shortcut in the cache', async () => {
    (fetchFavorites as ReturnType<typeof vi.fn>).mockResolvedValue([mockEntry]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useFavorites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isFavorited('shortcut-1')).toBe(true));
  });

  it('isFavorited returns false for a shortcut not in the cache', async () => {
    (fetchFavorites as ReturnType<typeof vi.fn>).mockResolvedValue([mockEntry]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useFavorites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFavorited('unknown-id')).toBe(false);
  });

  it('toggle on unfavorited shortcut calls addFavorite', async () => {
    (fetchFavorites as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (addFavorite as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useFavorites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.toggle('shortcut-new');
    });

    await waitFor(() => expect(addFavorite).toHaveBeenCalledWith('shortcut-new'));
  });

  it('toggle on favorited shortcut calls removeFavorite', async () => {
    (fetchFavorites as ReturnType<typeof vi.fn>).mockResolvedValue([mockEntry]);
    (removeFavorite as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useFavorites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isFavorited('shortcut-1')).toBe(true));

    act(() => {
      result.current.toggle('shortcut-1');
    });

    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith('shortcut-1'));
  });

  it('rolls back optimistic update when addFavorite rejects', async () => {
    (fetchFavorites as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (addFavorite as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useFavorites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.toggle('shortcut-new');
    });

    // Wait until addFavorite was called AND the rollback has restored the prior state.
    // onMutate sets the optimistic entry then mutationFn rejects — onError restores the
    // snapshot. By the time waitFor polls between JS tasks, both the call and the
    // rollback have completed within the same microtask chain.
    await waitFor(() => {
      expect(addFavorite).toHaveBeenCalledWith('shortcut-new');
      expect(result.current.isFavorited('shortcut-new')).toBe(false);
    });
  });
});

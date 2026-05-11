// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { mockUseSession } = vi.hoisted(() => ({ mockUseSession: vi.fn() }));
const { mockIsFavorited, mockToggle } = vi.hoisted(() => ({
  mockIsFavorited: vi.fn(),
  mockToggle: vi.fn(),
}));
const { mockCollections } = vi.hoisted(() => ({ mockCollections: vi.fn() }));

vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}));

vi.mock('@/hooks/useFavorites', () => ({
  useFavorites: () => ({
    isFavorited: mockIsFavorited,
    toggle: mockToggle,
    favorites: [],
    isLoading: false,
    isToggling: false,
  }),
}));

vi.mock('@/hooks/useCollections', () => ({
  useCollections: () => mockCollections(),
}));

vi.mock('@/lib/api', () => ({
  fetchCollectionShortcuts: vi.fn(),
  addToCollection: vi.fn(),
  removeFromCollection: vi.fn(),
}));

import FavoriteToggle from '../../components/FavoriteToggle';

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('FavoriteToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollections.mockReturnValue({ collections: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders outline heart (add label) when shortcut is not favorited', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    mockIsFavorited.mockReturnValue(false);

    render(<FavoriteToggle shortcutId="shortcut-1" />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /add to my favorites/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /remove from my favorites/i })).toBeNull();
  });

  it('renders filled heart (remove label) when shortcut is favorited', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    mockIsFavorited.mockReturnValue(true);

    render(<FavoriteToggle shortcutId="shortcut-1" />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /remove from my favorites/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /add to my favorites/i })).toBeNull();
  });

  it('shows sign-in prompt dialog when unauthenticated user clicks the heart', () => {
    mockUseSession.mockReturnValue({ data: null });
    mockIsFavorited.mockReturnValue(false);

    render(<FavoriteToggle shortcutId="shortcut-1" />, { wrapper: Wrapper });

    const heartButton = screen.getByRole('button', { name: /add to my favorites/i });
    fireEvent.click(heartButton);

    expect(screen.getByText(/sign in to save favorites/i)).toBeDefined();
  });

  it('calls toggle when authenticated user clicks the heart', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    mockIsFavorited.mockReturnValue(false);

    render(<FavoriteToggle shortcutId="shortcut-1" />, { wrapper: Wrapper });

    const heartButton = screen.getByRole('button', { name: /add to my favorites/i });
    fireEvent.click(heartButton);

    expect(mockToggle).toHaveBeenCalledWith('shortcut-1');
  });
});

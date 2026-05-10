// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next-auth/react before importing the component
const mockSignOut = vi.fn();
let mockSession: { data: { user: { name?: string; email?: string; image?: string } } | null } = {
  data: null,
};

vi.mock('next-auth/react', () => ({
  signOut: mockSignOut,
  useSession: vi.fn(() => mockSession),
}));

import UserMenu from '../../components/UserMenu';

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to a default authenticated session
    mockSession = {
      data: {
        user: { name: 'Alice Smith', email: 'alice@example.com', image: undefined },
      },
    };
  });

  it('renders user initials when no image is provided', () => {
    render(<UserMenu />);
    // Initials button: "AS" from "Alice Smith"
    expect(screen.getByText('AS')).toBeDefined();
  });

  it('shows sign-out button after clicking the avatar', () => {
    render(<UserMenu />);
    const avatarButton = screen.getByRole('button', { name: /user menu for alice smith/i });
    fireEvent.click(avatarButton);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeDefined();
  });

  it('calls signOut() when sign-out button is clicked', () => {
    render(<UserMenu />);
    const avatarButton = screen.getByRole('button', { name: /user menu for alice smith/i });
    fireEvent.click(avatarButton);
    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutButton);
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('displays user name and email in the dropdown', () => {
    render(<UserMenu />);
    const avatarButton = screen.getByRole('button', { name: /user menu for alice smith/i });
    fireEvent.click(avatarButton);
    expect(screen.getByText('Alice Smith')).toBeDefined();
    expect(screen.getByText('alice@example.com')).toBeDefined();
  });

  it('renders img element when image URL is provided', () => {
    mockSession = {
      data: {
        user: {
          name: 'Bob Jones',
          email: 'bob@example.com',
          image: 'https://example.com/avatar.jpg',
        },
      },
    };
    render(<UserMenu />);
    const img = screen.getByRole('img', { name: 'Bob Jones' });
    expect(img).toBeDefined();
  });
});

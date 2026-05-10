// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next-auth/react before importing the component
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

import SignInButton from '../../components/SignInButton';
import { signIn } from 'next-auth/react';

describe('SignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<SignInButton />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
  });

  it('calls signIn() when clicked', () => {
    render(<SignInButton />);
    const button = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(button);
    expect(signIn).toHaveBeenCalledOnce();
  });
});

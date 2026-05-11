// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { mockUseSession } = vi.hoisted(() => ({ mockUseSession: vi.fn() }));
const { mockMutateAsync, mockReset, mockMutation } = vi.hoisted(() => {
  const mockMutateAsync = vi.fn();
  const mockReset = vi.fn();
  const mockMutation = vi.fn();
  return { mockMutateAsync, mockReset, mockMutation };
});

vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}));

vi.mock('@/hooks/useSubmitShortcut', () => ({
  useSubmitShortcut: () => mockMutation(),
}));

import CorrectionModal from '../../components/CorrectionModal';
import { ApiError } from '../../lib/api';
import type { ShortcutEntry, PlatformSlug } from '@kcc/core';

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const defaultMutation = {
  mutateAsync: mockMutateAsync,
  reset: mockReset,
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
  data: undefined,
};

const testShortcut: ShortcutEntry = {
  id: 'shortcut-1',
  command: 'Save File',
  platforms: [
    {
      platformSlug: 'windows',
      keyCombo: 'Ctrl+S',
      steps: [{ stepOrder: 1, keyCombo: 'Ctrl+S', key: 's', modifiers: ['Ctrl'] }],
    },
    {
      platformSlug: 'macos',
      keyCombo: 'Cmd+S',
      steps: [{ stepOrder: 1, keyCombo: 'Cmd+S', key: 's', modifiers: ['Cmd'] }],
    },
  ],
};

const defaultProps = {
  shortcut: testShortcut,
  context: 'Editor',
  appId: 'app-1',
  appName: 'VS Code',
  platform: 'windows' as PlatformSlug,
  open: true,
  onClose: vi.fn(),
};

describe('CorrectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation.mockReturnValue(defaultMutation);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when open is false', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    const { container } = render(
      <CorrectionModal {...defaultProps} open={false} />,
      { wrapper: Wrapper },
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows sign-in prompt for unauthenticated users', () => {
    mockUseSession.mockReturnValue({ data: null });
    render(<CorrectionModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/sign in to suggest a correction/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeTruthy();
  });

  it('shows the correction form with pre-filled fields when authenticated', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    render(<CorrectionModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByLabelText(/command name/i)).toBeTruthy();
    expect((screen.getByLabelText(/command name/i) as HTMLInputElement).value).toBe('Save File');
    expect(screen.getByLabelText(/platform/i)).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /key combo recorder/i })).toBeTruthy();
    expect(screen.getByLabelText(/context/i)).toBeTruthy();
    expect((screen.getByLabelText(/context/i) as HTMLInputElement).value).toBe('Editor');
    expect(screen.getByLabelText(/reason for correction/i)).toBeTruthy();
  });

  it('shows the current shortcut info banner', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    render(<CorrectionModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/editing:/i)).toBeTruthy();
    expect(screen.getByText('Save File')).toBeTruthy();
  });

  it('displays the app name in the header', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    render(<CorrectionModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/suggest a correction — vs code/i)).toBeTruthy();
  });

  it('submit button is enabled when command and key combo are present', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    render(<CorrectionModal {...defaultProps} />, { wrapper: Wrapper });
    expect(
      (screen.getByRole('button', { name: /submit correction/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('shows success confirmation after submission', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    mockMutation.mockReturnValue({ ...defaultMutation, isSuccess: true });
    render(<CorrectionModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/correction submitted/i)).toBeTruthy();
  });

  it('shows rate limit error for 429', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    const err = new ApiError(429, 'rate limit');
    mockMutation.mockReturnValue({ ...defaultMutation, isError: true, error: err });
    render(<CorrectionModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/daily submission limit/i)).toBeTruthy();
  });

  it('shows generic error for non-429 errors', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    mockMutation.mockReturnValue({ ...defaultMutation, isError: true, error: new Error('fail') });
    render(<CorrectionModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    const onClose = vi.fn();
    render(<CorrectionModal {...defaultProps} onClose={onClose} />, { wrapper: Wrapper });
    const closeBtn = screen.getByRole('button', { name: /close/i });
    closeBtn.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables submit button while mutation is pending', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    mockMutation.mockReturnValue({ ...defaultMutation, isPending: true });
    render(<CorrectionModal {...defaultProps} />, { wrapper: Wrapper });
    expect(
      (screen.getByRole('button', { name: /submitting/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

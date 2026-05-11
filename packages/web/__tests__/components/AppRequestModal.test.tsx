// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { mockUseSession } = vi.hoisted(() => ({ mockUseSession: vi.fn() }));
const { mockMutateAsync, mockReset, mockMutation } = vi.hoisted(() => {
  const mockMutateAsync = vi.fn();
  const mockReset = vi.fn();
  const mockMutation = vi.fn();
  return { mockMutateAsync, mockReset, mockMutation };
});
const { mockCategories } = vi.hoisted(() => ({ mockCategories: vi.fn() }));

vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}));

vi.mock('@/hooks/useSubmitAppRequest', () => ({
  useSubmitAppRequest: () => mockMutation(),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => mockCategories(),
}));

import AppRequestModal from '../../components/AppRequestModal';

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

describe('AppRequestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation.mockReturnValue(defaultMutation);
    mockCategories.mockReturnValue({ data: [{ id: 'cat-1', name: 'Developer Tools' }] });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when open is false', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    const { container } = render(
      <AppRequestModal open={false} onClose={vi.fn()} />,
      { wrapper: Wrapper },
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows sign-in prompt for unauthenticated users', () => {
    mockUseSession.mockReturnValue({ data: null });
    render(<AppRequestModal open={true} onClose={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByText(/sign in to request a new app/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeTruthy();
  });

  it('shows the form with all fields when authenticated', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    render(<AppRequestModal open={true} onClose={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByLabelText(/app name/i)).toBeTruthy();
    expect(screen.getByLabelText(/website url/i)).toBeTruthy();
    expect(screen.getByLabelText(/category/i)).toBeTruthy();
    expect(screen.getByText(/Windows/)).toBeTruthy();
    expect(screen.getByText(/macOS/)).toBeTruthy();
    expect(screen.getByText(/Linux/)).toBeTruthy();
  });

  it('pre-fills app name from defaultAppName prop', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    render(
      <AppRequestModal open={true} onClose={vi.fn()} defaultAppName="Blender" />,
      { wrapper: Wrapper },
    );
    expect((screen.getByLabelText(/app name/i) as HTMLInputElement).value).toBe('Blender');
  });

  it('submit button is disabled when app name is empty', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    render(<AppRequestModal open={true} onClose={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByRole('button', { name: /request app/i })).toBeDisabled();
  });

  it('submit button is enabled when app name has text', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    render(<AppRequestModal open={true} onClose={vi.fn()} />, { wrapper: Wrapper });
    fireEvent.change(screen.getByLabelText(/app name/i), { target: { value: 'Blender' } });
    expect(screen.getByRole('button', { name: /request app/i })).toBeEnabled();
  });

  it('shows success confirmation after submission', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    mockMutation.mockReturnValue({ ...defaultMutation, isSuccess: true });
    render(<AppRequestModal open={true} onClose={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByText(/app request submitted/i)).toBeTruthy();
  });

  it('shows rate limit error for 429', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    const apiError = Object.assign(new Error('rate limit'), { status: 429, name: 'ApiError' });
    Object.defineProperty(apiError, 'constructor', { value: class ApiError {} });
    // We need to simulate the ApiError class check — use the real imported class
    const { ApiError } = require('../../lib/api');
    const err = new ApiError(429, 'rate limit');
    mockMutation.mockReturnValue({ ...defaultMutation, isError: true, error: err });
    render(<AppRequestModal open={true} onClose={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByText(/daily submission limit/i)).toBeTruthy();
  });

  it('shows generic error for non-429 errors', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    mockMutation.mockReturnValue({ ...defaultMutation, isError: true, error: new Error('fail') });
    render(<AppRequestModal open={true} onClose={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    const onClose = vi.fn();
    render(<AppRequestModal open={true} onClose={onClose} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders category dropdown options from useCategories', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } });
    mockCategories.mockReturnValue({
      data: [
        { id: 'cat-1', name: 'Developer Tools' },
        { id: 'cat-2', name: 'Design' },
      ],
    });
    render(<AppRequestModal open={true} onClose={vi.fn()} />, { wrapper: Wrapper });
    const select = screen.getByLabelText(/category/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toContain('Developer Tools');
    expect(options).toContain('Design');
  });
});

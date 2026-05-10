import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOverlayData } from '../useOverlayData';
import type { DetectionPayload } from '../../types';
import type { AppDetail } from '@kcc/core';

function makeAppDetail(name = 'Visual Studio Code'): AppDetail {
  return {
    id: '1',
    name,
    slug: 'vscode',
    description: null,
    categorySlug: 'developer-tools',
    contexts: {
      Global: [
        { id: 's1', command: 'Save', platforms: [{ platformSlug: 'macos', keyCombo: 'Cmd+S', steps: [] }] },
      ],
    },
  };
}

function makePayload(appSlug: string | null, processName = 'Code.app'): DetectionPayload {
  return { appSlug, processName, windowTitle: 'editor' };
}

describe('useOverlayData', () => {
  let appChangedCallback: ((payload: DetectionPayload) => void) | null = null;
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    appChangedCallback = null;
    mockUnsubscribe.mockClear();

    Object.defineProperty(window, 'kccOverlay', {
      writable: true,
      configurable: true,
      value: {
        onAppChanged: (cb: (payload: DetectionPayload) => void) => {
          appChangedCallback = cb;
          return mockUnsubscribe;
        },
        getShortcutsForApp: vi.fn().mockResolvedValue(makeAppDetail()),
        getOverlayPrefs: vi.fn().mockResolvedValue({ opacity: 0.4, size: 'Standard' }),
      },
    });
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useOverlayData());
    expect(result.current.status).toBe('idle');
    expect(result.current.appDetail).toBeNull();
    expect(result.current.processName).toBe('');
  });

  it('transitions to loaded when app is recognized', async () => {
    const { result } = renderHook(() => useOverlayData());

    await act(async () => {
      appChangedCallback!(makePayload('vscode'));
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.appDetail).not.toBeNull();
    expect(result.current.appDetail!.name).toBe('Visual Studio Code');
  });

  it('transitions to unrecognized when appSlug is null', async () => {
    const { result } = renderHook(() => useOverlayData());

    await act(async () => {
      appChangedCallback!(makePayload(null, 'UnknownApp.exe'));
    });

    expect(result.current.status).toBe('unrecognized');
    expect(result.current.processName).toBe('UnknownApp.exe');
    expect(result.current.appDetail).toBeNull();
  });

  it('transitions to unrecognized when getShortcutsForApp returns null', async () => {
    (window.kccOverlay.getShortcutsForApp as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { result } = renderHook(() => useOverlayData());

    await act(async () => {
      appChangedCallback!(makePayload('unknown-slug', 'SomeApp'));
    });

    expect(result.current.status).toBe('unrecognized');
    expect(result.current.processName).toBe('SomeApp');
    expect(result.current.appDetail).toBeNull();
  });

  it('updates state on subsequent app-changed events', async () => {
    const { result } = renderHook(() => useOverlayData());

    // First: recognized
    await act(async () => {
      appChangedCallback!(makePayload('vscode'));
    });
    expect(result.current.status).toBe('loaded');

    // Second: unrecognized
    await act(async () => {
      appChangedCallback!(makePayload(null, 'Notepad.exe'));
    });
    expect(result.current.status).toBe('unrecognized');
    expect(result.current.processName).toBe('Notepad.exe');
  });

  it('calls unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useOverlayData());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});

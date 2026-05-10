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

  // ── No-detection sentinel ──────────────────────────────────────────────────

  it('transitions to no-detection when processName is empty string', async () => {
    const { result } = renderHook(() => useOverlayData());

    await act(async () => {
      // Empty processName is the sentinel emitted by the detection service
      // when the active window disappears.
      appChangedCallback!({ appSlug: null, processName: '', windowTitle: '' });
    });

    expect(result.current.status).toBe('no-detection');
    expect(result.current.appDetail).toBeNull();
    expect(result.current.processName).toBe('');
  });

  it('distinguishes no-detection from unrecognized (non-empty processName, null slug)', async () => {
    const { result } = renderHook(() => useOverlayData());

    await act(async () => {
      appChangedCallback!({ appSlug: null, processName: 'UnknownApp.exe', windowTitle: 'Some Window' });
    });

    // Non-empty processName with null slug → unrecognized, not no-detection.
    expect(result.current.status).toBe('unrecognized');
    expect(result.current.processName).toBe('UnknownApp.exe');
  });

  // ── Flash prevention ───────────────────────────────────────────────────────

  it('does not clear appDetail before getShortcutsForApp resolves (recognized → recognized)', async () => {
    // First: load an app so we have a populated appDetail.
    const { result } = renderHook(() => useOverlayData());

    await act(async () => {
      appChangedCallback!(makePayload('vscode'));
    });
    expect(result.current.status).toBe('loaded');
    const firstDetail = result.current.appDetail;
    expect(firstDetail).not.toBeNull();

    // Set up a deferred resolution for the second app's data so we can inspect
    // intermediate state while the async call is still in-flight.
    let resolveSecond!: (d: AppDetail | null) => void;
    const secondDetailPromise = new Promise<AppDetail | null>((res) => { resolveSecond = res; });
    (window.kccOverlay.getShortcutsForApp as ReturnType<typeof vi.fn>).mockReturnValueOnce(secondDetailPromise);

    // Fire second event — getShortcutsForApp is now pending.
    act(() => {
      appChangedCallback!(makePayload('chrome', 'Chrome'));
    });

    // State must not have cleared: previous appDetail should still be visible.
    expect(result.current.appDetail).toBe(firstDetail);
    expect(result.current.status).toBe('loaded');

    // Resolve the second app's data and verify the atomic update.
    const chromeDetail = makeAppDetail('Google Chrome');
    await act(async () => {
      resolveSecond(chromeDetail);
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.appDetail).toBe(chromeDetail);
  });

  it('holds previous state during unrecognized → recognized transition', async () => {
    // Start in unrecognized state.
    const { result } = renderHook(() => useOverlayData());

    await act(async () => {
      appChangedCallback!(makePayload(null, 'UnknownApp.exe'));
    });
    expect(result.current.status).toBe('unrecognized');

    // Now a recognized app arrives — getShortcutsForApp is deferred.
    let resolveApp!: (d: AppDetail | null) => void;
    const appPromise = new Promise<AppDetail | null>((res) => { resolveApp = res; });
    (window.kccOverlay.getShortcutsForApp as ReturnType<typeof vi.fn>).mockReturnValueOnce(appPromise);

    act(() => {
      appChangedCallback!(makePayload('vscode'));
    });

    // Still unrecognized while the async call resolves (no blank frame).
    expect(result.current.status).toBe('unrecognized');

    const detail = makeAppDetail('Visual Studio Code');
    await act(async () => {
      resolveApp(detail);
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.appDetail).toBe(detail);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { App } from '../../App';
import type { DetectionPayload } from '../../types';
import type { AppDetail } from '@kcc/core';

type AppChangedCallback = (payload: DetectionPayload) => void;

function makeAppDetail(contextShortcutCount = 3): AppDetail {
  return {
    id: '1',
    name: 'Visual Studio Code',
    slug: 'vscode',
    description: null,
    categorySlug: 'developer-tools',
    contexts: {
      Global: Array.from({ length: contextShortcutCount }, (_, i) => ({
        id: `s${i}`,
        command: `Command ${i}`,
        platforms: [{ platformSlug: 'macos', keyCombo: `Cmd+${i}`, steps: [] }],
      })),
    },
  };
}

function makePayload(appSlug: string | null, processName = 'Code'): DetectionPayload {
  return { appSlug, processName, windowTitle: 'editor' };
}

let appChangedCallback: AppChangedCallback | null = null;

function setupMock(
  appDetail: AppDetail | null,
  prefs = { opacity: 0.6, size: 'Standard' as const },
) {
  appChangedCallback = null;
  Object.defineProperty(window, 'kccOverlay', {
    writable: true,
    configurable: true,
    value: {
      onAppChanged: (cb: AppChangedCallback) => {
        appChangedCallback = cb;
        return vi.fn();
      },
      getShortcutsForApp: vi.fn().mockResolvedValue(appDetail),
      getOverlayPrefs: vi.fn().mockResolvedValue(prefs),
    },
  });
}

describe('App', () => {
  beforeEach(() => setupMock(makeAppDetail()));

  it('renders nothing on idle (no app-changed event fired)', async () => {
    const { container } = render(<App />);
    // Drain pending async updates (useOverlayPrefs resolves its promise after render).
    await act(async () => {});
    expect(container.firstChild).toBeNull();
  });

  it('shows "No app detected" when processName is empty (no-detection sentinel)', async () => {
    render(<App />);
    await waitFor(() => expect(appChangedCallback).not.toBeNull());

    await act(async () => {
      // Empty processName is the detection service's no-active-window sentinel.
      appChangedCallback!({ appSlug: null, processName: '', windowTitle: '' });
    });

    expect(screen.getByText('No app detected')).toBeTruthy();
  });

  it('shows NoShortcuts when app is unrecognized (null slug)', async () => {
    setupMock(null);
    render(<App />);
    await waitFor(() => expect(appChangedCallback).not.toBeNull());

    await act(async () => {
      appChangedCallback!(makePayload(null, 'UnknownApp.exe'));
    });

    expect(screen.getByText('No shortcuts for UnknownApp.exe')).toBeTruthy();
  });

  it('shows NoShortcuts when getShortcutsForApp returns null', async () => {
    setupMock(null);
    render(<App />);
    await waitFor(() => expect(appChangedCallback).not.toBeNull());

    await act(async () => {
      appChangedCallback!(makePayload('some-unrecognized-slug', 'SomeApp'));
    });

    expect(screen.getByText('No shortcuts for SomeApp')).toBeTruthy();
  });

  it('renders app name and shortcuts when loaded', async () => {
    render(<App />);
    await waitFor(() => expect(appChangedCallback).not.toBeNull());

    await act(async () => {
      appChangedCallback!(makePayload('vscode', 'Code'));
    });

    expect(screen.getByText('Visual Studio Code')).toBeTruthy();
    expect(screen.getByText('Command 0')).toBeTruthy();
    expect(screen.getByText('Command 1')).toBeTruthy();
  });

  it('applies opacity from prefs to container background', async () => {
    setupMock(makeAppDetail(), { opacity: 0.75, size: 'Standard' });
    render(<App />);
    await waitFor(() => expect(appChangedCallback).not.toBeNull());

    await act(async () => {
      appChangedCallback!(makePayload('vscode', 'Code'));
    });

    // Container should have background: rgba(0,0,0,0.75)
    const container = document.querySelector('[style]') as HTMLElement | null;
    expect(container).not.toBeNull();
    expect(container!.style.background).toContain('0.75');
  });

  it('shows overflow indicator when shortcuts exceed cap', async () => {
    // Standard cap = 12 shortcuts per group; create 15 to trigger overflow
    setupMock(makeAppDetail(15), { opacity: 0.5, size: 'Standard' });
    render(<App />);
    await waitFor(() => expect(appChangedCallback).not.toBeNull());

    await act(async () => {
      appChangedCallback!(makePayload('vscode', 'Code'));
    });

    // 15 shortcuts in one group, cap 12 → overflow = 3
    expect(screen.getByText('+ 3 more in panel')).toBeTruthy();
  });

  it('does NOT show overflow indicator when shortcuts are within cap', async () => {
    // 8 shortcuts, Standard cap = 12 — no overflow
    setupMock(makeAppDetail(8), { opacity: 0.5, size: 'Standard' });
    render(<App />);
    await waitFor(() => expect(appChangedCallback).not.toBeNull());

    await act(async () => {
      appChangedCallback!(makePayload('vscode', 'Code'));
    });

    expect(screen.queryByText(/more in panel/)).toBeNull();
  });

  it('Compact mode caps at 3 groups and hides the 4th', async () => {
    // 4 context groups; Compact allows 3, Standard allows 4
    const appDetail: AppDetail = {
      id: '1',
      name: 'Visual Studio Code',
      slug: 'vscode',
      description: null,
      categorySlug: 'developer-tools',
      contexts: {
        Global: Array.from({ length: 3 }, (_, i) => ({
          id: `g${i}`, command: `Global ${i}`,
          platforms: [{ platformSlug: 'macos', keyCombo: `Cmd+${i}`, steps: [] }],
        })),
        Editing: Array.from({ length: 3 }, (_, i) => ({
          id: `e${i}`, command: `Edit ${i}`,
          platforms: [{ platformSlug: 'macos', keyCombo: `Opt+${i}`, steps: [] }],
        })),
        Navigation: Array.from({ length: 2 }, (_, i) => ({
          id: `n${i}`, command: `Nav ${i}`,
          platforms: [{ platformSlug: 'macos', keyCombo: `Ctrl+${i}`, steps: [] }],
        })),
        Debug: Array.from({ length: 1 }, (_, i) => ({
          id: `d${i}`, command: `Debug ${i}`,
          platforms: [{ platformSlug: 'macos', keyCombo: `F${i + 5}`, steps: [] }],
        })),
      },
    };
    setupMock(appDetail, { opacity: 0.5, size: 'Compact' });
    render(<App />);
    await waitFor(() => expect(appChangedCallback).not.toBeNull());

    await act(async () => {
      appChangedCallback!(makePayload('vscode', 'Code'));
    });

    // Compact shows top 3 groups by shortcut count: Global(3), Editing(3), Navigation(2)
    expect(screen.getByText('Global')).toBeTruthy();
    expect(screen.getByText('Editing')).toBeTruthy();
    expect(screen.getByText('Navigation')).toBeTruthy();
    // Debug (1 shortcut) is the 4th group — must not appear in Compact
    expect(screen.queryByText('Debug')).toBeNull();
  });

  it('container has pointer-events: none for click-through', async () => {
    render(<App />);
    await waitFor(() => expect(appChangedCallback).not.toBeNull());

    await act(async () => {
      appChangedCallback!(makePayload('vscode', 'Code'));
    });

    const container = document.querySelector('[style]') as HTMLElement | null;
    expect(container).not.toBeNull();
    expect(container!.style.pointerEvents).toBe('none');
  });
});

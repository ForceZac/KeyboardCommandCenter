import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShortcutRow } from '../ShortcutRow';
import type { PlatformBinding } from '../../types';

const macBinding: PlatformBinding = { platformSlug: 'macos', keyCombo: 'Cmd+S', steps: [] };
const winBinding: PlatformBinding = { platformSlug: 'windows', keyCombo: 'Ctrl+S', steps: [] };

describe('ShortcutRow', () => {
  it('selects the Windows binding when platform is windows', () => {
    render(
      <ShortcutRow
        command="Save"
        platforms={[macBinding, winBinding]}
        platform="windows"
      />,
    );
    expect(screen.getByText('Ctrl+S')).toBeTruthy();
    expect(screen.queryByText('Cmd+S')).toBeNull();
  });

  it('falls back to platforms[0] when no binding matches the active platform', () => {
    // Only macOS binding present; platform is windows → should fall back to macos binding
    render(
      <ShortcutRow
        command="Save"
        platforms={[macBinding]}
        platform="windows"
      />,
    );
    expect(screen.getByText('Cmd+S')).toBeTruthy();
  });

  it('renders a dash when platforms array is empty', () => {
    render(
      <ShortcutRow
        command="Save"
        platforms={[]}
        platform="macos"
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });
});

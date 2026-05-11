// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import CorrectionDiffView from '../../app/admin/review/components/CorrectionDiffView';

const ORIGINAL = {
  command: 'Copy',
  keyCombo: 'Ctrl+C',
  context: 'Editor',
  platform: 'windows',
};

describe('CorrectionDiffView', () => {
  it('renders all four fields (Command, Key Combo, Context, Platform)', () => {
    render(<CorrectionDiffView original={ORIGINAL} proposed={{}} />);

    expect(screen.getByText('Command')).toBeDefined();
    expect(screen.getByText('Key Combo')).toBeDefined();
    expect(screen.getByText('Context')).toBeDefined();
    expect(screen.getByText('Platform')).toBeDefined();
  });

  it('shows original values when proposed has no changes', () => {
    render(<CorrectionDiffView original={ORIGINAL} proposed={{}} />);

    expect(screen.getAllByText('Copy')).toHaveLength(2);
    expect(screen.getAllByText('Ctrl+C')).toHaveLength(2);
    expect(screen.getAllByText('Editor')).toHaveLength(2);
    expect(screen.getAllByText('windows')).toHaveLength(2);
  });

  it('highlights changed fields with different styling', () => {
    const proposed = { command: 'Paste', keyCombo: 'Ctrl+V' };
    const { container } = render(
      <CorrectionDiffView original={ORIGINAL} proposed={proposed} />,
    );

    const strikeElements = container.querySelectorAll('.line-through');
    expect(strikeElements.length).toBe(2);

    expect(screen.getByText('Paste')).toBeDefined();
    expect(screen.getByText('Ctrl+V')).toBeDefined();
  });

  it('falls back to "—" when original context is null', () => {
    const noContext = { ...ORIGINAL, context: null };
    render(<CorrectionDiffView original={noContext} proposed={{}} />);

    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('renders column headers (Field, Original, Proposed)', () => {
    render(<CorrectionDiffView original={ORIGINAL} proposed={{}} />);

    expect(screen.getByText('Field')).toBeDefined();
    expect(screen.getByText('Original')).toBeDefined();
    expect(screen.getByText('Proposed')).toBeDefined();
  });
});

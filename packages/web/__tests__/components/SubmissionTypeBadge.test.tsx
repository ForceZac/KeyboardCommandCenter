// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

import SubmissionTypeBadge from '../../app/admin/review/components/SubmissionTypeBadge';

describe('SubmissionTypeBadge', () => {
  afterEach(() => cleanup());

  it('renders "New Shortcut" for NEW_SHORTCUT type', () => {
    render(<SubmissionTypeBadge type="NEW_SHORTCUT" />);
    expect(screen.getByText('New Shortcut')).toBeDefined();
  });

  it('renders "Correction" for CORRECTION type', () => {
    render(<SubmissionTypeBadge type="CORRECTION" />);
    expect(screen.getByText('Correction')).toBeDefined();
  });

  it('renders "App Request" for APP_REQUEST type', () => {
    render(<SubmissionTypeBadge type="APP_REQUEST" />);
    expect(screen.getByText('App Request')).toBeDefined();
  });

  it('applies blue styling for NEW_SHORTCUT', () => {
    render(<SubmissionTypeBadge type="NEW_SHORTCUT" />);
    expect(screen.getByText('New Shortcut').className).toContain('bg-blue-100');
  });

  it('applies yellow styling for CORRECTION', () => {
    render(<SubmissionTypeBadge type="CORRECTION" />);
    expect(screen.getByText('Correction').className).toContain('bg-yellow-100');
  });

  it('applies green styling for APP_REQUEST', () => {
    render(<SubmissionTypeBadge type="APP_REQUEST" />);
    expect(screen.getByText('App Request').className).toContain('bg-green-100');
  });
});

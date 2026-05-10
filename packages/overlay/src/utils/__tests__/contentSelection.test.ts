import { describe, it, expect } from 'vitest';
import { selectGroups, capGroup } from '../contentSelection';
import type { ShortcutEntry } from '../../types';

function makeShortcuts(count: number): ShortcutEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    command: `Command ${i}`,
    platforms: [],
  }));
}

describe('selectGroups', () => {
  it('returns top 4 groups sorted by count descending (Standard)', () => {
    const contexts = {
      Small: makeShortcuts(2),
      Large: makeShortcuts(10),
      Medium: makeShortcuts(5),
      Tiny: makeShortcuts(1),
      Huge: makeShortcuts(20),
    };
    const result = selectGroups(contexts, 'Standard');
    expect(result).toHaveLength(4);
    expect(result[0]).toBe('Huge');
    expect(result[1]).toBe('Large');
    expect(result[2]).toBe('Medium');
    expect(result[3]).toBe('Small');
  });

  it('returns top 3 groups sorted by count descending (Compact)', () => {
    const contexts = {
      A: makeShortcuts(1),
      B: makeShortcuts(5),
      C: makeShortcuts(3),
      D: makeShortcuts(8),
    };
    const result = selectGroups(contexts, 'Compact');
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('D');
    expect(result[1]).toBe('B');
    expect(result[2]).toBe('C');
  });

  it('returns all groups when fewer than cap exist (Standard)', () => {
    const contexts = {
      A: makeShortcuts(5),
      B: makeShortcuts(3),
    };
    expect(selectGroups(contexts, 'Standard')).toHaveLength(2);
  });

  it('returns all groups when fewer than cap exist (Compact)', () => {
    const contexts = {
      A: makeShortcuts(5),
      B: makeShortcuts(3),
    };
    expect(selectGroups(contexts, 'Compact')).toHaveLength(2);
  });

  it('returns empty array for empty contexts', () => {
    expect(selectGroups({}, 'Standard')).toEqual([]);
    expect(selectGroups({}, 'Compact')).toEqual([]);
  });
});

describe('capGroup', () => {
  it('returns all shortcuts when count < cap (Standard = 12)', () => {
    const shortcuts = makeShortcuts(10);
    const { visible, overflowCount } = capGroup(shortcuts, 'Standard');
    expect(visible).toHaveLength(10);
    expect(overflowCount).toBe(0);
  });

  it('returns all shortcuts when count < cap (Compact = 8)', () => {
    const shortcuts = makeShortcuts(6);
    const { visible, overflowCount } = capGroup(shortcuts, 'Compact');
    expect(visible).toHaveLength(6);
    expect(overflowCount).toBe(0);
  });

  it('returns exactly cap shortcuts with zero overflow when count == cap (Standard)', () => {
    const shortcuts = makeShortcuts(12);
    const { visible, overflowCount } = capGroup(shortcuts, 'Standard');
    expect(visible).toHaveLength(12);
    expect(overflowCount).toBe(0);
  });

  it('returns exactly cap shortcuts with zero overflow when count == cap (Compact)', () => {
    const shortcuts = makeShortcuts(8);
    const { visible, overflowCount } = capGroup(shortcuts, 'Compact');
    expect(visible).toHaveLength(8);
    expect(overflowCount).toBe(0);
  });

  it('caps shortcuts and calculates overflow for Standard', () => {
    const shortcuts = makeShortcuts(15);
    const { visible, overflowCount } = capGroup(shortcuts, 'Standard');
    expect(visible).toHaveLength(12);
    expect(overflowCount).toBe(3);
  });

  it('caps shortcuts and calculates overflow for Compact', () => {
    const shortcuts = makeShortcuts(11);
    const { visible, overflowCount } = capGroup(shortcuts, 'Compact');
    expect(visible).toHaveLength(8);
    expect(overflowCount).toBe(3);
  });

  it('returns empty result for empty input', () => {
    const { visible, overflowCount } = capGroup([], 'Standard');
    expect(visible).toHaveLength(0);
    expect(overflowCount).toBe(0);
  });
});

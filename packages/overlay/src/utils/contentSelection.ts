/**
 * contentSelection.ts — Pure functions for selecting display content from AppDetail.
 *
 * The overlay is glanceable, not a full shortcut browser. Hard caps keep DOM nodes
 * minimal and directly support the <20MB idle memory target.
 */
import type { ShortcutEntry } from '../types';

type SizePreset = 'Compact' | 'Standard';

/** Max number of context groups shown per size preset. */
const GROUP_CAPS: Record<SizePreset, number> = {
  Compact: 3,
  Standard: 4,
};

/** Max number of shortcuts shown per group per size preset. */
const SHORTCUT_CAPS: Record<SizePreset, number> = {
  Compact: 8,
  Standard: 12,
};

/**
 * selectGroups — returns the top N context group names, sorted by shortcut count
 * descending. N is 3 for Compact, 4 for Standard.
 */
export function selectGroups(
  contexts: Record<string, ShortcutEntry[]>,
  size: SizePreset,
): string[] {
  const cap = GROUP_CAPS[size];
  return Object.entries(contexts)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, cap)
    .map(([name]) => name);
}

/**
 * capGroup — returns the visible shortcuts and overflow count for one context group.
 * visible.length <= cap (8 for Compact, 12 for Standard).
 */
export function capGroup(
  shortcuts: ShortcutEntry[],
  size: SizePreset,
): { visible: ShortcutEntry[]; overflowCount: number } {
  const cap = SHORTCUT_CAPS[size];
  if (shortcuts.length <= cap) {
    return { visible: shortcuts, overflowCount: 0 };
  }
  return { visible: shortcuts.slice(0, cap), overflowCount: shortcuts.length - cap };
}

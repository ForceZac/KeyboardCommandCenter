/**
 * shortcut-list.ts — Renders AppDetail shortcut data as HTML strings.
 *
 * Turns the structured API response from TASK-0012 (getShortcutsForApp) into
 * displayable shortcut rows and collapsible context groups.
 *
 * Design decisions (per TRD):
 * - HTML strings + innerHTML — shortcut data comes from the app's own DB via
 *   trusted IPC, not from user input. All values are HTML-escaped before injection.
 * - Native <details>/<summary> for collapsible groups — zero JS state required.
 * - Re-renders the entire list on each app-changed event (no diffing needed).
 */

// Types are re-declared locally in types.ts (rootDir constraint prevents
// importing from @kcc/core in the renderer tsconfig context).
import type { AppDetail, ShortcutEntry } from './types';

import { escHtml, renderKeyComboHTML } from './keycap';

/**
 * Renders one shortcut row: description on the left, key combo on the right,
 * and a heart toggle button (hidden until hover) on the far right.
 *
 * Picks the platform binding for the given platformSlug. If no binding exists
 * for that platform, falls back to the first available binding. If no bindings
 * exist at all, the key combo column is left empty.
 *
 * @param shortcut     - The shortcut entry to render.
 * @param platformSlug - The current platform (e.g. "macos", "windows").
 * @param isFavorited  - When true, the heart icon renders in filled state.
 */
export function renderShortcutRow(
  shortcut: ShortcutEntry,
  platformSlug: string,
  isFavorited = false,
): string {
  // Find platform-specific binding, or fall back to first available.
  const binding =
    shortcut.platforms.find((p) => p.platformSlug === platformSlug) ??
    shortcut.platforms[0] ??
    null;

  const comboHTML = binding ? renderKeyComboHTML(binding.keyCombo) : '';
  // Pre-lowercased data attributes let the search filter do a single includes()
  // call per row without any string allocation at filter time.
  const dataCmdAttr = escHtml(shortcut.command.toLowerCase());
  const dataComboAttr = escHtml(binding ? binding.keyCombo.toLowerCase() : '');
  const favClass = isFavorited ? ' favorited' : '';
  const shortcutId = escHtml(shortcut.id);

  return (
    `<div class="shortcut-row" data-cmd="${dataCmdAttr}" data-combo="${dataComboAttr}">` +
      `<span class="shortcut-cmd">${escHtml(shortcut.command)}</span>` +
      `<span class="shortcut-combo">${comboHTML}</span>` +
      `<button class="fav-btn${favClass}" data-shortcut-id="${shortcutId}" aria-label="Toggle favorite">♥</button>` +
    `</div>`
  );
}

/**
 * Renders one context group as a collapsible <details> block.
 * Groups are open by default (the `open` attribute on <details>).
 */
export function renderContextGroup(
  contextName: string,
  shortcuts: ShortcutEntry[],
  platformSlug: string,
  favoritedIds: ReadonlySet<string> = new Set(),
): string {
  const rows = shortcuts
    .map((s) => renderShortcutRow(s, platformSlug, favoritedIds.has(s.id)))
    .join('');
  return (
    `<details class="context-group" open>` +
      `<summary class="context-heading">${escHtml(contextName)}</summary>` +
      `<div class="context-rows">${rows}</div>` +
    `</details>`
  );
}

/**
 * Renders the full shortcut list for an app.
 * Iterates appDetail.contexts in insertion order (contexts are sorted alphabetically
 * by the ShortcutService before being returned).
 *
 * @param favoritedIds - Set of shortcut IDs currently favorited by the user.
 *                       Heart icons render filled for IDs in this set.
 *
 * Returns an empty string when there are no contexts (zero shortcuts).
 */
export function renderShortcutList(
  appDetail: AppDetail,
  platformSlug: string,
  favoritedIds: ReadonlySet<string> = new Set(),
): string {
  const contextEntries = Object.entries(appDetail.contexts);
  if (contextEntries.length === 0) return '';

  return contextEntries
    .map(([name, shortcuts]) => renderContextGroup(name, shortcuts, platformSlug, favoritedIds))
    .join('');
}

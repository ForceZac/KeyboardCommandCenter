/**
 * keycap.ts — Renders keyboard shortcuts as styled <kbd> HTML strings.
 *
 * Ported from the web app's KeyCap/KeyCombo components. The desktop renderer
 * uses vanilla HTML/CSS rather than React/Tailwind, so the visual pattern is
 * duplicated here (per TRD architectural decision — no shared abstraction).
 *
 * Chord step separator: ' → ' (space + right-arrow + space).
 * Modifier separator within a step: '+'.
 */

/** Escapes text for safe injection into innerHTML. */
export function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders a single key label as a styled <kbd> element HTML string.
 * Example: renderKeyCapHTML('Ctrl') → '<kbd class="key-cap">Ctrl</kbd>'
 */
export function renderKeyCapHTML(label: string): string {
  if (!label) return '';
  return `<kbd class="key-cap">${escHtml(label)}</kbd>`;
}

/**
 * Chord step separator used by ShortcutService (TASK-0012) when joining multi-step chords.
 * Splitting on this string reproduces the original steps.
 */
const CHORD_SEPARATOR = ' → ';

/**
 * Renders a full key combo string as a sequence of <kbd> elements with separators.
 *
 * - Chord steps (e.g. "Ctrl+K → Ctrl+C") are split by ' → ' and separated by an
 *   arrow span between step groups.
 * - Modifiers within a step (e.g. "Ctrl+Shift+P") are split by '+' and each key
 *   gets its own <kbd> with a '+' separator span between them.
 *
 * Returns an empty string for an empty or whitespace-only input.
 */
export function renderKeyComboHTML(combo: string): string {
  if (!combo || !combo.trim()) return '';

  const steps = combo.split(CHORD_SEPARATOR);
  const stepHTMLs = steps.map((step, stepIdx) => {
    const keys = step.split('+').map((k) => k.trim()).filter(Boolean);
    const keysHTML = keys
      .map((key, keyIdx) => {
        const sep = keyIdx > 0
          ? '<span class="key-sep-plus">+</span>'
          : '';
        return `${sep}${renderKeyCapHTML(key)}`;
      })
      .join('');

    const chordArrow = stepIdx > 0
      ? '<span class="key-sep-chord">→</span>'
      : '';
    return `${chordArrow}<span class="key-step">${keysHTML}</span>`;
  });

  return `<span class="key-combo">${stepHTMLs.join('')}</span>`;
}

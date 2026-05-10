/**
 * app-header.ts — Renders the app name into the panel header.
 *
 * Text-only display (no icon) for v1, per TRD/PRD scope.
 */

import { escHtml } from './keycap';

/**
 * Returns the inner HTML for the #app-name span in the panel header.
 * The caller injects this into the DOM.
 */
export function renderAppHeader(appName: string): string {
  return escHtml(appName);
}

/**
 * Clears the app header to an empty/loading state.
 * Used when no app is detected or before new data arrives.
 */
export function clearAppHeader(): string {
  return '';
}

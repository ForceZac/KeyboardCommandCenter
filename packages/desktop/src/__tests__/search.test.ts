// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initSearch, applyFilter, resetFilter } from '../renderer/search';

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a minimal shortcut container that mirrors what shortcut-list.ts renders.
 *
 *   #shortcuts-container
 *     <details class="context-group" open>
 *       <summary class="context-heading">Editor</summary>
 *       <div class="context-rows">
 *         <div class="shortcut-row" data-cmd="save file" data-combo="ctrl+s">…</div>
 *         <div class="shortcut-row" data-cmd="find" data-combo="ctrl+f">…</div>
 *       </div>
 *     </details>
 *     <details class="context-group" open>
 *       <summary class="context-heading">Debug</summary>
 *       <div class="context-rows">
 *         <div class="shortcut-row" data-cmd="start debugging" data-combo="f5">…</div>
 *       </div>
 *     </details>
 *     <div id="no-results" hidden>No matching shortcuts</div>
 */
function makeContainer(): { container: HTMLElement; noResults: HTMLElement } {
  const container = document.createElement('div');
  container.id = 'shortcuts-container';
  container.innerHTML = `
    <details class="context-group" open>
      <summary class="context-heading">Editor</summary>
      <div class="context-rows">
        <div class="shortcut-row" data-cmd="save file" data-combo="ctrl+s"></div>
        <div class="shortcut-row" data-cmd="find" data-combo="ctrl+f"></div>
      </div>
    </details>
    <details class="context-group" open>
      <summary class="context-heading">Debug</summary>
      <div class="context-rows">
        <div class="shortcut-row" data-cmd="start debugging" data-combo="f5"></div>
      </div>
    </details>
    <div id="no-results" hidden>No matching shortcuts</div>
  `;
  document.body.appendChild(container);
  const noResults = container.querySelector<HTMLElement>('#no-results')!;
  return { container, noResults };
}

function rows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.shortcut-row'));
}

function groups(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.context-group'));
}

// ── Test setup ────────────────────────────────────────────────────────────

let container: HTMLElement;
let noResults: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  ({ container, noResults } = makeContainer());
});

// ── applyFilter ───────────────────────────────────────────────────────────

describe('applyFilter', () => {
  it('shows all rows when query is empty', () => {
    applyFilter('', container, noResults);
    expect(rows(container).every((r) => !r.hidden)).toBe(true);
  });

  it('hides non-matching rows', () => {
    applyFilter('save', container, noResults);
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(false); // "save file"
    expect(allRows[1]!.hidden).toBe(true);  // "find"
    expect(allRows[2]!.hidden).toBe(true);  // "start debugging"
  });

  it('shows matching rows', () => {
    applyFilter('ctrl', container, noResults);
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(false); // combo: ctrl+s
    expect(allRows[1]!.hidden).toBe(false); // combo: ctrl+f
    expect(allRows[2]!.hidden).toBe(true);  // combo: f5
  });

  it('matches against data-cmd (command description)', () => {
    applyFilter('find', container, noResults);
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(true);  // "save file" — no match
    expect(allRows[1]!.hidden).toBe(false); // "find" — match
    expect(allRows[2]!.hidden).toBe(true);  // "start debugging" — no match
  });

  it('matches against data-combo (key combo)', () => {
    applyFilter('f5', container, noResults);
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(true);  // ctrl+s — no match
    expect(allRows[1]!.hidden).toBe(true);  // ctrl+f — no match
    expect(allRows[2]!.hidden).toBe(false); // f5 — match
  });

  it('is case-insensitive (uppercase query vs lowercase data attribute)', () => {
    applyFilter('CTRL', container, noResults);
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(false); // ctrl+s matches CTRL
    expect(allRows[1]!.hidden).toBe(false); // ctrl+f matches CTRL
    expect(allRows[2]!.hidden).toBe(true);
  });

  it('hides a context group when all its rows are hidden', () => {
    // "debug" group has one row with data-cmd="start debugging", combo="f5"
    // Filtering by "save" will hide that row → group should hide.
    applyFilter('save', container, noResults);
    const allGroups = groups(container);
    expect(allGroups[0]!.hidden).toBe(false); // Editor group — "save file" matches
    expect(allGroups[1]!.hidden).toBe(true);  // Debug group — no rows match
  });

  it('keeps a context group visible when at least one row matches', () => {
    // "ctrl" matches both Editor rows; Editor group must stay visible.
    applyFilter('ctrl', container, noResults);
    const allGroups = groups(container);
    expect(allGroups[0]!.hidden).toBe(false); // Editor — two matches
    expect(allGroups[1]!.hidden).toBe(true);  // Debug — no match (f5)
  });

  it('shows no-results message when nothing matches', () => {
    applyFilter('zzznomatch', container, noResults);
    expect(noResults.hidden).toBe(false);
  });

  it('hides no-results message when at least one row matches', () => {
    applyFilter('save', container, noResults);
    expect(noResults.hidden).toBe(true);
  });

  it('hides no-results message when query is empty', () => {
    // Empty query → show all — no-results should be hidden.
    applyFilter('zzznomatch', container, noResults); // make it visible first
    applyFilter('', container, noResults);
    expect(noResults.hidden).toBe(true);
  });
});

// ── resetFilter ───────────────────────────────────────────────────────────

describe('resetFilter', () => {
  it('clears the input value', () => {
    const input = document.createElement('input') as HTMLInputElement;
    input.value = 'ctrl';
    resetFilter(input, container, noResults);
    expect(input.value).toBe('');
  });

  it('makes all rows visible after a filter was applied', () => {
    // First filter to hide rows.
    applyFilter('save', container, noResults);
    expect(rows(container).some((r) => r.hidden)).toBe(true);

    const input = document.createElement('input') as HTMLInputElement;
    input.value = 'save';
    resetFilter(input, container, noResults);
    expect(rows(container).every((r) => !r.hidden)).toBe(true);
  });

  it('hides the no-results message', () => {
    applyFilter('zzznomatch', container, noResults);
    expect(noResults.hidden).toBe(false);

    const input = document.createElement('input') as HTMLInputElement;
    resetFilter(input, container, noResults);
    expect(noResults.hidden).toBe(true);
  });
});

// ── initSearch ────────────────────────────────────────────────────────────

describe('initSearch', () => {
  it('attaches a filter listener that fires on input events', () => {
    const input = document.createElement('input') as HTMLInputElement;
    document.body.appendChild(input);
    initSearch(input, container, noResults);

    input.value = 'save';
    input.dispatchEvent(new Event('input'));

    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(false); // "save file" — matches
    expect(allRows[1]!.hidden).toBe(true);  // "find" — no match
  });
});

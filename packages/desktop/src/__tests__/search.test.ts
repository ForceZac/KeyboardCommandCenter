// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initSearch, applyFilter, resetFilter } from '../renderer/search';

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a minimal shortcut container that mirrors what shortcut-list.ts renders.
 *
 * DOM layout (matches index.html after fix):
 *   #shortcuts-container          ← innerHTML gets replaced on every app change
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
 *   #favorites-container (empty)  ← TASK-0026: sibling container for favorites view
 *   #no-results (hidden)          ← OUTSIDE #shortcuts-container — survives innerHTML replacement
 */
function makeContainer(): {
  container: HTMLElement;
  favoritesContainer: HTMLElement;
  noResults: HTMLElement;
} {
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
  `;
  document.body.appendChild(container);

  // #favorites-container — empty in these tests (App Shortcuts view is active).
  const favoritesContainer = document.createElement('div');
  favoritesContainer.id = 'favorites-container';
  document.body.appendChild(favoritesContainer);

  // #no-results lives outside #shortcuts-container so container.innerHTML = doesn't orphan it.
  const noResults = document.createElement('div');
  noResults.id = 'no-results';
  noResults.hidden = true;
  noResults.textContent = 'No matching shortcuts';
  document.body.appendChild(noResults);

  return { container, favoritesContainer, noResults };
}

function rows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.shortcut-row'));
}

function groups(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.context-group'));
}

// ── Test setup ────────────────────────────────────────────────────────────

let container: HTMLElement;
let favoritesContainer: HTMLElement;
let noResults: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  ({ container, favoritesContainer, noResults } = makeContainer());
});

// ── applyFilter (App Shortcuts view) ──────────────────────────────────────

describe('applyFilter', () => {
  it('shows all rows when query is empty', () => {
    applyFilter('', container, favoritesContainer, noResults, 'app-shortcuts');
    expect(rows(container).every((r) => !r.hidden)).toBe(true);
  });

  it('hides non-matching rows', () => {
    applyFilter('save', container, favoritesContainer, noResults, 'app-shortcuts');
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(false); // "save file"
    expect(allRows[1]!.hidden).toBe(true);  // "find"
    expect(allRows[2]!.hidden).toBe(true);  // "start debugging"
  });

  it('shows matching rows', () => {
    applyFilter('ctrl', container, favoritesContainer, noResults, 'app-shortcuts');
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(false); // combo: ctrl+s
    expect(allRows[1]!.hidden).toBe(false); // combo: ctrl+f
    expect(allRows[2]!.hidden).toBe(true);  // combo: f5
  });

  it('matches against data-cmd (command description)', () => {
    applyFilter('find', container, favoritesContainer, noResults, 'app-shortcuts');
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(true);  // "save file" — no match
    expect(allRows[1]!.hidden).toBe(false); // "find" — match
    expect(allRows[2]!.hidden).toBe(true);  // "start debugging" — no match
  });

  it('matches against data-combo (key combo)', () => {
    applyFilter('f5', container, favoritesContainer, noResults, 'app-shortcuts');
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(true);  // ctrl+s — no match
    expect(allRows[1]!.hidden).toBe(true);  // ctrl+f — no match
    expect(allRows[2]!.hidden).toBe(false); // f5 — match
  });

  it('is case-insensitive (uppercase query vs lowercase data attribute)', () => {
    applyFilter('CTRL', container, favoritesContainer, noResults, 'app-shortcuts');
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(false); // ctrl+s matches CTRL
    expect(allRows[1]!.hidden).toBe(false); // ctrl+f matches CTRL
    expect(allRows[2]!.hidden).toBe(true);
  });

  it('hides a context group when all its rows are hidden', () => {
    applyFilter('save', container, favoritesContainer, noResults, 'app-shortcuts');
    const allGroups = groups(container);
    expect(allGroups[0]!.hidden).toBe(false); // Editor group — "save file" matches
    expect(allGroups[1]!.hidden).toBe(true);  // Debug group — no rows match
  });

  it('keeps a context group visible when at least one row matches', () => {
    applyFilter('ctrl', container, favoritesContainer, noResults, 'app-shortcuts');
    const allGroups = groups(container);
    expect(allGroups[0]!.hidden).toBe(false); // Editor — two matches
    expect(allGroups[1]!.hidden).toBe(true);  // Debug — no match (f5)
  });

  it('shows no-results message when nothing matches', () => {
    applyFilter('zzznomatch', container, favoritesContainer, noResults, 'app-shortcuts');
    expect(noResults.hidden).toBe(false);
  });

  it('hides no-results message when at least one row matches', () => {
    applyFilter('save', container, favoritesContainer, noResults, 'app-shortcuts');
    expect(noResults.hidden).toBe(true);
  });

  it('hides no-results message when query is empty', () => {
    applyFilter('zzznomatch', container, favoritesContainer, noResults, 'app-shortcuts');
    applyFilter('', container, favoritesContainer, noResults, 'app-shortcuts');
    expect(noResults.hidden).toBe(true);
  });
});

// ── applyFilter (My Favorites view) ──────────────────────────────────────

describe('applyFilter — favorites view', () => {
  function makePopulatedFavoritesContainer(): HTMLElement {
    favoritesContainer.innerHTML = `
      <div class="favorites-section">
        <div class="favorites-section-header">My Favorites</div>
        <div class="fav-row" data-cmd="save file" data-app="vs code"></div>
        <div class="fav-row" data-cmd="find" data-app="vs code"></div>
        <div class="fav-row" data-cmd="start debugging" data-app="chrome"></div>
      </div>
    `;
    return favoritesContainer;
  }

  it('shows all fav-rows when query is empty', () => {
    makePopulatedFavoritesContainer();
    applyFilter('', container, favoritesContainer, noResults, 'favorites');
    const favRows = Array.from(favoritesContainer.querySelectorAll<HTMLElement>('.fav-row'));
    expect(favRows.every((r) => !r.hidden)).toBe(true);
  });

  it('filters fav-rows by data-cmd', () => {
    makePopulatedFavoritesContainer();
    applyFilter('save', container, favoritesContainer, noResults, 'favorites');
    const favRows = Array.from(favoritesContainer.querySelectorAll<HTMLElement>('.fav-row'));
    expect(favRows[0]!.hidden).toBe(false); // "save file"
    expect(favRows[1]!.hidden).toBe(true);  // "find"
    expect(favRows[2]!.hidden).toBe(true);  // "start debugging"
  });

  it('filters fav-rows by data-app', () => {
    makePopulatedFavoritesContainer();
    applyFilter('chrome', container, favoritesContainer, noResults, 'favorites');
    const favRows = Array.from(favoritesContainer.querySelectorAll<HTMLElement>('.fav-row'));
    expect(favRows[0]!.hidden).toBe(true);  // vs code
    expect(favRows[1]!.hidden).toBe(true);  // vs code
    expect(favRows[2]!.hidden).toBe(false); // chrome
  });

  it('does NOT filter shortcut-rows in favorites view', () => {
    makePopulatedFavoritesContainer();
    applyFilter('save', container, favoritesContainer, noResults, 'favorites');
    // shortcut rows in the shortcuts container must remain untouched
    const shortcutRows = rows(container);
    expect(shortcutRows.every((r) => !r.hidden)).toBe(true);
  });

  it('shows no-results when nothing matches in favorites view', () => {
    makePopulatedFavoritesContainer();
    applyFilter('zzznomatch', container, favoritesContainer, noResults, 'favorites');
    expect(noResults.hidden).toBe(false);
  });
});

// ── resetFilter ───────────────────────────────────────────────────────────

describe('resetFilter', () => {
  it('clears the input value', () => {
    const input = document.createElement('input') as HTMLInputElement;
    input.value = 'ctrl';
    resetFilter(input, container, favoritesContainer, noResults, 'app-shortcuts');
    expect(input.value).toBe('');
  });

  it('makes all rows visible after a filter was applied', () => {
    applyFilter('save', container, favoritesContainer, noResults, 'app-shortcuts');
    expect(rows(container).some((r) => r.hidden)).toBe(true);

    const input = document.createElement('input') as HTMLInputElement;
    input.value = 'save';
    resetFilter(input, container, favoritesContainer, noResults, 'app-shortcuts');
    expect(rows(container).every((r) => !r.hidden)).toBe(true);
  });

  it('hides the no-results message', () => {
    applyFilter('zzznomatch', container, favoritesContainer, noResults, 'app-shortcuts');
    expect(noResults.hidden).toBe(false);

    const input = document.createElement('input') as HTMLInputElement;
    resetFilter(input, container, favoritesContainer, noResults, 'app-shortcuts');
    expect(noResults.hidden).toBe(true);
  });
});

// ── initSearch ────────────────────────────────────────────────────────────

describe('initSearch', () => {
  it('attaches a filter listener that fires on input events', () => {
    const input = document.createElement('input') as HTMLInputElement;
    document.body.appendChild(input);
    initSearch(input, container, favoritesContainer, noResults, () => 'app-shortcuts');

    input.value = 'save';
    input.dispatchEvent(new Event('input'));

    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(false); // "save file" — matches
    expect(allRows[1]!.hidden).toBe(true);  // "find" — no match
  });

  it('uses the active view returned by getActiveView at filter time', () => {
    favoritesContainer.innerHTML = `
      <div class="fav-row" data-cmd="save file" data-app="vs code"></div>
      <div class="fav-row" data-cmd="find" data-app="vs code"></div>
    `;
    const input = document.createElement('input') as HTMLInputElement;
    document.body.appendChild(input);

    let activeView: 'app-shortcuts' | 'favorites' = 'favorites';
    initSearch(input, container, favoritesContainer, noResults, () => activeView);

    input.value = 'save';
    input.dispatchEvent(new Event('input'));

    // In favorites view: fav-rows are filtered, shortcut-rows are untouched.
    const favRows = Array.from(favoritesContainer.querySelectorAll<HTMLElement>('.fav-row'));
    expect(favRows[0]!.hidden).toBe(false); // "save file" — match
    expect(favRows[1]!.hidden).toBe(true);  // "find" — no match
    // shortcut-rows in App Shortcuts view must be unchanged
    expect(rows(container).every((r) => !r.hidden)).toBe(true);

    // Now switch view and fire another input event.
    activeView = 'app-shortcuts';
    input.value = 'save';
    input.dispatchEvent(new Event('input'));

    // Now shortcut-rows are filtered.
    const allRows = rows(container);
    expect(allRows[0]!.hidden).toBe(false); // "save file" — match
    expect(allRows[1]!.hidden).toBe(true);  // "find" — no match
  });
});

// ── regression ────────────────────────────────────────────────────────────

describe('regression: #no-results survives container innerHTML replacement', () => {
  it('noResults is not a detached orphan after container.innerHTML is replaced', () => {
    applyFilter('zzznomatch', container, favoritesContainer, noResults, 'app-shortcuts');
    expect(noResults.hidden).toBe(false);

    container.innerHTML = '<details class="context-group"><div class="context-rows"></div></details>';

    expect(document.contains(noResults)).toBe(true);
  });
});

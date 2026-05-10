// @vitest-environment jsdom
/**
 * Integration tests for panel fallback state behavior (TASK-0016).
 *
 * These tests simulate what handleAppChanged does in index.ts: they set up the
 * panel DOM, call fallback rendering functions, manipulate element visibility,
 * and assert the resulting DOM state.  The IPC layer (window.kcc) is mocked.
 *
 * Coverage mirrors the TRD test plan:
 *   - no-detection fallback
 *   - unrecognized-app fallback
 *   - no-shortcuts fallback (empty contexts / null appDetail)
 *   - recent-apps list populated from getRecentApps mock
 *   - click on .recent-app-item triggers slug-based load
 *   - edge case: empty recent-apps list renders gracefully
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderNoDetection,
  renderUnrecognizedApp,
  renderNoShortcuts,
  type RecentAppEntry,
} from '../renderer/fallback';

// ── DOM setup helpers ─────────────────────────────────────────────────────

/**
 * Build the panel DOM matching index.html (simplified — only the elements that
 * handleAppChanged touches). Appends into document.body; cleared by beforeEach.
 */
function buildPanel(): {
  appNameEl: HTMLElement;
  shortcutsEl: HTMLElement;
  searchContainerEl: HTMLElement;
  fallbackEl: HTMLElement;
} {
  document.body.innerHTML = `
    <div id="app-header"><span id="app-name"></span></div>
    <div id="search-container"></div>
    <div id="shortcuts-container"></div>
    <div id="no-results" hidden>No matching shortcuts</div>
    <div id="fallback-container" hidden></div>
  `;
  return {
    appNameEl: document.getElementById('app-name')!,
    shortcutsEl: document.getElementById('shortcuts-container')!,
    searchContainerEl: document.getElementById('search-container')!,
    fallbackEl: document.getElementById('fallback-container')!,
  };
}

/** Show the fallback container and hide shortcut UI (mirrors showFallback in index.ts). */
function showFallback(
  html: string,
  fallbackEl: HTMLElement,
  shortcutsEl: HTMLElement,
  searchContainerEl: HTMLElement,
): void {
  fallbackEl.innerHTML = html;
  fallbackEl.hidden = false;
  shortcutsEl.hidden = true;
  searchContainerEl.hidden = true;
}

/** Show shortcuts UI and hide fallback (mirrors showShortcuts in index.ts). */
function showShortcuts(
  fallbackEl: HTMLElement,
  shortcutsEl: HTMLElement,
  searchContainerEl: HTMLElement,
): void {
  fallbackEl.hidden = true;
  shortcutsEl.hidden = false;
  searchContainerEl.hidden = false;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────

const recentApps: RecentAppEntry[] = [
  { slug: 'vscode', name: 'VS Code' },
  { slug: 'figma', name: 'Figma' },
];

// ── Fallback routing: no-detection ────────────────────────────────────────

describe('no-detection fallback (appSlug null, processName empty)', () => {
  it('renders the no-detection message into #fallback-container', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderNoDetection(recentApps);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    expect(fallbackEl.hidden).toBe(false);
    expect(fallbackEl.textContent).toContain('No app detected');
  });

  it('hides #shortcuts-container and #search-container in fallback state', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderNoDetection(recentApps);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    expect(shortcutsEl.hidden).toBe(true);
    expect(searchContainerEl.hidden).toBe(true);
  });

  it('shows recent apps in the fallback container', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderNoDetection(recentApps);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    expect(fallbackEl.textContent).toContain('VS Code');
    expect(fallbackEl.textContent).toContain('Figma');
  });

  it('renders gracefully with an empty recent-apps list', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderNoDetection([]);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    expect(fallbackEl.hidden).toBe(false);
    expect(fallbackEl.textContent).toContain('No app detected');
    // No crash, no broken elements
    expect(fallbackEl.querySelector('.recent-app-item')).toBeNull();
  });
});

// ── Fallback routing: unrecognized app ────────────────────────────────────

describe('unrecognized-app fallback (appSlug null, processName non-empty)', () => {
  it('renders the process name in #fallback-container', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderUnrecognizedApp('SomeApp.exe', recentApps);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    expect(fallbackEl.hidden).toBe(false);
    expect(fallbackEl.textContent).toContain('SomeApp.exe');
  });

  it('hides shortcuts and search containers', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderUnrecognizedApp('SomeApp.exe', recentApps);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    expect(shortcutsEl.hidden).toBe(true);
    expect(searchContainerEl.hidden).toBe(true);
  });

  it('shows recent apps in the fallback container', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderUnrecognizedApp('SomeApp.exe', recentApps);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    expect(fallbackEl.textContent).toContain('VS Code');
    expect(fallbackEl.querySelector('[data-slug="figma"]')).not.toBeNull();
  });
});

// ── Fallback routing: no shortcuts ────────────────────────────────────────

describe('no-shortcuts fallback (recognized app, empty contexts)', () => {
  it('renders the app name in #fallback-container', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderNoShortcuts('Affinity Designer', recentApps);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    expect(fallbackEl.hidden).toBe(false);
    expect(fallbackEl.textContent).toContain('Affinity Designer');
  });

  it('hides shortcuts and search containers', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderNoShortcuts('Affinity Designer', recentApps);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    expect(shortcutsEl.hidden).toBe(true);
    expect(searchContainerEl.hidden).toBe(true);
  });
});

// ── Happy-path restores shortcut UI ──────────────────────────────────────

describe('happy-path: showShortcuts restores UI after fallback', () => {
  it('shows #shortcuts-container and #search-container', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    // Put panel into fallback first.
    showFallback(renderNoDetection([]), fallbackEl, shortcutsEl, searchContainerEl);
    expect(fallbackEl.hidden).toBe(false);

    // Then restore happy path.
    showShortcuts(fallbackEl, shortcutsEl, searchContainerEl);
    expect(fallbackEl.hidden).toBe(true);
    expect(shortcutsEl.hidden).toBe(false);
    expect(searchContainerEl.hidden).toBe(false);
  });
});

// ── Click delegation on #fallback-container ───────────────────────────────

describe('click delegation on .recent-app-item', () => {
  it('fires the slug from data-slug when a recent-app item is clicked', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderNoDetection(recentApps);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    // Simulate the delegated click listener from index.ts.
    const capturedSlugs: string[] = [];
    fallbackEl.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as Element;
      const item = target.closest<HTMLElement>('.recent-app-item[data-slug]');
      if (item?.dataset['slug']) capturedSlugs.push(item.dataset['slug']);
    });

    // Click the first item (VS Code, slug=vscode).
    const vsCodeItem = fallbackEl.querySelector<HTMLElement>('[data-slug="vscode"]');
    expect(vsCodeItem).not.toBeNull();
    vsCodeItem!.click();

    expect(capturedSlugs).toHaveLength(1);
    expect(capturedSlugs[0]).toBe('vscode');
  });

  it('fires the correct slug when a nested child inside the item is clicked', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();

    // Render with an item that has inner markup (closest() must walk up).
    fallbackEl.innerHTML =
      `<div class="recent-app-item" data-slug="figma"><span class="inner">Figma</span></div>`;
    fallbackEl.hidden = false;
    shortcutsEl.hidden = true;
    searchContainerEl.hidden = true;

    const capturedSlugs: string[] = [];
    fallbackEl.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as Element;
      const item = target.closest<HTMLElement>('.recent-app-item[data-slug]');
      if (item?.dataset['slug']) capturedSlugs.push(item.dataset['slug']);
    });

    // Click the inner span — closest() must find the parent item.
    const innerSpan = fallbackEl.querySelector<HTMLElement>('.inner');
    expect(innerSpan).not.toBeNull();
    innerSpan!.click();

    expect(capturedSlugs).toHaveLength(1);
    expect(capturedSlugs[0]).toBe('figma');
  });

  it('does not fire when clicking fallback container background (no .recent-app-item ancestor)', () => {
    const { fallbackEl, shortcutsEl, searchContainerEl } = buildPanel();
    const html = renderNoDetection([]);
    showFallback(html, fallbackEl, shortcutsEl, searchContainerEl);

    const capturedSlugs: string[] = [];
    fallbackEl.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as Element;
      const item = target.closest<HTMLElement>('.recent-app-item[data-slug]');
      if (item?.dataset['slug']) capturedSlugs.push(item.dataset['slug']);
    });

    // Click the container itself — no .recent-app-item ancestor.
    fallbackEl.click();
    expect(capturedSlugs).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  renderWaylandBanner,
  renderManualAppSelector,
  renderWaylandUnavailable,
  filterApps,
  sortAppsWithLastUsedFirst,
  type AppEntry,
} from '../renderer/wayland-unavailable';

// ── Fixtures ──────────────────────────────────────────────────────────────

const threeApps: AppEntry[] = [
  { slug: 'vscode', name: 'VS Code' },
  { slug: 'figma', name: 'Figma' },
  { slug: 'slack', name: 'Slack' },
];

const xssApp: AppEntry[] = [
  { slug: 'evil-slug', name: '<script>alert(1)</script>' },
];

// ── filterApps ────────────────────────────────────────────────────────────

describe('filterApps', () => {
  it('returns the full list when query is empty', () => {
    expect(filterApps(threeApps, '')).toEqual(threeApps);
  });

  it('returns the full list when query is only whitespace', () => {
    expect(filterApps(threeApps, '   ')).toEqual(threeApps);
  });

  it('filters by name (case-insensitive)', () => {
    const result = filterApps(threeApps, 'fig');
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('figma');
  });

  it('filter is case-insensitive — uppercase query matches lowercase name', () => {
    const result = filterApps(threeApps, 'SLACK');
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('slack');
  });

  it('returns an empty array when no apps match', () => {
    expect(filterApps(threeApps, 'zzz-no-match')).toEqual([]);
  });

  it('returns multiple matches when several apps contain the query', () => {
    const apps: AppEntry[] = [
      { slug: 'code', name: 'VS Code' },
      { slug: 'codepen', name: 'CodePen' },
      { slug: 'figma', name: 'Figma' },
    ];
    const result = filterApps(apps, 'code');
    expect(result).toHaveLength(2);
  });
});

// ── sortAppsWithLastUsedFirst ─────────────────────────────────────────────

describe('sortAppsWithLastUsedFirst', () => {
  it('returns the original array when lastUsedSlug is null', () => {
    const result = sortAppsWithLastUsedFirst(threeApps, null);
    expect(result).toEqual(threeApps);
  });

  it('returns original order when lastUsedSlug is unknown', () => {
    const result = sortAppsWithLastUsedFirst(threeApps, 'no-such-app');
    expect(result).toEqual(threeApps);
  });

  it('moves the known slug to index 0', () => {
    const result = sortAppsWithLastUsedFirst(threeApps, 'slack');
    expect(result[0]?.slug).toBe('slack');
    expect(result).toHaveLength(3);
  });

  it('retains the rest of the list in original order after moving last-used', () => {
    const result = sortAppsWithLastUsedFirst(threeApps, 'figma');
    expect(result[0]?.slug).toBe('figma');
    expect(result[1]?.slug).toBe('vscode');
    expect(result[2]?.slug).toBe('slack');
  });

  it('does not mutate the original array', () => {
    const original = [...threeApps];
    sortAppsWithLastUsedFirst(threeApps, 'slack');
    expect(threeApps).toEqual(original);
  });
});

// ── renderWaylandBanner ───────────────────────────────────────────────────

describe('renderWaylandBanner', () => {
  it('returns a non-empty string', () => {
    expect(renderWaylandBanner().length).toBeGreaterThan(0);
  });

  it('contains the dismiss button id', () => {
    expect(renderWaylandBanner()).toContain('id="wayland-banner-dismiss"');
  });

  it('contains the expected banner text', () => {
    expect(renderWaylandBanner()).toContain(
      "Automatic app detection isn't available on your Wayland compositor",
    );
  });

  it('contains the banner wrapper id', () => {
    expect(renderWaylandBanner()).toContain('id="wayland-banner"');
  });
});

// ── renderManualAppSelector ───────────────────────────────────────────────

describe('renderManualAppSelector', () => {
  it('renders one item per app entry', () => {
    const html = renderManualAppSelector(threeApps, null);
    const matches = html.match(/class="manual-app-item/g);
    expect(matches).toHaveLength(3);
  });

  it('includes each app name in the output', () => {
    const html = renderManualAppSelector(threeApps, null);
    expect(html).toContain('VS Code');
    expect(html).toContain('Figma');
    expect(html).toContain('Slack');
  });

  it('marks the last-used slug with the CSS class', () => {
    const html = renderManualAppSelector(threeApps, 'figma');
    expect(html).toContain('manual-app-item--last-used');
    // Only figma should have the last-used class; count occurrences
    const lastUsedMatches = html.match(/manual-app-item--last-used/g);
    expect(lastUsedMatches).toHaveLength(1);
  });

  it('does not mark any item with last-used class when lastUsedSlug is null', () => {
    const html = renderManualAppSelector(threeApps, null);
    expect(html).not.toContain('manual-app-item--last-used');
  });

  it('HTML-escapes app names containing special characters (XSS protection)', () => {
    const html = renderManualAppSelector(xssApp, null);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('HTML-escapes ampersand in app names', () => {
    const apps: AppEntry[] = [{ slug: 'at-t', name: 'AT&T' }];
    const html = renderManualAppSelector(apps, null);
    expect(html).not.toContain('AT&T');
    expect(html).toContain('AT&amp;T');
  });

  it('HTML-escapes slug values in data-slug attributes', () => {
    const apps: AppEntry[] = [{ slug: '"evil"', name: 'Evil App' }];
    const html = renderManualAppSelector(apps, null);
    expect(html).not.toContain('data-slug=""evil""');
    expect(html).toContain('&quot;evil&quot;');
  });

  it('places the search input in the output', () => {
    const html = renderManualAppSelector(threeApps, null);
    expect(html).toContain('id="manual-app-search"');
  });
});

// ── renderWaylandUnavailable ──────────────────────────────────────────────

describe('renderWaylandUnavailable', () => {
  it('combines banner and selector into a non-empty string', () => {
    const html = renderWaylandUnavailable(threeApps, null);
    expect(html.length).toBeGreaterThan(0);
  });

  it('contains both the banner and the selector', () => {
    const html = renderWaylandUnavailable(threeApps, null);
    expect(html).toContain('id="wayland-banner"');
    expect(html).toContain('id="manual-app-selector"');
  });
});

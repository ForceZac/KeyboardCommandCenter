import { describe, it, expect } from 'vitest';
import {
  renderNoDetection,
  renderUnrecognizedApp,
  renderNoShortcuts,
  renderRecentAppsList,
  renderEmptyRecentApps,
  type RecentAppEntry,
} from '../renderer/fallback';

// ── Fixtures ──────────────────────────────────────────────────────────────

const twoApps: RecentAppEntry[] = [
  { slug: 'vscode', name: 'VS Code' },
  { slug: 'figma', name: 'Figma' },
];

const htmlInjectionApp: RecentAppEntry[] = [
  { slug: 'evil-slug', name: '<script>alert(1)</script>' },
];

// ── renderEmptyRecentApps ─────────────────────────────────────────────────

describe('renderEmptyRecentApps', () => {
  it('renders without error', () => {
    expect(() => renderEmptyRecentApps()).not.toThrow();
  });

  it('contains a non-empty string', () => {
    expect(renderEmptyRecentApps().length).toBeGreaterThan(0);
  });
});

// ── renderRecentAppsList ──────────────────────────────────────────────────

describe('renderRecentAppsList', () => {
  it('renders the empty state when given an empty array', () => {
    const html = renderRecentAppsList([]);
    expect(html).toBe(renderEmptyRecentApps());
  });

  it('renders each app name', () => {
    const html = renderRecentAppsList(twoApps);
    expect(html).toContain('VS Code');
    expect(html).toContain('Figma');
  });

  it('includes the correct data-slug attribute for each entry', () => {
    const html = renderRecentAppsList(twoApps);
    expect(html).toContain('data-slug="vscode"');
    expect(html).toContain('data-slug="figma"');
  });

  it('HTML-escapes app names containing special characters', () => {
    const html = renderRecentAppsList(htmlInjectionApp);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('HTML-escapes slug values in data attributes', () => {
    const apps: RecentAppEntry[] = [{ slug: '"evil"', name: 'Evil App' }];
    const html = renderRecentAppsList(apps);
    expect(html).not.toContain('data-slug=""evil""');
    expect(html).toContain('&quot;evil&quot;');
  });

  it('includes the recent-app-item class on each entry', () => {
    const html = renderRecentAppsList(twoApps);
    const matches = html.match(/class="recent-app-item"/g);
    expect(matches).toHaveLength(2);
  });
});

// ── renderNoDetection ─────────────────────────────────────────────────────

describe('renderNoDetection', () => {
  it('contains "No app detected"', () => {
    expect(renderNoDetection([])).toContain('No app detected');
  });

  it('renders the empty-apps state when no recent apps', () => {
    const html = renderNoDetection([]);
    expect(html).toContain(renderEmptyRecentApps());
  });

  it('renders app entries when recent apps are provided', () => {
    const html = renderNoDetection(twoApps);
    expect(html).toContain('VS Code');
    expect(html).toContain('Figma');
  });

  it('does not throw when called with an empty list', () => {
    expect(() => renderNoDetection([])).not.toThrow();
  });
});

// ── renderUnrecognizedApp ─────────────────────────────────────────────────

describe('renderUnrecognizedApp', () => {
  it('contains the process name', () => {
    const html = renderUnrecognizedApp('SomeApp.exe', []);
    expect(html).toContain('SomeApp.exe');
  });

  it('HTML-escapes the process name', () => {
    const html = renderUnrecognizedApp('<bad>', []);
    expect(html).not.toContain('<bad>');
    expect(html).toContain('&lt;bad&gt;');
  });

  it('renders recent apps when provided', () => {
    const html = renderUnrecognizedApp('Unknown.exe', twoApps);
    expect(html).toContain('VS Code');
    expect(html).toContain('data-slug="vscode"');
  });

  it('renders empty state when no recent apps', () => {
    const html = renderUnrecognizedApp('Unknown.exe', []);
    expect(html).toContain(renderEmptyRecentApps());
  });
});

// ── renderNoShortcuts ─────────────────────────────────────────────────────

describe('renderNoShortcuts', () => {
  it('contains the app name', () => {
    const html = renderNoShortcuts('Affinity Designer', []);
    expect(html).toContain('Affinity Designer');
  });

  it('HTML-escapes the app name', () => {
    const html = renderNoShortcuts('<App&More>', []);
    expect(html).not.toContain('<App&More>');
    expect(html).toContain('&lt;App&amp;More&gt;');
  });

  it('renders recent apps when provided', () => {
    const html = renderNoShortcuts('Affinity Designer', twoApps);
    expect(html).toContain('Figma');
    expect(html).toContain('data-slug="figma"');
  });

  it('renders empty state when no recent apps', () => {
    const html = renderNoShortcuts('Affinity Designer', []);
    expect(html).toContain(renderEmptyRecentApps());
  });
});

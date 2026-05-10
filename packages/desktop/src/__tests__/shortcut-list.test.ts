import { describe, it, expect } from 'vitest';
import type { ShortcutEntry, AppDetail } from '@kcc/core';
import {
  renderShortcutRow,
  renderContextGroup,
  renderShortcutList,
} from '../renderer/shortcut-list';

// ── Fixtures ──────────────────────────────────────────────────────────────

const macBinding = { platformSlug: 'macos', keyCombo: 'Cmd+Shift+P', steps: [] };
const winBinding = { platformSlug: 'windows', keyCombo: 'Ctrl+Shift+P', steps: [] };

const shortcutBothPlatforms: ShortcutEntry = {
  id: '1',
  command: 'Command Palette',
  platforms: [macBinding, winBinding],
};

const shortcutMacOnly: ShortcutEntry = {
  id: '2',
  command: 'Mac-only shortcut',
  platforms: [macBinding],
};

const shortcutNoPlatforms: ShortcutEntry = {
  id: '3',
  command: 'Unbound shortcut',
  platforms: [],
};

// ── renderShortcutRow ─────────────────────────────────────────────────────

describe('renderShortcutRow', () => {
  it('renders the command description text', () => {
    const html = renderShortcutRow(shortcutBothPlatforms, 'macos');
    expect(html).toContain('Command Palette');
  });

  it('picks the correct platform binding (macos)', () => {
    const html = renderShortcutRow(shortcutBothPlatforms, 'macos');
    expect(html).toContain('Cmd');
    expect(html).not.toContain('Ctrl');
  });

  it('picks the correct platform binding (windows)', () => {
    const html = renderShortcutRow(shortcutBothPlatforms, 'windows');
    expect(html).toContain('Ctrl');
    expect(html).not.toContain('Cmd');
  });

  it('falls back to first available binding when requested platform is missing', () => {
    // Only mac binding available; requesting windows → falls back to mac.
    const html = renderShortcutRow(shortcutMacOnly, 'windows');
    expect(html).toContain('Cmd');
  });

  it('renders empty combo column when no platforms available', () => {
    const html = renderShortcutRow(shortcutNoPlatforms, 'macos');
    expect(html).toContain('Unbound shortcut');
    // No key cap should appear
    expect(html).not.toContain('key-cap');
  });

  it('HTML-escapes the command description', () => {
    const injected: ShortcutEntry = {
      id: '99',
      command: '<script>alert(1)</script>',
      platforms: [],
    };
    const html = renderShortcutRow(injected, 'macos');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('contains shortcut-row, shortcut-cmd, and shortcut-combo classes', () => {
    const html = renderShortcutRow(shortcutBothPlatforms, 'macos');
    expect(html).toContain('class="shortcut-row"');
    expect(html).toContain('class="shortcut-cmd"');
    expect(html).toContain('class="shortcut-combo"');
  });
});

// ── renderContextGroup ────────────────────────────────────────────────────

describe('renderContextGroup', () => {
  it('renders a <details> element', () => {
    const html = renderContextGroup('Editor', [shortcutBothPlatforms], 'macos');
    expect(html).toContain('<details');
    expect(html).toContain('</details>');
  });

  it('renders a <summary> with the context name', () => {
    const html = renderContextGroup('Editor', [shortcutBothPlatforms], 'macos');
    expect(html).toContain('<summary');
    expect(html).toContain('Editor');
  });

  it('is open by default (open attribute on <details>)', () => {
    const html = renderContextGroup('Editor', [shortcutBothPlatforms], 'macos');
    expect(html).toContain('<details class="context-group" open>');
  });

  it('contains the shortcut rows inside the group', () => {
    const html = renderContextGroup('Editor', [shortcutBothPlatforms], 'macos');
    expect(html).toContain('Command Palette');
  });

  it('HTML-escapes the context name', () => {
    const html = renderContextGroup('<b>Bold</b>', [], 'macos');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('renders multiple shortcuts in one group', () => {
    const html = renderContextGroup(
      'Global',
      [shortcutBothPlatforms, shortcutMacOnly],
      'macos',
    );
    expect(html).toContain('Command Palette');
    expect(html).toContain('Mac-only shortcut');
  });
});

// ── renderShortcutList ────────────────────────────────────────────────────

describe('renderShortcutList', () => {
  it('returns empty string when contexts is empty', () => {
    const appDetail: AppDetail = {
      id: 'app1',
      name: 'VS Code',
      slug: 'vscode',
      description: null,
      categorySlug: 'developer-tools',
      contexts: {},
    };
    expect(renderShortcutList(appDetail, 'macos')).toBe('');
  });

  it('renders all context groups', () => {
    const appDetail: AppDetail = {
      id: 'app1',
      name: 'VS Code',
      slug: 'vscode',
      description: null,
      categorySlug: 'developer-tools',
      contexts: {
        Global: [shortcutBothPlatforms],
        Editor: [shortcutMacOnly],
      },
    };
    const html = renderShortcutList(appDetail, 'macos');
    expect(html).toContain('Global');
    expect(html).toContain('Editor');
    expect(html).toContain('Command Palette');
    expect(html).toContain('Mac-only shortcut');
  });

  it('renders two separate <details> blocks for two contexts', () => {
    const appDetail: AppDetail = {
      id: 'app1',
      name: 'VS Code',
      slug: 'vscode',
      description: null,
      categorySlug: 'developer-tools',
      contexts: {
        Global: [shortcutBothPlatforms],
        Editor: [shortcutMacOnly],
      },
    };
    const html = renderShortcutList(appDetail, 'macos');
    expect(html.match(/<details/g)?.length).toBe(2);
  });
});

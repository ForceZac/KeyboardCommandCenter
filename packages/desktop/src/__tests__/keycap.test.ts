import { describe, it, expect } from 'vitest';
import { escHtml, renderKeyCapHTML, renderKeyComboHTML } from '../renderer/keycap';

describe('escHtml', () => {
  it('escapes ampersand', () => {
    expect(escHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quote', () => {
    expect(escHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quote', () => {
    expect(escHtml("it's")).toBe("it&#39;s");
  });

  it('returns plain text unchanged', () => {
    expect(escHtml('Ctrl')).toBe('Ctrl');
  });
});

describe('renderKeyCapHTML', () => {
  it('renders a single key label', () => {
    expect(renderKeyCapHTML('P')).toBe('<kbd class="key-cap">P</kbd>');
  });

  it('renders a multi-character modifier label', () => {
    expect(renderKeyCapHTML('Ctrl')).toBe('<kbd class="key-cap">Ctrl</kbd>');
  });

  it('escapes HTML characters in the label', () => {
    // Defensive: key labels should never contain HTML, but we escape anyway.
    expect(renderKeyCapHTML('<>')).toBe('<kbd class="key-cap">&lt;&gt;</kbd>');
  });

  it('returns empty string for an empty label', () => {
    expect(renderKeyCapHTML('')).toBe('');
  });
});

describe('renderKeyComboHTML', () => {
  it('returns empty string for empty input', () => {
    expect(renderKeyComboHTML('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(renderKeyComboHTML('   ')).toBe('');
  });

  it('renders a single key', () => {
    const html = renderKeyComboHTML('P');
    expect(html).toContain('<kbd class="key-cap">P</kbd>');
    expect(html).toContain('class="key-combo"');
  });

  it('renders a multi-modifier combo (Ctrl+Shift+P)', () => {
    const html = renderKeyComboHTML('Ctrl+Shift+P');
    expect(html).toContain('<kbd class="key-cap">Ctrl</kbd>');
    expect(html).toContain('<kbd class="key-cap">Shift</kbd>');
    expect(html).toContain('<kbd class="key-cap">P</kbd>');
    // Two '+' separators between three keys
    expect(html.match(/key-sep-plus/g)?.length).toBe(2);
    // No chord arrow for a single step
    expect(html).not.toContain('key-sep-chord');
  });

  it('renders a chord sequence (Ctrl+K → Ctrl+C)', () => {
    const html = renderKeyComboHTML('Ctrl+K → Ctrl+C');
    expect(html).toContain('<kbd class="key-cap">Ctrl</kbd>');
    expect(html).toContain('<kbd class="key-cap">K</kbd>');
    expect(html).toContain('<kbd class="key-cap">C</kbd>');
    // One chord arrow separator between the two steps
    expect(html.match(/key-sep-chord/g)?.length).toBe(1);
  });

  it('renders a three-step chord with correct separator count', () => {
    const html = renderKeyComboHTML('A → B → C');
    expect(html.match(/key-sep-chord/g)?.length).toBe(2);
  });
});

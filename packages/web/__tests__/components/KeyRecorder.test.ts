/**
 * Unit tests for the normalizeKeyCombo pure function exported by KeyRecorder.
 *
 * These run in Vitest without a DOM — no browser, no KeyboardEvent construction.
 * The function accepts raw values extracted from a KeyboardEvent so it's
 * fully testable here.
 */

import { describe, it, expect } from 'vitest';
import { normalizeKeyCombo } from '../../components/KeyRecorder';

describe('normalizeKeyCombo', () => {
  // ── Modifier-only key presses (should return null) ─────────────────────

  it('returns null for standalone Ctrl press', () => {
    expect(normalizeKeyCombo('Control', true, false, false, false)).toBeNull();
  });

  it('returns null for standalone Shift press', () => {
    expect(normalizeKeyCombo('Shift', false, false, false, true)).toBeNull();
  });

  it('returns null for standalone Alt press', () => {
    expect(normalizeKeyCombo('Alt', false, false, true, false)).toBeNull();
  });

  it('returns null for standalone Meta press', () => {
    expect(normalizeKeyCombo('Meta', false, true, false, false)).toBeNull();
  });

  // ── Single letter combos ───────────────────────────────────────────────

  it('produces Ctrl+S for Ctrl+s on Windows', () => {
    const result = normalizeKeyCombo('s', true, false, false, false, false);
    expect(result).not.toBeNull();
    expect(result!.combo).toBe('Ctrl+S');
    expect(result!.key).toBe('s');
    expect(result!.modifiers).toEqual(['Ctrl']);
  });

  it('produces Ctrl+Shift+P for Ctrl+Shift+p on Windows', () => {
    const result = normalizeKeyCombo('p', true, false, false, true, false);
    expect(result).not.toBeNull();
    expect(result!.combo).toBe('Ctrl+Shift+P');
    expect(result!.modifiers).toEqual(['Ctrl', 'Shift']);
  });

  // ── macOS — Meta maps to Cmd ───────────────────────────────────────────

  it('produces Cmd+S when Meta is held on macOS', () => {
    const result = normalizeKeyCombo('s', false, true, false, false, true);
    expect(result!.combo).toBe('Cmd+S');
    expect(result!.modifiers).toEqual(['Cmd']);
  });

  it('produces Option+F when Alt is held on macOS', () => {
    const result = normalizeKeyCombo('f', false, false, true, false, true);
    expect(result!.combo).toBe('Option+F');
    expect(result!.modifiers).toEqual(['Option']);
  });

  it('produces Cmd+Option+V on macOS', () => {
    const result = normalizeKeyCombo('v', false, true, true, false, true);
    expect(result!.combo).toBe('Cmd+Option+V');
    expect(result!.modifiers).toContain('Cmd');
    expect(result!.modifiers).toContain('Option');
  });

  // ── Windows — Meta maps to Win ────────────────────────────────────────

  it('produces Win+D when Meta is held on Windows', () => {
    const result = normalizeKeyCombo('d', false, true, false, false, false);
    expect(result!.combo).toBe('Win+D');
    expect(result!.modifiers).toEqual(['Win']);
  });

  it('produces Alt+F4 on Windows', () => {
    const result = normalizeKeyCombo('F4', false, false, true, false, false);
    expect(result!.combo).toBe('Alt+F4');
    expect(result!.modifiers).toEqual(['Alt']);
  });

  // ── Special key names ─────────────────────────────────────────────────

  it('maps Space key to "Space"', () => {
    const result = normalizeKeyCombo(' ', true, false, false, false);
    expect(result!.combo).toBe('Ctrl+Space');
  });

  it('maps Escape key to "Esc"', () => {
    const result = normalizeKeyCombo('Escape', false, false, false, false);
    expect(result!.combo).toBe('Esc');
  });

  it('maps Enter to "Enter"', () => {
    const result = normalizeKeyCombo('Enter', true, false, false, false);
    expect(result!.combo).toBe('Ctrl+Enter');
  });

  it('maps ArrowUp to "Up"', () => {
    const result = normalizeKeyCombo('ArrowUp', false, false, false, false);
    expect(result!.combo).toBe('Up');
  });

  it('maps Delete to "Del"', () => {
    const result = normalizeKeyCombo('Delete', false, false, false, false);
    expect(result!.combo).toBe('Del');
  });

  // ── Function keys ─────────────────────────────────────────────────────

  it('passes through F-keys unchanged', () => {
    const result = normalizeKeyCombo('F5', false, false, false, false);
    expect(result!.combo).toBe('F5');
  });

  it('handles Ctrl+F12', () => {
    const result = normalizeKeyCombo('F12', true, false, false, false);
    expect(result!.combo).toBe('Ctrl+F12');
  });

  // ── No modifiers ──────────────────────────────────────────────────────

  it('returns single key when no modifiers are held', () => {
    const result = normalizeKeyCombo('a', false, false, false, false);
    expect(result!.combo).toBe('A');
    expect(result!.modifiers).toEqual([]);
  });
});

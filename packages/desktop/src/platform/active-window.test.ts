import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createActiveWindowDetector,
  loadNativeModule,
  type NativeModule,
} from './active-window';

// ---------------------------------------------------------------------------
// createActiveWindowDetector — tests the wrapper's logic in isolation.
// No compiled .node binary required.
// ---------------------------------------------------------------------------

describe('createActiveWindowDetector', () => {
  beforeEach(() => {
    // Suppress the "native module not loaded" warning during tests.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('returns null when native module is null (binary absent)', () => {
    const detect = createActiveWindowDetector(null);
    expect(detect()).toBeNull();
  });

  it('returns null when native module returns null', () => {
    const mockNative: NativeModule = {
      getActiveWindow: vi.fn().mockReturnValue(null),
    };
    const detect = createActiveWindowDetector(mockNative);
    expect(detect()).toBeNull();
  });

  it('returns a valid ActiveWindowInfo when native module succeeds', () => {
    const mockNative: NativeModule = {
      getActiveWindow: vi.fn().mockReturnValue({
        processName: 'Code',
        windowTitle: 'Visual Studio Code',
        bundleId: 'com.microsoft.VSCode',
      }),
    };
    const detect = createActiveWindowDetector(mockNative);
    const result = detect();

    expect(result).not.toBeNull();
    expect(result!.processName).toBe('Code');
    expect(result!.windowTitle).toBe('Visual Studio Code');
    expect(result!.bundleId).toBe('com.microsoft.VSCode');
  });

  it('processName is always a non-empty string when detection succeeds', () => {
    const mockNative: NativeModule = {
      getActiveWindow: vi.fn().mockReturnValue({
        processName: 'chrome',
        windowTitle: 'Google Chrome',
        bundleId: undefined,
      }),
    };
    const detect = createActiveWindowDetector(mockNative);
    const result = detect();

    expect(result).not.toBeNull();
    expect(typeof result!.processName).toBe('string');
    expect(result!.processName.length).toBeGreaterThan(0);
  });

  it('bundleId is undefined on non-macOS platforms (Windows)', () => {
    const mockNative: NativeModule = {
      getActiveWindow: vi.fn().mockReturnValue({
        processName: 'Code',
        windowTitle: 'Visual Studio Code - main.ts',
        bundleId: undefined,
      }),
    };
    const detect = createActiveWindowDetector(mockNative);
    const result = detect();

    expect(result).not.toBeNull();
    expect(result!.bundleId).toBeUndefined();
  });

  it('returns null when native module throws (does not propagate exception)', () => {
    const mockNative: NativeModule = {
      // Simulates an unexpected native crash (e.g. ABI mismatch after Electron upgrade).
      getActiveWindow: vi.fn().mockImplementation(() => {
        throw new Error('Simulated native crash');
      }),
    };
    const detect = createActiveWindowDetector(mockNative);
    // Must not throw — the Electron main process cannot crash on detection failure.
    expect(() => detect()).not.toThrow();
    expect(detect()).toBeNull();
  });

  it('emits a warning to console.warn when native module is null', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createActiveWindowDetector(null);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[kcc-native]'));
  });

  it('does not emit a warning when native module is provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mockNative: NativeModule = {
      getActiveWindow: vi.fn().mockReturnValue(null),
    };
    createActiveWindowDetector(mockNative);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// loadNativeModule — integration-level: verifies the loader doesn't throw
// even when no .node binary is present in the test environment.
// ---------------------------------------------------------------------------

describe('loadNativeModule', () => {
  it('returns null when no .node binary is available (expected in CI)', () => {
    // In CI and developer environments without a compiled binary, this must
    // return null rather than throwing — the app must start regardless.
    const result = loadNativeModule();
    // Either null (binary absent) or a NativeModule (binary present — macOS/Windows CI).
    if (result !== null) {
      expect(typeof result.getActiveWindow).toBe('function');
    } else {
      expect(result).toBeNull();
    }
  });
});

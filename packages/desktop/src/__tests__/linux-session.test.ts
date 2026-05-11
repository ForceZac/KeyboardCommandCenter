import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// linux-session.ts caches its result at module load time, so we need to
// reset the module registry between tests to re-run the detect() function
// with different env var configurations.
// ---------------------------------------------------------------------------

// Preserve the original env so we can restore it after each test.
const originalEnv = { ...process.env };

beforeEach(() => {
  // Wipe all three env vars before each test so tests are isolated.
  delete process.env['WAYLAND_DISPLAY'];
  delete process.env['XDG_SESSION_TYPE'];
  delete process.env['DISPLAY'];
  // Reset module so the cached _session value is re-computed.
  vi.resetModules();
});

afterEach(() => {
  // Restore original environment.
  process.env['WAYLAND_DISPLAY'] = originalEnv['WAYLAND_DISPLAY'];
  process.env['XDG_SESSION_TYPE'] = originalEnv['XDG_SESSION_TYPE'];
  process.env['DISPLAY'] = originalEnv['DISPLAY'];
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// detectLinuxSession
// ---------------------------------------------------------------------------

describe('detectLinuxSession', () => {
  it('returns "wayland" when WAYLAND_DISPLAY is set', async () => {
    process.env['WAYLAND_DISPLAY'] = '/run/user/1000/wayland-0';
    const { detectLinuxSession } = await import('../platform/linux-session');
    expect(detectLinuxSession()).toBe('wayland');
  });

  it('returns "wayland" when XDG_SESSION_TYPE is "wayland"', async () => {
    process.env['XDG_SESSION_TYPE'] = 'wayland';
    const { detectLinuxSession } = await import('../platform/linux-session');
    expect(detectLinuxSession()).toBe('wayland');
  });

  it('returns "wayland" when XDG_SESSION_TYPE is "WAYLAND" (case-insensitive)', async () => {
    process.env['XDG_SESSION_TYPE'] = 'WAYLAND';
    const { detectLinuxSession } = await import('../platform/linux-session');
    expect(detectLinuxSession()).toBe('wayland');
  });

  it('returns "x11" when XDG_SESSION_TYPE is "x11"', async () => {
    process.env['XDG_SESSION_TYPE'] = 'x11';
    const { detectLinuxSession } = await import('../platform/linux-session');
    expect(detectLinuxSession()).toBe('x11');
  });

  it('returns "x11" when XDG_SESSION_TYPE is "X11" (case-insensitive)', async () => {
    process.env['XDG_SESSION_TYPE'] = 'X11';
    const { detectLinuxSession } = await import('../platform/linux-session');
    expect(detectLinuxSession()).toBe('x11');
  });

  it('returns "x11" when only DISPLAY is set (no WAYLAND_DISPLAY, no XDG_SESSION_TYPE)', async () => {
    process.env['DISPLAY'] = ':0';
    const { detectLinuxSession } = await import('../platform/linux-session');
    expect(detectLinuxSession()).toBe('x11');
  });

  it('returns "unknown" when no env vars are set', async () => {
    const { detectLinuxSession } = await import('../platform/linux-session');
    expect(detectLinuxSession()).toBe('unknown');
  });

  it('WAYLAND_DISPLAY takes precedence over XDG_SESSION_TYPE=x11', async () => {
    process.env['WAYLAND_DISPLAY'] = '/run/user/1000/wayland-0';
    process.env['XDG_SESSION_TYPE'] = 'x11';
    const { detectLinuxSession } = await import('../platform/linux-session');
    expect(detectLinuxSession()).toBe('wayland');
  });

  it('WAYLAND_DISPLAY takes precedence over DISPLAY', async () => {
    process.env['WAYLAND_DISPLAY'] = '/run/user/1000/wayland-0';
    process.env['DISPLAY'] = ':0';
    const { detectLinuxSession } = await import('../platform/linux-session');
    expect(detectLinuxSession()).toBe('wayland');
  });

  it('result is stable across multiple calls (cached)', async () => {
    process.env['WAYLAND_DISPLAY'] = '/run/user/1000/wayland-0';
    const { detectLinuxSession } = await import('../platform/linux-session');
    const first = detectLinuxSession();
    // Mutate env — the cached result should not change.
    delete process.env['WAYLAND_DISPLAY'];
    const second = detectLinuxSession();
    expect(first).toBe('wayland');
    expect(second).toBe('wayland');
  });
});

// ---------------------------------------------------------------------------
// isWaylandSession
// ---------------------------------------------------------------------------

describe('isWaylandSession', () => {
  it('returns true when WAYLAND_DISPLAY is set', async () => {
    process.env['WAYLAND_DISPLAY'] = '/run/user/1000/wayland-0';
    const { isWaylandSession } = await import('../platform/linux-session');
    expect(isWaylandSession()).toBe(true);
  });

  it('returns false when session is x11', async () => {
    process.env['XDG_SESSION_TYPE'] = 'x11';
    const { isWaylandSession } = await import('../platform/linux-session');
    expect(isWaylandSession()).toBe(false);
  });

  it('returns false when session is unknown', async () => {
    const { isWaylandSession } = await import('../platform/linux-session');
    expect(isWaylandSession()).toBe(false);
  });

  it('returns false when only DISPLAY is set', async () => {
    process.env['DISPLAY'] = ':0';
    const { isWaylandSession } = await import('../platform/linux-session');
    expect(isWaylandSession()).toBe(false);
  });
});

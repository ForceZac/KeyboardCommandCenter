// Detect the current Linux session type (X11 vs Wayland).
//
// Result is cached at module load time — the session type is stable for the
// process lifetime. All callers share one detection so env var reads happen
// exactly once.

export type LinuxSession = 'x11' | 'wayland' | 'unknown';

function detect(): LinuxSession {
  // WAYLAND_DISPLAY is set by all Wayland compositors (Mutter, KWin, Sway, etc.)
  if (process.env['WAYLAND_DISPLAY']) return 'wayland';

  // XDG_SESSION_TYPE is set by the login manager (GDM, LightDM, SDDM, etc.)
  const sessionType = (process.env['XDG_SESSION_TYPE'] ?? '').toLowerCase();
  if (sessionType === 'wayland') return 'wayland';
  if (sessionType === 'x11') return 'x11';

  // DISPLAY is set by X11 servers — if present and nothing above matched, assume X11.
  if (process.env['DISPLAY']) return 'x11';

  return 'unknown';
}

// Cached result — stable for the process lifetime.
const _session: LinuxSession = detect();

export function detectLinuxSession(): LinuxSession {
  return _session;
}

/** Returns true only when definitely running under a Wayland compositor. */
export function isWaylandSession(): boolean {
  return _session === 'wayland';
}

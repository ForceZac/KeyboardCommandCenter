// TASK-0023: Core auth coordination module.
// Owns deep-link callback handling, token payload parsing, and internal auth events.
// main.ts wires up event listeners and delegates to this module — auth logic stays
// out of main.ts, consistent with how tray.ts, hotkey.ts, etc. own their domains.
import { shell } from 'electron';
import { URL } from 'url';
import { EventEmitter } from 'events';
import type { AuthStore } from './auth-store';

export interface AuthState {
  isAuthenticated: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthSignedInPayload {
  displayName: string | null;
  avatarUrl: string | null;
}

// Internal event bus. main.ts subscribes to propagate state changes to windows.
export const authEvents = new EventEmitter();

// Initialized via initAuth() in app.whenReady() when safeStorage is available.
let authStore: AuthStore | null = null;

export function initAuth(store: AuthStore): void {
  authStore = store;
}

/**
 * Decodes the base64url middle segment of a JWT to extract display fields.
 * No signature verification — used only for display purposes. The token was
 * just issued by the trusted web app and arrives in a deep link from the user's
 * own browser; if it's forged or expired, subsequent API calls will fail with 401.
 * Handles missing or malformed fields gracefully.
 */
export function parseTokenPayload(
  token: string,
): { name: string | null; picture: string | null } {
  try {
    const segments = token.split('.');
    if (segments.length < 2) return { name: null, picture: null };
    const payload = JSON.parse(
      Buffer.from(segments[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    return {
      name: typeof payload['name'] === 'string' ? payload['name'] : null,
      picture: typeof payload['picture'] === 'string' ? payload['picture'] : null,
    };
  } catch {
    return { name: null, picture: null };
  }
}

/**
 * Handles the deep-link callback from the browser after OAuth completes.
 * Expected URL format: shortcutvault://auth/callback?token=<jwt>
 *
 * Called by main.ts from both the macOS `open-url` event and the Windows
 * `second-instance` argv handler.
 */
export function handleDeepLinkCallback(url: string): void {
  if (!authStore) {
    console.warn('[auth] Deep-link received before auth was initialized — ignoring');
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.error('[auth] Invalid deep-link URL:', url);
    return;
  }

  // Guard: only handle our protocol and the expected path.
  if (parsed.protocol !== 'shortcutvault:') return;
  if (parsed.hostname !== 'auth' || parsed.pathname !== '/callback') return;

  const token = parsed.searchParams.get('token');
  if (!token) {
    console.error('[auth] Deep-link callback missing token parameter');
    return;
  }

  authStore.setToken(token);
  const { name, picture } = parseTokenPayload(token);
  const payload: AuthSignedInPayload = { displayName: name, avatarUrl: picture };
  authEvents.emit('auth:signed-in', payload);
}

/**
 * Opens the web app sign-in page in the user's default browser.
 * Using shell.openExternal so the user's existing browser sessions (Google/GitHub)
 * are available — Electron's Chromium does not share OS-level auth sessions.
 */
export function openSignIn(signInUrl: string): void {
  void shell.openExternal(signInUrl);
}

/**
 * Signs out: clears the stored token and emits auth:signed-out.
 */
export function signOut(): void {
  authStore?.clearToken();
  authEvents.emit('auth:signed-out');
}

/**
 * Returns the current auth state for IPC consumers (e.g. auth:get-state handler).
 */
export function getAuthState(): AuthState {
  if (!authStore) return { isAuthenticated: false, displayName: null, avatarUrl: null };
  const token = authStore.getToken();
  if (!token) return { isAuthenticated: false, displayName: null, avatarUrl: null };
  const { name, picture } = parseTokenPayload(token);
  return { isAuthenticated: true, displayName: name, avatarUrl: picture };
}

# Plan: TASK-0023 — Desktop Auth Flow — Browser OAuth & Deep Link Callback

**Branch:** goals/23-desktop-auth-flow
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**TRD:** research/plans/goals/23-desktop-auth-flow-trd.md

---

## Objective

Enable the desktop app to authenticate users via the web app's OAuth flow. The user clicks "Sign in" in the tray or settings window, the default browser opens to the web app's sign-in page, OAuth completes, and the browser deep-links back into the Electron app via `shortcutvault://auth/callback?token=...`. The Electron main process receives the deep link, validates and stores the session token securely via `safeStorage` + `electron-store`, and updates the tray menu and settings window to reflect the authenticated state.

**NOT done here:**
- Favorites sync engine or local favorites cache (TASK-0025)
- Favorites UI in the desktop panel (TASK-0026)
- Web app auth changes — TASK-0021 owns those
- Desktop-only account creation (users must use browser OAuth)
- Windows code-signing / protocol registration via installer (deferred to Goal 9)

---

## Work breakdown

### Phase 1 — Protocol registration & deep link plumbing
1. In `packages/desktop/src/main.ts`: call `app.setAsDefaultProtocolClient('shortcutvault')` before `app.whenReady()` (macOS) or in the `ready` handler (Windows)
2. Add `open-url` listener for macOS deep link reception (fires in the existing `app` instance)
3. Add `second-instance` listener for Windows: parse the new-instance argv for a `shortcutvault://` URL and route it to the callback handler
4. Add callback handler `handleDeepLinkCallback(url: string)` in a new `src/auth.ts` module — extracts the `token` query param, validates it is non-empty, then delegates to token storage

### Phase 2 — Token storage (electron-store + safeStorage)
5. Extend `SettingsStore` in `src/settings.ts` to add an `authToken: string | null` field (encrypted at rest via `safeStorage` before writing; decrypted on read) — or create a dedicated `AuthStore` if keeping settings and auth state separate is cleaner (decision: separate `AuthStore` in `src/auth-store.ts` for single responsibility)
6. `AuthStore` exposes: `getToken()`, `setToken(encrypted: string)`, `clearToken()`, `isAuthenticated(): boolean`
7. On `handleDeepLinkCallback`: validate token non-empty, encrypt via `safeStorage.encryptString()`, store via `AuthStore.setToken()`, emit `auth:signed-in` event to update tray + settings window

### Phase 3 — Tray menu updates
8. Modify `TrayManager` in `src/tray.ts`: add "Sign in" menu item (when unauthenticated) and "Sign out" menu item (when authenticated)
9. "Sign in" handler: `shell.openExternal(<web-app-url>/auth/signin?callbackUrl=shortcutvault://auth/callback)`
10. "Sign out" handler: calls `AuthStore.clearToken()`, refreshes tray menu, sends `auth:signed-out` to settings window
11. `TrayManager` gains a `refreshMenu(isAuthenticated: boolean)` method so both tray and settings window can trigger menu rebuilds

### Phase 4 — Settings window auth UI
12. Extend `src/settings-preload.ts` to expose `auth` namespace: `getAuthState()`, `signIn()`, `signOut()`
13. Extend `src/renderer/settings.ts` and `settings.html` to add an auth section: avatar + display name when signed in, "Sign in" button when not. Avatar can be user initials (derived from token payload or a separate `/api/me` call)
14. Add IPC handler `auth:get-state` in `src/main.ts` — returns `{ isAuthenticated, displayName, avatarUrl }` from the stored token
15. Settings renderer receives `auth:signed-in` / `auth:signed-out` IPC pushes and updates the UI without a full reload

### Phase 5 — Token parsing & /api/me
16. Parse the JWT from the stored token to extract `name` and `picture` fields for the settings window display (no server round-trip needed for display — the JWT payload has these)
17. Utility function `parseTokenPayload(token: string): { name: string | null, picture: string | null }` in `src/auth.ts` — decodes base64 middle segment only, no signature verification needed for display purposes (the token was issued by the trusted web app just moments ago)

### Phase 6 — Tests
18. TypeScript typecheck on `packages/desktop` — primary automated gate (Electron cannot run in test Docker)
19. Manual smoke-test checklist in PR description covers all acceptance criteria

---

## Build order rationale

Protocol registration first — everything depends on deep links being received. Token storage before tray changes — tray "Sign in" handler needs a place to store what comes back. Tray updates after storage — tray reads from `AuthStore`. Settings window last — it reads from both `AuthStore` and IPC events that the tray/main already emit. Tests confirm the TypeScript contract is sound.

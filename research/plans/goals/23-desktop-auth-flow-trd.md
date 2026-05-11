# TRD: Desktop Auth Flow — Browser OAuth & Deep Link Callback

**Task:** TASK-0023
**Branch:** goals/23-desktop-auth-flow
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**Date:** 2026-05-10

---

## What we're building

TASK-0023 closes the desktop authentication loop defined in PRD Flow 2. The web app (TASK-0021) handles OAuth account creation and issues a session token; this task teaches the Electron main process to (1) register the `shortcutvault://` custom protocol so the OS routes deep links back to the desktop app, (2) receive the `shortcutvault://auth/callback?token=...` deep link after browser OAuth completes, (3) encrypt and persist the session token via `safeStorage` + `electron-store`, and (4) reflect authenticated state in the system tray menu and settings window. No web app changes are needed. This task produces the infrastructure that TASK-0025 (sync engine) and TASK-0026 (panel favorites UI) depend on to know whether the user is signed in.

---

## Technical components needed

**New main-process modules:**

- `packages/desktop/src/auth.ts` — Core auth coordination module. Owns the deep-link callback handler (`handleDeepLinkCallback(url: string)`), token payload parsing (`parseTokenPayload`), and emits internal events (`auth:signed-in`, `auth:signed-out`) that propagate to the tray and settings window. Keeps auth logic out of `main.ts`.
- `packages/desktop/src/auth-store.ts` — `AuthStore` class wrapping `electron-store` for auth-specific state. Stores the session token encrypted at rest via `safeStorage.encryptString()` / `safeStorage.decryptString()`. Exposes `getToken()`, `setToken(plain: string)`, `clearToken()`, `isAuthenticated()`. Separate from `SettingsStore` (settings.ts) per single-responsibility principle — auth lifecycle and user preferences are independent concerns.

**Modified main-process modules:**

- `packages/desktop/src/main.ts` — Two additions:
  - Call `app.setAsDefaultProtocolClient('shortcutvault')` in the app setup block (before `whenReady`). Add `open-url` (macOS) and `second-instance` (Windows) listeners that both route to `handleDeepLinkCallback` in `auth.ts`.
  - Add IPC handler `auth:get-state` → returns `{ isAuthenticated: boolean, displayName: string | null, avatarUrl: string | null }` by reading `AuthStore` + parsing the stored token payload.
- `packages/desktop/src/tray.ts` — `TrayManager` gains `refreshMenu(isAuthenticated: boolean)` to rebuild the context menu at runtime. Menu shows "Sign in" (opens browser to OAuth page) when `!isAuthenticated`, "Sign out" (clears token + refreshes) when `isAuthenticated`. Tray subscribes to the `auth:signed-in` / `auth:signed-out` events emitted by `auth.ts`.
- `packages/desktop/src/settings-preload.ts` — Extends the existing `kccSettings` `contextBridge` surface with an `auth` sub-object: `getAuthState()` (IPC call to `auth:get-state`), `signIn()` (IPC call to open browser), `signOut()` (IPC call to clear token). Existing `getSettings`, `setHotkey`, `setLoginStartup` are unchanged.
- `packages/desktop/src/renderer/settings.ts` — Adds an auth section to the settings UI: renders the signed-in block (avatar initials + display name + "Sign out" button) or the signed-out block ("Sign in" button) based on `getAuthState()`. Listens for `auth:signed-in` / `auth:signed-out` IPC pushes from main (sent via `webContents.send`) to update the UI without a full reload.
- `packages/desktop/src/renderer/settings.html` — Adds an "Account" section with DOM targets for the auth section (signed-in/signed-out states).

**Schema changes:**

No database schema changes. `AuthStore` persists to an `electron-store` JSON file on the user's filesystem (platform-standard location: `~/Library/Application Support/<AppName>/` on macOS, `%APPDATA%/<AppName>/` on Windows). The session token value is encrypted via `safeStorage` before write — the JSON file contains a base64-encoded ciphertext, never a plain-text token.

**API changes:**

No new HTTP API endpoints. The only web-app call this task makes is opening `<NEXTAUTH_URL>/auth/signin?callbackUrl=shortcutvault://auth/callback` via `shell.openExternal()` — a browser navigation, not an Electron fetch.

New IPC channels (additions to existing main ↔ renderer surface):
- `auth:get-state` (renderer → main) → `{ isAuthenticated, displayName, avatarUrl }`
- `auth:open-signin` (renderer → main) → `void` — triggers `shell.openExternal(...)` to open browser
- `auth:sign-out` (renderer → main) → `void` — clears token, emits `auth:signed-out`
- `auth:signed-in` (main → settings-renderer push) — carries `{ displayName, avatarUrl }`
- `auth:signed-out` (main → settings-renderer push) — no payload

---

## Key architectural decisions

- **`safeStorage` encryption in `AuthStore`, not in the deep-link handler** — Token encryption is an `AuthStore` concern, not the callback handler's. The callback handler passes the plain token to `AuthStore.setToken()`, which encrypts before writing. This keeps encryption/decryption co-located with storage and prevents the plain token from persisting in any intermediate variable across module boundaries.

- **`auth.ts` module for coordination, not `main.ts`** — Auth logic (deep link parsing, token validation, event emission) goes in a dedicated `auth.ts` module. `main.ts` only wires up listeners and delegates. This is consistent with how `tray.ts`, `hotkey.ts`, and `settings.ts` each own their domain. `main.ts` stays thin.

- **`AuthStore` separate from `SettingsStore`** — Settings (`hotkey`, `loginStartup`) and auth (`token`) have independent lifecycles. A user can sign out without resetting their hotkey. Mixing them in one store class would require the store to know about `safeStorage`, coupling settings persistence to auth infrastructure. Separate classes each use `electron-store` with their own key namespace.

- **Token payload decoded locally for display, not via /api/me** — The session token received from the deep link is a NextAuth JWT. Decoding the base64 payload segment gives `name` and `picture` without a network round-trip. Signature verification is unnecessary for display-only purposes — the token was just issued by the trusted web app and arrives in a deep link from the user's own browser. If the token is forged or expired, subsequent API calls (in TASK-0025) will fail with 401 and the sync engine will sign out.

- **macOS `open-url` vs Windows `second-instance`** — On macOS, the OS delivers deep links to the already-running app instance via the `open-url` `app` event. On Windows, the OS launches a new instance with the URL in argv; `app.requestSingleInstanceLock()` (already in place from TASK-0006) routes it to the existing instance via `second-instance`. Both paths call the same `handleDeepLinkCallback` function in `auth.ts`.

- **`shell.openExternal` for OAuth launch** — The desktop app never loads the web app's OAuth page in an Electron `BrowserWindow`. Electron's Chromium runtime does not have the OS-level OAuth sessions the user's browser has (saved passwords, existing Google/GitHub sessions). Using `shell.openExternal` delegates to the user's default browser where they are already signed in, making the OAuth flow frictionless.

- **Tray menu rebuilt on auth state change** — Electron context menus are immutable once set; you must call `setContextMenu` again with a new `Menu` object to update them. `TrayManager.refreshMenu(isAuthenticated)` builds a fresh `Menu` and calls `tray.setContextMenu(menu)`. This is the standard Electron pattern for dynamic tray menus.

---

## Test coverage plan

- **TypeScript typecheck** (`npm run typecheck` on `packages/desktop`): primary automated gate. All new and modified modules must typecheck cleanly under strict mode. Electron main-process code cannot meaningfully unit-tested without a running Electron environment — typecheck is the practical CI-level contract check.

- **Manual smoke-test checklist** (documented in PR description, all acceptance criteria covered):
  - Protocol registered: open `shortcutvault://test` in Terminal (macOS) / Run dialog (Windows) — app receives event
  - Tray "Sign in" → browser opens to web app OAuth page
  - Deep link callback → token stored (verify `AuthStore.isAuthenticated()` returns true after a simulated callback in dev mode)
  - Settings window shows signed-in state (avatar initials + display name)
  - "Sign out" → token cleared, tray reverts to "Sign in", settings window shows signed-out state
  - Regression: panel, overlay, hotkey, tray "Open" all continue to work after auth changes

- **No Playwright E2E for this task** — Playwright Electron requires a display server and packaging. The auth callback itself cannot be meaningfully exercised in CI without a live browser session. Manual verification against the acceptance criteria is the appropriate gate here, consistent with TASK-0007 precedent.

---

## Out of scope (technical)

- Favorites sync engine or local cache (TASK-0025)
- Favorites panel UI (TASK-0026)
- Web app auth changes — TASK-0021 owns those; this task makes zero changes to `packages/web`
- Windows protocol registration via installer registry (Goal 9 / packaging) — for development, `app.setAsDefaultProtocolClient()` handles registration via Electron's own mechanisms
- Token expiry handling and refresh — the sync engine (TASK-0025) will detect 401s and trigger re-auth; this task only handles the initial token receipt and storage
- Linux protocol registration (Goal 10)
- Guest-to-authenticated favorites migration
- Session revocation / remote sign-out

---

## Risks and open questions

- **`safeStorage` availability** — `safeStorage.isAvailable()` returns `false` on some Linux environments and CI runners. On macOS and Windows (the supported platforms for this task), it should always be available. The `AuthStore` should check `safeStorage.isAvailable()` before calling `encryptString` and log a clear error if not available rather than silently storing plain text. Mitigation: gate the storage call and surface the error.

- **Windows deep link in packaged vs dev mode** — `app.setAsDefaultProtocolClient()` in development mode registers the Electron executable itself as the protocol handler, which means any `shortcutvault://` URL will launch a new dev instance. The `second-instance` lock routes the URL to the running instance correctly. In a packaged app, the registered handler points to the app bundle. No issue expected, but the manual test must be run on Windows to confirm the argv parsing path.

- **NextAuth callback URL format** — The deep link URL received is `shortcutvault://auth/callback?token=...`. The `token` query parameter is whatever NextAuth puts there via the `callbackUrl` parameter. The exact shape of the JWT (which fields are in the payload for `name` and `picture`) depends on the NextAuth configuration in TASK-0021. The `parseTokenPayload` utility must handle `null` / missing fields gracefully and fall back to an initials display.

- **`electron-store` ESM/CJS compatibility** — TASK-0007 noted that `electron-store` v8+ is ESM-only; the existing desktop package uses CommonJS and pins to v7.x. `AuthStore` must use the same pinned version. No new risk beyond what TASK-0007 already resolved.

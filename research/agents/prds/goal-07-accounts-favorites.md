# PRD: Goal 07 — User Accounts & Favorites Sync

**Status:** draft
**Author:** Product Manager
**Date:** 2026-05-10
**Roadmap section:** Goal 7: User Accounts & Favorites Sync

---

## Problem statement

Users discover useful shortcuts through the web interface and desktop panel, but they have no way to save, organize, or recall the ones they care about. Every session starts from scratch — there's no persistence of which shortcuts a user found valuable, no way to build a personal reference list, and no way to carry that list between the web app and the desktop app. This is a retention problem: users who can't build a personalized shortcut library have less reason to come back.

Accounts also unlock the community features in Goal 8 (submissions, contributor credit) — without identity, there's no attribution and no moderation accountability.

## User stories

- As a user, I want to create an account using my GitHub or Google login so I can get started without creating yet another password.
- As a user, I want to mark individual shortcuts as favorites so I can build a personal quick-reference list.
- As a user, I want to organize my favorites into named collections (e.g. "Video Editing", "Daily Drivers") so I can group shortcuts by how I use them, not just by app.
- As a user, I want my favorites and collections to appear on both the web app and the desktop app so I don't have to maintain two separate lists.
- As a desktop user, I want my favorites available even when I'm offline, syncing automatically when I reconnect.

## Success metrics

- Account creation completes in under 3 clicks from any page (OAuth flow).
- Favoriting a shortcut is a single click/tap with immediate visual feedback (<100ms perceived).
- Favorites sync between web and desktop within 5 seconds of coming online.
- Desktop app serves favorites from local cache with zero network latency when offline.
- Collections CRUD operations (create, rename, delete, add/remove shortcuts) complete in <200ms on the web app.
- No data loss: if a user favorites something offline on desktop and favorites something else on web simultaneously, both favorites are preserved after sync (no silent overwrites).

## UX flows

**Flow 1: Sign up / sign in (web)**
1. User clicks "Sign in" in the top nav.
2. Modal or page shows two OAuth buttons: "Continue with GitHub" and "Continue with Google".
3. User clicks one, completes the OAuth consent screen in the provider's flow.
4. User is redirected back to the app, now signed in. Nav shows their avatar and display name.
5. If it's the user's first sign-in, an empty "My Favorites" collection is created automatically.

**Flow 2: Sign in (desktop)**
1. User clicks "Sign in" in the tray menu or settings window.
2. App opens the default browser to the web app's sign-in page with a callback parameter.
3. User completes OAuth in the browser (or is already signed in and auto-redirected).
4. Browser redirects to a deep link (e.g. `shortcutvault://auth/callback?token=...`) that the Electron app handles.
5. Desktop app receives the session token, stores it securely, and shows the user as signed in within the settings window.
6. Initial sync starts immediately — all favorites and collections are pulled to the local cache.

**Flow 3: Favoriting a shortcut (web)**
1. User is viewing an app's shortcut page (e.g. VS Code).
2. Each shortcut row has a heart/star icon on the right side.
3. User clicks the icon — it fills immediately (optimistic UI), and the shortcut is added to "My Favorites".
4. User can also click a dropdown on the icon to add the shortcut to a specific collection.
5. Clicking a filled icon removes the favorite (with confirmation if it's in multiple collections).

**Flow 4: Favoriting a shortcut (desktop panel)**
1. User opens the shortcut panel via the global hotkey.
2. Each shortcut row shows a small heart/star icon (visible on hover to keep the UI clean).
3. User clicks the icon — shortcut is favorited locally and queued for sync.
4. If the user is offline, the favorite is stored locally and synced on reconnect.

**Flow 5: Managing collections (web)**
1. User navigates to "My Collections" from the nav or profile menu.
2. Page shows all collections as cards with shortcut counts.
3. User can create a new collection (name + optional description), rename, or delete existing ones.
4. Clicking a collection shows its shortcuts, with the ability to remove individual shortcuts or reorder them.
5. A special "My Favorites" collection is always present and cannot be deleted (it's the default catch-all).

**Flow 6: Viewing favorites in the desktop panel**
1. User opens the shortcut panel.
2. A toggle or tab at the top switches between "App Shortcuts" (current app's shortcuts) and "My Favorites".
3. In favorites view, shortcuts are grouped by collection. The user can browse their saved shortcuts regardless of which app is active.
4. If offline, favorites render from the local cache — no loading spinner, no error state.

**Flow 7: Offline behavior and sync**
1. Desktop user is signed in and has favorites cached locally.
2. User loses internet connectivity (or is on a plane, etc.).
3. User can still browse and search their favorites — all data is local.
4. User favorites a new shortcut while offline — it's saved locally with a "pending sync" marker.
5. Connectivity returns. The sync engine detects the reconnection and pushes pending changes to the server.
6. Any favorites added on the web while the desktop was offline are pulled down.
7. Conflicts (same shortcut favorited/unfavorited on both sides) are resolved with a last-write-wins strategy at the individual shortcut level.

## Scope boundaries

**In scope:**
- Auth.js v5 (NextAuth v5) integration in the Next.js web app with Prisma adapter
- OAuth providers: GitHub and Google (both free, no cost to the project)
- Prisma schema additions: User, Account, Session, Collection, CollectionShortcut (join table linking users, collections, and shortcuts)
- "My Favorites" default collection auto-created on first sign-in
- Custom named collections with create, rename, delete, add/remove shortcuts
- Desktop sign-in via browser redirect + deep link callback (`shortcutvault://auth/callback`)
- Desktop local cache using electron-store for favorites and collections
- Background sync engine in the Electron main process: push local changes, pull remote changes on app start and on reconnect
- Optimistic UI for favorite/unfavorite actions on both web and desktop
- Last-write-wins conflict resolution at the individual favorite level (timestamp-based)
- API routes: `GET/POST/DELETE /api/favorites`, `GET/POST/PATCH/DELETE /api/collections`, `GET /api/collections/:id/shortcuts`
- Shared types in `packages/core` for User, Collection, Favorite

**Out of scope:**
- Email/password (credentials) provider — OAuth-only for v1 to avoid password storage, reset flows, and email verification complexity
- Social features (sharing collections publicly, following other users)
- Import/export of favorites (CSV, JSON)
- Collaborative collections (multiple users editing one collection)
- Desktop-only account creation (must use browser OAuth flow)
- Real-time sync (WebSocket push) — polling on app start + reconnect is sufficient for v1
- Shortcut usage analytics or "most favorited" leaderboards
- Profile pages or public user profiles (Goal 8 will introduce contributor profiles)
- Collection ordering/sorting beyond manual reorder

## Constraints and requirements

- **$0 budget:** GitHub and Google OAuth are free. Auth.js v5 is open source. No paid auth service.
- **Prisma adapter:** Auth.js v5 has a first-party Prisma adapter that auto-creates User, Account, Session, and VerificationToken tables. Use it rather than hand-rolling the schema.
- **Desktop auth flow:** Electron cannot run NextAuth server-side in production. The desktop app must delegate authentication to the web app via the default browser. The deep link protocol (`shortcutvault://`) must be registered in the Electron app's protocol handler. On macOS this is via `app.setAsDefaultProtocolClient()`; on Windows via registry during install.
- **Token storage:** The desktop app stores the session token in electron-store (encrypted at rest via Electron's safeStorage API). Tokens must not be stored in plain text on disk.
- **Offline-first local cache:** Favorites and collections are stored in electron-store as JSON. The desktop app reads from local cache first, never blocks on network. Sync is background-only.
- **Sync conflict resolution:** Last-write-wins at the favorite level using timestamps. This is acceptable because favorites are low-conflict (a user won't favorite and unfavorite the same shortcut on two devices simultaneously in practice). If a more sophisticated approach is needed later, it can be upgraded without schema changes.
- **Privacy:** Auth.js v5 session tokens only. No tracking of which shortcuts users view or search for. Favorites are private by default — no other user can see them.
- **Security:** `contextIsolation: true` in all Electron windows. Deep link callback must validate the token before storing it. CSRF protection on all API routes via Auth.js built-in mechanisms.
- **Performance:** Favorites API responses must be <200ms. Local cache reads must be <10ms. Sync should not block the UI thread.

## Open questions

- **Deep link protocol name:** Should the protocol be `shortcutvault://` or `kcc://` (matching the project name KeyboardCommandCenter)? **Recommendation:** `shortcutvault://` — it's the user-facing brand name and more recognizable in OS prompts.
- **Collection limits:** Should there be a max number of collections or favorites per user? **Recommendation:** Soft limit of 50 collections and 1000 favorites for v1. These are generous for the use case and prevent abuse. Enforce server-side.
- **Sync frequency:** Should the desktop app poll for remote changes periodically, or only on app start and reconnect? **Recommendation:** Sync on app start + reconnect + every 15 minutes while online. This balances freshness with server load for a solo-dev infrastructure.
- **Guest favorites:** Should unauthenticated users be able to favorite shortcuts locally (web or desktop) and then have those favorites migrate to their account on sign-up? **Recommendation:** Yes for the desktop app (local-only favorites until sign-in, then merge on first sync). No for web (would require localStorage management and migration — adds complexity for low value). Desktop users are more likely to use the app before signing in.

## Dependencies

- **Goal 2** — Web Search & Browse Interface (shipped — provides the Next.js web app, API routes, and shortcut pages where favorites UI will be added)
- **Goal 5** — Shortcut Panel UI (in review — provides the desktop panel where favorites toggle and favorite icons will be added)

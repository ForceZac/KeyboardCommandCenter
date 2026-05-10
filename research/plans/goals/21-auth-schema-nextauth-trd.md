# TRD: Auth Schema & NextAuth Integration

**Task:** TASK-0021
**Branch:** goals/21-auth-schema-nextauth
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**Date:** 2026-05-10

---

## What we're building

TASK-0021 lays the foundational auth layer for Goal 7. We are adding the Prisma schema for all user-related models (Auth.js standard tables + Favorite + Collection), configuring Auth.js v5 in the Next.js web app with three providers (Google OAuth, GitHub OAuth, email/password credentials), and wiring the sign-in UI (modal + authenticated header state) into the existing web app. We also implement the anonymous-to-authenticated favorites migration that runs on first sign-in. The result is a fully functional sign-in/sign-out experience on the web app with persistent sessions, while leaving favorites CRUD and the favorites page for TASK-0022 and TASK-0023.

This maps directly to PRD Flows 1 (OAuth account creation), 2 (email/password account creation), and the partial Flow 9 (web sign-out).

---

## Technical components needed

**New backend components:**

- `database/schema.prisma` (extended) — Auth.js standard models: `User`, `Account`, `Session`, `VerificationToken`. Domain models: `Favorite` (userId + shortcutId + createdAt, enforcing uniqueness per user per shortcut), `Collection` (userId + name), `CollectionShortcut` (junction table for the many-to-many between Collection and Shortcut). No existing tables are altered.
- `database/migrations/<timestamp>_add_auth_and_favorites_schema/` — Generated Prisma migration; adds 7 new tables without touching the 5 existing shortcut tables.
- `packages/web/lib/auth.ts` — Auth.js v5 config: `PrismaAdapter`, JWT session strategy (`strategy: "jwt"`), Google OAuth provider, GitHub OAuth provider, Credentials provider (validates email + bcrypt-hashed password from the `User` table). Exports `auth()`, `signIn()`, `signOut()`, and typed `Session` type for use across the app.
- `packages/web/app/api/auth/[...nextauth]/route.ts` — Re-exports `{ GET, POST }` from `auth.ts` handlers. This single file satisfies Auth.js v5's catch-all route requirement.

**Modified backend components:**

- `packages/web/lib/env.ts` — Add `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`. All typed and validated at startup.
- `packages/web/lib/prisma.ts` — No changes needed; already a singleton Prisma client that the Auth.js adapter will consume.

**New frontend components:**

- `packages/web/components/SignInModal.tsx` — Client component. Rendered conditionally in the header for unauthenticated users. Displays: "Continue with Google" button (calls `signIn("google")`), "Continue with GitHub" button (calls `signIn("github")`), email + password form with "Sign in" and "Create account" actions (calls `signIn("credentials", { email, password, action })`). Manages open/close state locally; no global modal manager needed.
- `packages/web/components/UserMenu.tsx` — Client component. Shown in the header for authenticated users. Displays the user's avatar (initials fallback if no image), a dropdown with "Favorites" link (`/favorites`) and "Sign out" action (calls `signOut()`). Uses `useSession()` to read user data client-side.
- `packages/web/components/Header.tsx` — New server component extracted from `layout.tsx`. Calls `auth()` server-side to get initial session state, then renders either `SignInModal` (trigger only, modal is client-controlled) or `UserMenu`. Keeps `layout.tsx` clean.
- `packages/web/hooks/useMigrateFavorites.ts` — Client hook. Runs once after first sign-in (detected via session status changing from "loading" to "authenticated" with `user.migratedAt` not set). Reads `kcc_favorites` from localStorage, POSTs each shortcutId to `/api/favorites` (no-ops gracefully if that API doesn't exist yet — TASK-0022 lands it), clears localStorage after migration completes.

**Schema changes:**

- `users` table — Auth.js User model: `id` (cuid), `name`, `email` (unique), `emailVerified`, `image`, `hashedPassword` (nullable — null for OAuth-only users), `createdAt`
- `accounts` table — Auth.js Account model: OAuth provider + account linking. Links user to Google/GitHub accounts.
- `sessions` table — Auth.js Session model: present in schema for adapter compatibility even with JWT strategy; will remain empty in practice.
- `verification_tokens` table — Auth.js VerificationToken model: used for email verification in the credentials flow.
- `favorites` table — `id`, `userId` (FK→users), `shortcutId` (FK→shortcuts), `createdAt`. Unique constraint on `(userId, shortcutId)`.
- `collections` table — `id`, `userId` (FK→users), `name`, `createdAt`. Soft limit enforcement (50 per user) is server-side logic in a future task.
- `collection_shortcuts` table — Junction: `collectionId` (FK→collections), `shortcutId` (FK→shortcuts). Unique on `(collectionId, shortcutId)`.

**API changes:**

- `GET /api/auth/*` and `POST /api/auth/*` — All handled by the Auth.js catch-all route. No manually-written endpoints needed for auth flows themselves.
- No new custom API endpoints in this task. `/api/favorites` CRUD comes in TASK-0022.

---

## Key architectural decisions

- **JWT strategy over database sessions** — Per PRD constraints, using `strategy: "jwt"` so the desktop app can validate sessions without a database lookup. Sessions are stored in encrypted cookies; the `sessions` table exists in schema for adapter compatibility but is unused in the JWT path.
- **Credentials provider with bcrypt** — Email/password sign-in uses `bcryptjs` (pure JS, no native bindings) for password hashing. Only the `User.hashedPassword` field stores hashes; plaintext passwords never touch the database.
- **`auth()` server-side, `useSession()` client-side** — Server components use `auth()` from `lib/auth.ts` for SSR-safe session access. Client components use `useSession()` from `next-auth/react`. The `Header` component is a server component that reads initial session state to avoid a client-side flash.
- **No custom session database** — Auth.js adapter writes to the Prisma-managed `accounts` and `users` tables. The `sessions` table is there for schema completeness; it won't grow.
- **Anonymous migration is fire-and-forget** — `useMigrateFavorites` runs on session establish and posts to `/api/favorites`. If TASK-0022 isn't merged yet, the POST returns 404 and the hook swallows the error. This makes TASK-0021 independently deployable without TASK-0022.
- **No `@auth/nextjs` adapter version pinning** — Using `next-auth@5` (beta). The API is stable enough for this codebase and v5 is the path for Next.js App Router. No v4 patterns (no `getServerSideSession`, no `SessionProvider` wrapping `_app.tsx`).

---

## Test coverage plan

- **E2E (Playwright):** `packages/web/e2e/auth.spec.ts`
  - Sign-in modal opens on "Sign In" click (unauthenticated state, mocked via session fixture)
  - Modal shows Google, GitHub, and email/password options
  - Authenticated header shows avatar and UserMenu (mocked session fixture)
  - Clicking "Sign out" calls signOut and returns to unauthenticated state

- **Vitest (unit/component):**
  - `SignInModal.test.tsx` — renders provider buttons, email/password form inputs, close button; calls `signIn()` with correct provider on click
  - `UserMenu.test.tsx` — renders user initials when no avatar image, shows Favorites link, calls `signOut()` on sign-out click
  - `useMigrateFavorites.test.ts` — reads localStorage favorites on first authenticated session, POSTs each, clears localStorage; no-ops when localStorage is empty

---

## Out of scope (technical)

- `/api/favorites` CRUD routes — TASK-0022
- Favorites page (`/favorites`) — TASK-0023
- Collections CRUD (create, rename, delete) — future task
- Desktop auth (authorization code exchange, electron-store token storage) — future task
- Offline favorites cache — future task
- Rate limiting on auth endpoints — future task
- Verification email sending infrastructure (Auth.js handles the flow; SMTP config is separate)
- Password reset UI beyond Auth.js defaults
- Two-factor authentication

---

## Risks and open questions

- **next-auth v5 beta stability** — v5 is in beta. The App Router integration (`auth()` server helper) is well-tested in the community but APIs could shift. Pinning to a specific beta version in `package.json` mitigates this.
- **Credentials provider and email verification** — Auth.js credentials provider does not enforce email verification by default. Users can sign in immediately after account creation. The `emailVerified` field will be null for credentials users until they click the verification link. The sign-in modal should show a "Check your email" state post-creation but the session is not blocked.
- **bcryptjs performance** — Pure-JS bcrypt is ~3x slower than native bindings on small loads. For a development-phase app with low auth volume this is acceptable. Switch to `bcrypt` with native bindings if auth becomes a bottleneck.
- **Prisma migration on existing database** — The migration adds tables and foreign keys that reference `shortcuts.id` (for `favorites.shortcutId`) and `collections.id` (for `collection_shortcuts.collectionId`). These are append-only — no existing rows or columns are touched. Risk is low but the migration must be run against a test database first and verified non-destructive before production.

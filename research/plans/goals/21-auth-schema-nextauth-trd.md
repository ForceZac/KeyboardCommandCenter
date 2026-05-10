# TRD: Auth Schema & NextAuth Integration

**Task:** TASK-0021
**Branch:** goals/21-auth-schema-nextauth
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**Date:** 2026-05-10

---

## What we're building

TASK-0021 lays the auth foundation for Goal 7. We are adding the four Auth.js standard Prisma models (User, Account, Session, VerificationToken), configuring Auth.js v5 in the Next.js web app with GitHub and Google OAuth providers (JWT session strategy), delivering sign-in / sign-out UI in the app header, and scaffolding the protected API route middleware that future tasks (TASK-0022 favorites, Goal 8 submissions) will rely on. This maps directly to PRD Flow 1 (OAuth account creation / sign-in on web) and the header authenticated state described in the PRD constraints section.

Email/password auth, the Favorites/Collection/CollectionShortcut schema, and desktop deep-link auth are explicitly out of scope and belong to later tasks.

---

## Technical components needed

**New backend components:**

- `packages/web/lib/auth.ts` — Auth.js v5 config: `PrismaAdapter`, JWT session strategy, GitHub OAuth provider, Google OAuth provider. Exports typed `auth()` (server-side session helper), `signIn()`, `signOut()`, and route `handlers`.
- `packages/web/app/api/auth/[...nextauth]/route.ts` — Re-exports `{ GET, POST }` from `auth.ts` handlers. Satisfies the Auth.js catch-all route requirement.
- `packages/web/middleware.ts` — Next.js middleware wrapping the Auth.js `auth` export; protects `/api/favorites/*` and `/api/submissions/*` — returns 401 for unauthenticated requests. All other routes remain public.

**Modified backend components:**

- `database/schema.prisma` — Adds four Auth.js standard models: `User`, `Account`, `Session`, `VerificationToken`. No existing tables are altered. See Schema changes section.
- `packages/web/lib/env.ts` — Adds six new env vars: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`. Typed and validated at startup.
- `packages/web/app/providers.tsx` — Wraps the app in `SessionProvider` from `next-auth/react` so client components can call `useSession()`.
- `packages/web/app/layout.tsx` — Updated to call `auth()` server-side and render either `SignInButton` (unauthenticated) or `UserMenu` (authenticated) in the header area.

**New frontend components:**

- `packages/web/components/SignInButton.tsx` — Client component. Renders a "Sign In" button for unauthenticated users. Calls `signIn()` (Auth.js) to start the OAuth flow (GitHub or Google — provider selection handled by Auth.js built-in sign-in page or a minimal modal).
- `packages/web/components/UserMenu.tsx` — Client component. Shown in header for authenticated users. Displays user avatar (initials fallback if no image URL), and a dropdown with "Sign out" action (`signOut()`). Uses `useSession()` to read user data client-side.

**Schema changes:**

- `users` table — Auth.js User model: `id` (cuid), `name`, `email` (unique), `emailVerified` (DateTime, nullable), `image` (nullable). No `hashedPassword` — OAuth-only in this task.
- `accounts` table — Auth.js Account model: links a User to one or more OAuth providers (GitHub, Google). Stores provider token data per Auth.js adapter spec.
- `sessions` table — Auth.js Session model: present in schema for adapter compatibility; will remain empty at runtime because JWT strategy is used. No session rows are written.
- `verification_tokens` table — Auth.js VerificationToken model: included per adapter spec; unused in this task (no email/password flow). Available for future use.

**API changes:**

- `GET /api/auth/*` and `POST /api/auth/*` — All handled by the Auth.js catch-all route. No manually-written endpoint code.
- `/api/favorites/*` and `/api/submissions/*` — These paths are now protected by middleware (return 401 for unauthenticated requests). The routes themselves don't exist yet; the middleware is scaffolded in advance.

---

## Key architectural decisions

- **GitHub + Google OAuth only** — Email/password credentials provider is explicitly out of scope per the backlog. Including it here would expand scope, touch bcrypt/password-hashing infrastructure, and create email-verification dependencies. It stays out.
- **JWT strategy** — Per PRD constraint: `strategy: "jwt"` avoids session database lookups and makes it straightforward for the future desktop app to validate tokens from a cookie or bearer header. The `sessions` table is schema-present but never written.
- **Auth.js v5 (next-auth@5 beta)** — v5 is the App Router-native version. v4 patterns (`getServerSideSession`, `_app.tsx` SessionProvider) are incompatible with the App Router. The beta API is stable enough for this stage; pinning a specific beta version in `package.json` mitigates unexpected drift.
- **`auth()` server-side, `useSession()` client-side** — Server components call `auth()` from `lib/auth.ts` for SSR-safe session access with no client round-trip. Client components use `useSession()` from `next-auth/react`. Layout uses `auth()` so the initial header render is correct without a flash.
- **Middleware scope limited to future-guarded paths** — Middleware protects `/api/favorites/*` and `/api/submissions/*`. These routes don't exist yet but will be built in TASK-0022 and Goal 8. Scaffolding the protection now means those tasks don't have to think about auth wiring.
- **No Favorites / Collection schema here** — TASK-0022 owns `Collection`, `CollectionShortcut`, and the schema migration that ties them to `userId`. Adding them here would bloat the PR, create a dependency inversion, and make the TASK-0022 PR harder to review in isolation.

---

## Test coverage plan

- **E2E (Playwright):** `packages/web/e2e/auth.spec.ts`
  - "Sign In" button visible in unauthenticated state (server renders SignInButton)
  - Authenticated header state shows UserMenu with avatar/initials (mocked session fixture)
  - "Sign out" action in UserMenu calls signOut and returns to unauthenticated state

- **Vitest (component unit tests):**
  - `SignInButton.test.tsx` — renders without crash, click calls `signIn()`
  - `UserMenu.test.tsx` — renders user initials when no image, shows sign-out button, click calls `signOut()`

---

## Out of scope (technical)

- Email/password (credentials) provider and bcrypt password hashing
- `Favorite`, `Collection`, `CollectionShortcut` Prisma models and their migration (TASK-0022)
- `/api/favorites` CRUD routes (TASK-0022)
- Anonymous-favorites migration hook (`useMigrateFavorites`) — depends on the TASK-0022 API
- Desktop auth: browser redirect, deep-link protocol handler (`shortcutvault://`), electron-store token storage
- Offline favorites cache
- Rate limiting on auth endpoints
- Verification email infra beyond the VerificationToken table being present
- Password reset UI

---

## Risks and open questions

- **next-auth v5 beta stability** — v5 is in beta. Pinning a specific beta version in `package.json` reduces drift risk. The App Router integration (`auth()` server helper) is well-tested in the community.
- **OAuth app registration** — GitHub OAuth app and Google Cloud OAuth client IDs/secrets must exist in the `.env.local` for the sign-in flow to work locally. The acceptance criteria can be verified with mocked sessions in tests even without real OAuth credentials; the actual OAuth round-trip requires the developer to set up apps in GitHub/Google developer consoles before the feature demo.
- **Auth.js PrismaAdapter and Prisma version compatibility** — The adapter requires Prisma Client to be available at `@prisma/client`. The existing `packages/web/lib/prisma.ts` singleton should work as-is; no version conflict anticipated but worth verifying during Phase 1.

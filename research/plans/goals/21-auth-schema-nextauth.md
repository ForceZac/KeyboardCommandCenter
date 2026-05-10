# Plan: TASK-0021 — Auth Schema & NextAuth Integration

**Branch:** goals/21-auth-schema-nextauth
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**TRD:** research/plans/goals/21-auth-schema-nextauth-trd.md

---

## Objective

Wire Auth.js v5 (NextAuth) into the Next.js web app with GitHub and Google OAuth providers only. Adds the User model and Auth.js standard tables to the Prisma schema, configures JWT sessions, scaffolds protected API route middleware, and delivers sign-in / sign-out UI in the app header.

**NOT done here:**
- Email/password credentials provider (explicitly out of scope per backlog)
- Favorites, Collection, CollectionShortcut schema (TASK-0022's territory)
- Anonymous-favorites migration hook (depends on TASK-0022's API)
- Desktop deep-link auth or electron-store token storage (future task)

---

## Work breakdown

### Phase 1 — Schema & Migration
1. Install `next-auth@5` (beta) and `@auth/prisma-adapter` in `packages/web`
2. Extend `database/schema.prisma` with the four Auth.js standard models:
   - `User` — id (cuid), name, email (unique), emailVerified, image
   - `Account` — Auth.js account linking (links User to OAuth provider)
   - `Session` — present for adapter compatibility; unused at runtime (JWT strategy)
   - `VerificationToken` — for future email verification
3. Run `npx prisma migrate dev --name add_auth_schema` to generate migration

### Phase 2 — Auth.js Configuration
4. Create `packages/web/lib/auth.ts` — Auth.js config: `PrismaAdapter`, `strategy: "jwt"`,
   GitHub OAuth provider, Google OAuth provider. Export `auth()`, `signIn()`, `signOut()`.
5. Update `packages/web/lib/env.ts` — add `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`
6. Create `packages/web/app/api/auth/[...nextauth]/route.ts` — re-export `handlers` from `auth.ts`

### Phase 3 — Session Provider
7. Update (or create) `packages/web/app/providers.tsx` — wrap app in `SessionProvider`
   from `next-auth/react` so client components can call `useSession()`

### Phase 4 — Header UI
8. Create `packages/web/components/UserMenu.tsx` — client component; shows avatar
   and sign-out dropdown for authenticated users
9. Create `packages/web/components/SignInButton.tsx` — client component; shows
   "Sign In" button for unauthenticated users (triggers sign-in modal or direct OAuth flow)
10. Update `packages/web/app/layout.tsx` — extract or update Header to call `auth()`
    server-side and conditionally render SignInButton or UserMenu

### Phase 5 — Protected Route Middleware
11. Create `packages/web/middleware.ts` — Next.js middleware using Auth.js `auth` wrapper;
    returns 401 for unauthenticated requests to `/api/favorites/*` and `/api/submissions/*`

### Phase 6 — Tests
12. Vitest unit tests:
    - `SignInButton.test.tsx` — renders, calls `signIn()` on click
    - `UserMenu.test.tsx` — renders avatar/initials, sign-out click calls `signOut()`
13. Playwright E2E: `auth.spec.ts` — sign-in button visible in unauthenticated state,
    authenticated header state via session fixture, sign-out returns to unauthenticated

## Build order rationale

Schema first — Auth.js adapter and all components depend on the User/Account models existing.
Auth config next — catch-all route and middleware both import from `lib/auth.ts`.
SessionProvider before UI components — client components need the context.
Protected route middleware last — needs `auth()` established first.
Tests alongside or immediately after each phase.

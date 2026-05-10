# Plan: TASK-0021 — Auth Schema & NextAuth Integration

**Branch:** goals/21-auth-schema-nextauth
**PRD:** research/agents/prds/goal-07-accounts-favorites.md
**TRD:** research/plans/goals/21-auth-schema-nextauth-trd.md

---

## Objective

Wire Auth.js v5 into the Next.js web app: Prisma schema additions, OAuth + credentials providers, sign-in modal, authenticated header, and anonymous-favorites migration on first sign-in.

## Work breakdown

### Phase 1 — Schema & Migration
1. Add `next-auth@5`, `@auth/prisma-adapter`, `bcryptjs`, `@types/bcryptjs` to `packages/web`
2. Extend `database/schema.prisma` with Auth.js standard models (User, Account, Session, VerificationToken) and domain models (Favorite, Collection, CollectionShortcut junction)
3. Run `npx prisma migrate dev --name add-auth-and-favorites-schema` to generate migration

### Phase 2 — Auth.js Configuration
4. Create `packages/web/lib/auth.ts` — Auth.js config: Prisma adapter, JWT strategy, Google OAuth, GitHub OAuth, Credentials provider (bcrypt password check). Expose typed `auth()`, `signIn()`, `signOut()` helpers.
5. Update `packages/web/lib/env.ts` — add `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`
6. Create `packages/web/app/api/auth/[...nextauth]/route.ts` — re-export `handlers` from `auth.ts`

### Phase 3 — Providers
7. Update `packages/web/app/providers.tsx` — wrap with `SessionProvider` from `next-auth/react`

### Phase 4 — UI Components
8. Create `packages/web/components/SignInModal.tsx` — client component with "Continue with Google", "Continue with GitHub", and email/password form. Opens via sign-in button in header.
9. Create `packages/web/components/UserMenu.tsx` — client component: avatar, dropdown with "Favorites" link and "Sign out"
10. Update `packages/web/app/layout.tsx` (or extract a `Header` server component) — show sign-in button for anonymous users, UserMenu for authenticated users. Use `auth()` server-side for initial state.

### Phase 5 — Anonymous Favorites Migration
11. Create `packages/web/hooks/useMigrateFavorites.ts` — runs once after first sign-in: reads localStorage `kcc_favorites`, POSTs each to `/api/favorites` (API exists after TASK-0022, so this hook no-ops if API doesn't exist yet), clears localStorage. This hook is wired into the SessionProvider callback or a client layout effect.

### Phase 6 — Tests
12. Vitest unit tests: `SignInModal.test.tsx` (renders buttons, handles input), `UserMenu.test.tsx` (renders avatar, dropdown items)
13. Playwright E2E: `auth.spec.ts` — covers sign-in modal open/close, authenticated header state (mocked session), sign-out action

## What is NOT done in this task
- Favorites CRUD API routes (TASK-0022)
- Favorites page/view (TASK-0023)
- Collections CRUD or UI
- Desktop auth flow
- Desktop electron-store
- Offline sync
- Rate limiting
- Verification email infra (Auth.js handles basic flow)

## Build order rationale
Schema first — everything else depends on it. Auth config next — API route depends on it. Providers before UI — components need session context. Anonymous migration last — hooks into the session flow established above.

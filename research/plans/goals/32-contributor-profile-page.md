# Plan: Contributor Profile Page — TASK-0032

## Work breakdown

### 1. Schema change — add `createdAt` to User model
The User model lacks a `createdAt` field. The PRD requires "Member since" date. Add `createdAt DateTime @default(now())` to the User model and run a migration. Backfill existing rows with `now()` (acceptable — all users are recent).

### 2. Core types — `IContributorProfile`
Add a `IContributorProfile` interface to `@kcc/core` with user info + contribution stats + accepted contributions list.

### 3. Service layer — `ProfileService`
New service at `packages/web/services/ProfileService.ts`. Single method `getPublicProfile(userId)` that:
- Fetches user (id, name, image, createdAt)
- Counts submissions by status (total, approved, rejected)
- Fetches accepted submissions with app name and reviewed date
- Returns the profile shape

### 4. API route — `GET /api/users/[userId]/profile`
Public endpoint (no auth required). Calls ProfileService, returns `IContributorProfile`. Returns 404 if user not found.

### 5. Profile page — `/profile/[userId]`
Server component reads `userId` from params, renders `ContributorProfileClient`. Public route — no auth gate.

### 6. Client component — `ContributorProfileClient`
Displays:
- Avatar + display name
- "Member since" date
- Stats cards: total submitted, total accepted, acceptance rate
- List of accepted contributions (shortcut command, app name, date accepted)

Uses TanStack Query hook `useContributorProfile(userId)`.

### 7. UserMenu — add "My Profile" link
Add a link to `/profile/{userId}` in the avatar dropdown, between "My Collections" and "Sign out".

### 8. Tests
- Vitest: ProfileService unit tests (stat calculation, missing user)
- Playwright E2E: profile page loads, stats render, nav link works

## Build order
1 → 2 → 3 → 4 → 5+6+7 (parallel) → 8

# TRD: Contributor Profile Page

**Task:** TASK-0032
**Branch:** goals/32-contributor-profile-page
**PRD:** research/agents/prds/goal-08-community-contributions.md
**Date:** 2026-05-11

---

## What we're building

A public contributor profile page at `/profile/[userId]` that displays a user's identity (name, avatar, join date), contribution statistics (total submitted, total accepted, acceptance rate), and a list of their accepted contributions. This maps to PRD Flow 5 (Contributor Profile). The profile is publicly viewable — any visitor can see any contributor's profile. Authenticated users get a "My Profile" link in the nav avatar dropdown.

## Technical components needed

**New backend components:**
- `ProfileService` — fetches user info + aggregated submission stats + accepted contributions list from Prisma. Single `getPublicProfile(userId)` method. Keeps the SubmissionsService focused on submission CRUD and admin operations.

**Modified backend components:**
- None. The existing SubmissionsService is not modified — ProfileService queries Prisma directly for the aggregation queries it needs (counts by status, accepted list with app join).

**New frontend components:**
- `ContributorProfileClient` — client component rendering the full profile: avatar with initials fallback, "Member since" date, three stat cards (submitted/accepted/rate), and a list of accepted contributions showing shortcut command, app name, and approval date.
- `useContributorProfile` hook — TanStack Query wrapper for `GET /api/users/[userId]/profile`. Handles loading/error states.
- API client function `fetchContributorProfile(userId)` in `lib/api.ts`.

**Modified frontend components:**
- `UserMenu` — add a "My Profile" link pointing to `/profile/{session.user.id}` in the dropdown menu, between "My Collections" and "Sign out".

**Schema changes:**
- Add `createdAt DateTime @default(now())` to the `User` model. Required for "Member since" display. The Auth.js standard User model doesn't include this field by default, but it's a natural addition. Existing rows will be backfilled with the migration timestamp (acceptable — all users are from the current dev phase).

**API changes:**
- `GET /api/users/[userId]/profile` — public endpoint (no auth required). Returns `IContributorProfile` shape: user info (id, name, image, memberSince) + stats (totalSubmitted, totalAccepted, acceptanceRate) + acceptedContributions array (type, command/appName, date). Returns 404 if user ID not found.

## Key architectural decisions

- **New ProfileService rather than extending SubmissionsService** — the profile aggregation queries (count by status, join with app for accepted list) are a different concern from submission CRUD. Keeping them separate follows the one-service-per-domain pattern.
- **Server-side stat computation** — stats are computed in the API route via Prisma `count` and `findMany`, not in the client. This avoids shipping all submission records to the browser just to count them.
- **Public route, no auth gate** — per PRD: "Profiles are public — other users can view a contributor's profile to see their contributions." The page itself requires no session. Only the "My Profile" nav link requires auth (it's inside the UserMenu which only renders for authenticated users).
- **Adding `createdAt` to User** — cleaner than deriving "Member since" from the earliest Account or Collection creation date. A single schema field is authoritative and queryable.
- **No pagination on accepted contributions for v1** — the profile will fetch all accepted contributions. Given the current scale (solo dev, no public contributors yet), pagination is premature. Can be added later if a contributor has 100+ accepted submissions.

## Test coverage plan

- **Vitest unit tests:** ProfileService — correct stat calculation from submission data, missing user returns null, user with zero submissions returns zero stats with empty list.
- **Playwright E2E:** profile page renders with correct user info and stats, "My Profile" link in UserMenu navigates to the correct profile URL, profile for non-existent user shows 404/not found state.

## Out of scope (technical)

- Private profile settings or editable profile fields (PRD explicitly excludes these).
- Notification system or reputation/badges/gamification.
- Pagination of accepted contributions list.
- Profile caching or CDN considerations.
- Profile for unauthenticated users (no user to show a profile for — but anyone can view others' profiles).

## Risks and open questions

- **User `createdAt` backfill:** existing users will get the migration timestamp as their `createdAt`, not their actual registration date. Acceptable for dev phase; if this matters later, we could backfill from the Account table's earliest record. No action needed now.
- **Session `user.id` availability:** the session JWT must include the user ID for the "My Profile" link. The existing auth config already exposes `session.user.id` (confirmed in layout.tsx and API routes), so this is not a risk.

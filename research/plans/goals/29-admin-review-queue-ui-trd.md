# TRD: Admin Review Queue UI

**Task:** TASK-0029
**Branch:** goals/29-admin-review-queue-ui
**PRD:** research/agents/prds/goal-08-community-contributions.md (Flow 4)
**Date:** 2026-05-11

---

## What we're building

The admin review queue gives the site owner a single page at `/admin/review` to see all pending community submissions and act on them (approve, edit-and-approve, or reject). The submission data model and API routes already exist from TASK-0027 (`GET /api/admin/submissions`, `PATCH /api/admin/submissions/:id`). This task extends those routes to return richer relational data (submitter name, app name, original shortcut for diff view), adds a Next.js route group layout for admin access control, and builds the review queue page with interactive submission cards.

---

## Technical components needed

**Modified backend components:**
- `SubmissionsService.getPending()` — extend to join `User` (for display name and avatar), `Application` (for app name and slug), and `Shortcut` (for original shortcut data needed by the correction diff view). Paginate at 50 per page via `?page=N` query param.
- `GET /api/admin/submissions` route — pass `page` query param to `getPending()`; return `{ submissions: IAdminSubmission[], totalPending: number }` instead of a bare array.

**New backend types (packages/core):**
- `IAdminSubmission` — extends `ISubmission` with `submitterName: string`, `submitterImage: string | null`, `appName: string | null`, `appSlug: string | null`, `originalShortcut: { command: string; keyCombo: string; context: string | null; platform: string } | null` (populated for CORRECTION submissions only).

**New frontend components (packages/web):**
- `app/admin/layout.tsx` — server component layout for the `/admin/*` route group. Checks `auth()` session and `user.isAdmin`; redirects unauthenticated users to `/`; renders a 403 message for non-admins. All admin routes inherit this protection without repeating auth checks on each page.
- `app/admin/review/page.tsx` — server component. Renders the "Review Queue" heading with a pending count and mounts `<AdminReviewQueue />` inside `<Suspense>`.
- `app/admin/review/components/AdminReviewQueue.tsx` — client component. Fetches pending submissions via `useAdminSubmissions`, renders `SubmissionCard` list, shows pagination controls when `totalPending > 50`, and renders an empty state when the queue is clear.
- `app/admin/review/components/SubmissionCard.tsx` — client component. Renders the type badge, submitter info, app name, submitted data fields, `CorrectionDiffView` (for CORRECTION), `DuplicateBadge` (when server-flagged), and the three action controls (Approve, Edit & Approve expandable, Reject with optional reason). Calls `useAdminAction` mutations; on success the card removes itself from the visible list.
- `app/admin/review/components/SubmissionTypeBadge.tsx` — atom. Colored badge ("New Shortcut" / "Correction" / "App Request") using shadcn/ui Badge.
- `app/admin/review/components/CorrectionDiffView.tsx` — molecule. Side-by-side field comparison between `originalShortcut` and `submission.data`. Fields: command, key combo, context, platform. Changed fields highlighted; unchanged fields muted. No third-party diff library — pure field equality checks.
- `app/admin/review/components/DuplicateBadge.tsx` — atom. Warning badge rendered when `submission.data.serverFlaggedDuplicate` is truthy, linking to the existing shortcut entry.
- `app/admin/review/hooks/useAdminSubmissions.ts` — TanStack Query `useQuery` hook wrapping `GET /api/admin/submissions?page=N`. Returns `{ submissions, totalPending, isLoading, error }`.
- `app/admin/review/hooks/useAdminAction.ts` — TanStack Query `useMutation` hook wrapping `PATCH /api/admin/submissions/:id`. Invalidates `useAdminSubmissions` on success so the acted-on submission disappears from the queue.

**Schema changes:**
- No schema changes — `Submission`, `User`, and `Application` models from TASK-0027 already have all needed fields.

**API changes:**
- `GET /api/admin/submissions` — response body changes from `ISubmission[]` to `{ submissions: IAdminSubmission[]; totalPending: number }`. Adds `?page=N` query parameter (default page 1, 50 per page). Breaking change from the bare-array shape, but this route has no callers outside this task's UI.

---

## Key architectural decisions

- **Admin layout for route protection** — using Next.js App Router's `layout.tsx` for the `/admin` segment centralizes auth checks in one place. All future admin pages inherit the protection without duplicating `isAdmin` checks.
- **Extending `getPending()` with joins** — instead of creating a new service method, we extend the existing one with optional pagination and relational data. The `IAdminSubmission` type in `packages/core` captures the extended wire shape so the frontend and backend stay in sync.
- **No third-party diff library** — the correction diff is a simple field-level comparison (4 fields: command, keyCombo, context, platform). A custom component is lighter and avoids a dependency for trivial logic.
- **Optimistic removal on action** — when admin takes an action (approve/reject/edit-and-approve), `useAdminAction` invalidates the query and the acted-on card disappears. This matches the PRD requirement "submission is removed from the visible queue after any action" without a separate in-memory removal step.
- **Pagination at 50, not 100** — the PRD says "paginate if pending count exceeds 100" but 50/page is a better default for review queue ergonomics (admin doesn't have to scroll through 100 cards per page). This is a refinement within the spirit of the PRD constraint.

---

## Test coverage plan

- **E2E specs** (`admin-review-queue.spec.ts`): non-admin 403 redirect, pending submissions rendered, type badge visible, correction diff view present, duplicate badge shown when flagged, Approve removes card, Reject with reason removes card, Edit & Approve shows inline editor and removes on success, empty state when queue is clear, pagination controls shown when >50.
- **Vitest unit tests**: `SubmissionsService.getPending()` with joins (submitterName, appName, originalShortcut populated correctly), `CorrectionDiffView` renders correct changed/unchanged field states, `SubmissionTypeBadge` renders correct label and color per type.

---

## Out of scope (technical)

- Keyboard shortcuts for approve/reject actions (PRD mentions as v2)
- Batch approve/reject (not in PRD v1)
- Email notifications to submitter on approval/rejection (PRD: in-app only, and notification system is a separate concern)
- Spam detection heuristics
- The correction form on per-app pages (TASK-0030)
- Submission API routes themselves (TASK-0027 — shipped)

---

## Risks and open questions

- **`serverFlaggedDuplicate` field in `submission.data`**: The TASK-0027 service detects duplicates and throws `DuplicateSubmissionError` before creating the record — so a submission with a confirmed duplicate would never reach PENDING. The `DuplicateBadge` should instead check if the submission's `data.keyCombo`/`data.platformId` matches an existing shortcut (a read-only check at render time). This needs to be clarified during implementation: either fetch the existing shortcut at the service layer and annotate the submission, or leave the badge as a placeholder for now. Recommendation: fetch and annotate in `getPending()` — add `isDuplicateOf: string | null` (shortcut ID) to `IAdminSubmission` so the UI has a clean flag.
- **`originalShortcut` data for diff view**: For CORRECTION submissions, the `submission.shortcutId` FK points to the original shortcut. `getPending()` can join this directly via Prisma include. Risk: shortcut may have been deleted between submission and review — handle with `null` gracefully.
- **Response shape change breaking existing callers**: `GET /api/admin/submissions` currently returns a bare array. Changing to `{ submissions, totalPending }` is non-breaking for the only current consumer (this task's UI), but any test mocks relying on the bare array shape will need updating.

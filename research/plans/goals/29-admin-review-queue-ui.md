# Plan: TASK-0029 — Admin Review Queue UI

**Branch:** goals/29-admin-review-queue-ui
**PRD:** research/agents/prds/goal-08-community-contributions.md
**TRD:** research/plans/goals/29-admin-review-queue-ui-trd.md

---

## Objective

Build the admin review queue at `/admin/review`. Protected route (isAdmin only). Displays all PENDING submissions sorted oldest-first. Each submission card shows type badge, submitter name, app name, and submitted data. Corrections show a diff view. Server-flagged duplicates show a warning badge. Three actions per submission: Approve, Edit & Approve (inline editing), Reject (optional reason). Paginate at >100 pending.

**NOT done here:**
- Submission API routes (TASK-0027 — already shipped)
- Submission form / key recorder (TASK-0028 — already shipped)
- Correction form UI on per-app pages (TASK-0030)
- App request form (TASK-0031)
- Contributor profile page (TASK-0032)

---

## Work breakdown

### Phase 1 — Extend API to include submitter name + app name

1. Extend `SubmissionsService.getPending()` to include relational data:
   - Join `User` for `submitter.name` and `submitter.image`
   - Join `Application` for `application.name` and `application.slug`
   - Join `Shortcut` for original shortcut data (needed for correction diff view)
2. Add `IAdminSubmission` type to `packages/core/src/types.ts`:
   - Extends `ISubmission` with `submitterName`, `submitterImage`, `appName`, `appSlug`, `originalShortcut?`
3. Update `GET /api/admin/submissions` route return type to `IAdminSubmission[]`
4. Add pagination support: `?page=1` query param, 50 per page, include `totalPending` in response body

### Phase 2 — Route protection middleware

5. Create `packages/web/app/admin/layout.tsx` — server component that:
   - Checks `auth()` session; redirects to `/` if no session
   - Fetches `user.isAdmin` from Prisma; returns 403 page if not admin
   - Renders `{children}` if admin

### Phase 3 — `useAdminSubmissions` hook

6. Add `getAdminSubmissions(page?: number)` to `packages/web/lib/api.ts`
7. Create `packages/web/app/admin/review/hooks/useAdminSubmissions.ts`:
   - TanStack Query `useQuery` wrapper around `GET /api/admin/submissions?page=N`
   - Returns `{ submissions, totalPending, isLoading, error }`

### Phase 4 — `useAdminAction` hook

8. Create `packages/web/app/admin/review/hooks/useAdminAction.ts`:
   - TanStack Query `useMutation` wrapper around `PATCH /api/admin/submissions/:id`
   - On success: optimistically removes the submission from the list (invalidates query)
   - Supports approve, reject (with notes), edit-and-approve (with updated data fields)

### Phase 5 — UI Components

9. `packages/web/app/admin/review/components/SubmissionTypeBadge.tsx` — atom:
   - Colored badge: "New Shortcut" (blue), "Correction" (yellow), "App Request" (green)
   - Uses shadcn/ui Badge with variant colors

10. `packages/web/app/admin/review/components/CorrectionDiffView.tsx` — molecule:
    - Renders a side-by-side or unified diff of `originalShortcut` vs `submission.data`
    - Only renders for CORRECTION submissions
    - Highlights changed fields with color (unchanged fields shown muted)
    - No third-party diff library — simple field-by-field comparison (command, keyCombo, context, platform)

11. `packages/web/app/admin/review/components/DuplicateBadge.tsx` — atom:
    - Renders a warning badge "⚠ Duplicate detected" when `submission.data.serverFlaggedDuplicate` is truthy
    - Links to the existing shortcut entry

12. `packages/web/app/admin/review/components/SubmissionCard.tsx` — organism:
    - Type badge + submitter name/avatar + app name + submitted data fields
    - CORRECTION: renders `CorrectionDiffView`
    - Shows `DuplicateBadge` when applicable
    - Three action sections: Approve button, "Edit & Approve" expandable inline editor, Reject button with optional reason textarea
    - Action calls `useAdminAction` mutation
    - After action resolves: card fades out and removes itself from list (optimistic update)

13. `packages/web/app/admin/review/components/AdminReviewQueue.tsx` — client component:
    - Fetches via `useAdminSubmissions`
    - Renders list of `SubmissionCard` components
    - Shows pagination controls if `totalPending > 50`
    - Empty state: "No pending submissions — queue is clear."
    - Loading skeleton while fetching

14. `packages/web/app/admin/review/page.tsx` — server page component:
    - Renders heading "Review Queue" with pending count
    - Renders `<AdminReviewQueue />` (client component boundary)
    - `<Suspense>` wrapper around the queue

### Phase 6 — Tests

15. Vitest unit tests:
    - `SubmissionsService.getPending()` with relations — verify submitterName, appName, originalShortcut populated
    - `CorrectionDiffView` — unit test diff rendering (changed vs unchanged fields)
    - `SubmissionTypeBadge` — correct label and color class per type
    - `DuplicateBadge` — renders only when flagged

16. Playwright E2E tests (`packages/web/__e2e__/admin-review-queue.spec.ts`):
    - Non-admin redirected or shown 403
    - Admin sees pending submissions list
    - Type badge visible on each card
    - Correction card shows diff view
    - Duplicate badge shown when flagged
    - Approve removes submission from queue
    - Reject with reason removes submission from queue
    - Edit & Approve shows inline editor and removes on success
    - Pagination renders at >100 (mocked)
    - Empty state visible when no pending submissions

---

## Build order rationale

API extension first — UI components depend on the enriched data shape.
Route protection (layout) before page — prevents unauthorized access at the framework level.
Hooks before components — components import hooks.
Atoms before organisms — SubmissionCard composes the smaller pieces.
AdminReviewQueue last before page — it composes the cards.
Tests after implementation — cover service extension and all new components.

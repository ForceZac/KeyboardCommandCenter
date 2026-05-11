# Plan: TASK-0027 — Submission Data Model, Service Layer & API Routes

**Branch:** goals/27-submission-data-model-api
**PRD:** research/agents/prds/goal-08-community-contributions.md
**TRD:** research/plans/goals/27-submission-data-model-api-trd.md

---

## Objective

Add the `Submission` Prisma model with type and status enums, add `isAdmin` to `User`, generate and apply the migration, implement `SubmissionsService` with rate limiting and server-side duplicate detection, and wire up four API routes (POST /api/submissions, GET /api/submissions, GET /api/admin/submissions, PATCH /api/admin/submissions/:id).

**NOT done here:**
- Submission form UI or key recorder component — TASK-0028
- Admin review queue UI page — TASK-0029
- Correction form UI — TASK-0030
- App request form UI — TASK-0031
- Contributor profile page — TASK-0032
- In-app notification system (out of scope for this task)
- Client-side duplicate detection (TASK-0028)

---

## Work breakdown

### Phase 1 — Schema & Migration
1. Extend `database/schema.prisma`:
   - Add `SubmissionType` enum: `NEW_SHORTCUT`, `CORRECTION`, `APP_REQUEST`
   - Add `SubmissionStatus` enum: `PENDING`, `APPROVED`, `REJECTED`
   - Add `Submission` model: id, type (SubmissionType), status (SubmissionStatus, default PENDING), submitterId (FK to User), appId (FK to Application), shortcutId (nullable FK to Shortcut, for corrections), data (Json — stores submitted shortcut fields), reviewerNotes (String?, optional), reviewedBy (String?, admin userId), createdAt, updatedAt, reviewedAt (DateTime?)
   - Add `isAdmin Boolean @default(false)` to `User` model
   - Add inverse relations on User and Application
2. Run `npx prisma migrate dev --name add_submission_schema` from `database/` to generate migration SQL

### Phase 2 — Error types
3. Add `RateLimitError` and `DuplicateSubmissionError` to `packages/web/lib/errors.ts` — consistent with existing `LimitReachedError` pattern

### Phase 3 — Service Layer
4. Create `packages/web/services/SubmissionsService.ts`:
   - `create(userId, payload)` — validate fields, check 20/day rate limit (count submissions by user in current day UTC), server-side duplicate detection for NEW_SHORTCUT (lookup ShortcutKeyBinding where application + platform + keyCombo match), insert Submission with status PENDING
   - `getByUser(userId)` — return all submissions for this user, newest first
   - `getPending()` — return PENDING submissions only, oldest first (admin use)
   - `approve(adminId, submissionId)` — apply submission to shortcuts table (NEW_SHORTCUT → insert Shortcut + ShortcutKeyBinding + ShortcutKeyStep rows; CORRECTION → update existing shortcut row; APP_REQUEST → insert Application), update Submission status to APPROVED, set reviewedBy + reviewedAt
   - `editAndApprove(adminId, submissionId, updatedData)` — merge updatedData into submission.data then call approve logic
   - `reject(adminId, submissionId, reviewerNotes?)` — update status to REJECTED, set reviewedBy + reviewedAt + reviewerNotes

### Phase 4 — API Routes
5. `packages/web/app/api/submissions/route.ts`:
   - `POST` — auth required (401 if no session); parse + validate body; delegate to `SubmissionsService.create`; return 201 on success; 429 on RateLimitError; 409 on DuplicateSubmissionError; 400 on validation failure
   - `GET` — auth required; delegate to `SubmissionsService.getByUser`; return 200 with array
6. `packages/web/app/api/admin/submissions/route.ts`:
   - `GET` — auth required + isAdmin check (403 if not admin); delegate to `SubmissionsService.getPending`; return 200 with array
7. `packages/web/app/api/admin/submissions/[id]/route.ts`:
   - `PATCH` — auth required + isAdmin check; parse action (`approve` | `reject` | `edit-and-approve`) + optional fields; delegate to matching service method; return 200 on success; 404 if submission not found

### Phase 5 — Shared Types (packages/core)
8. Add `Submission`, `SubmissionType`, `SubmissionStatus`, `SubmissionCreatePayload`, `SubmissionAdminAction` types to `packages/core/src/types.ts`

### Phase 6 — Tests
9. Vitest tests for SubmissionsService and routes:
   - `submissions.test.ts` — POST 401 (no session), POST 201 (success), POST 429 (rate limit), POST 409 (duplicate), GET 200 (own submissions list), GET 401
   - `admin-submissions.test.ts` — GET 403 (non-admin), GET 200 (pending list oldest-first), PATCH approve (200, shortcuts table updated), PATCH reject (200), PATCH edit-and-approve (200), PATCH 404 (unknown id), PATCH 401/403

---

## Build order rationale

Schema first — all service and route code depends on Prisma models existing.
Error types before services — services throw them.
Services before routes — thin controllers delegate to services.
Shared types alongside services — routes and future UI both need them.
Tests last — cover each route and service method in isolation.

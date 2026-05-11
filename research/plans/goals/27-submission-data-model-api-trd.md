# TRD: Submission Data Model, Service Layer & API Routes

**Task:** TASK-0027
**Branch:** goals/27-submission-data-model-api
**PRD:** research/agents/prds/goal-08-community-contributions.md
**Date:** 2026-05-11

---

## What we're building

TASK-0027 delivers the backend foundation for community contributions. The PRD defines five submission flows (new shortcut, correction, app request, admin review, contributor profile) — this task covers the Prisma data layer and API surface that all five flows depend on. Specifically: a `Submission` model with type/status enums and a JSON `data` field for arbitrary submitted fields; an `isAdmin` flag on `User` for protecting admin routes; a `SubmissionsService` that owns rate limiting and server-side duplicate detection; and four Next.js API routes giving the UI (TASK-0028/0029) everything it needs.

## Technical components needed

**Schema changes:**
- `SubmissionType` enum: `NEW_SHORTCUT`, `CORRECTION`, `APP_REQUEST` — maps directly to the three submission types in the PRD
- `SubmissionStatus` enum: `PENDING`, `APPROVED`, `REJECTED` — drives the admin review workflow
- `Submission` table: id (cuid), type, status (default PENDING), submitterId (FK to users.id, cascades on delete), appId (nullable FK to applications.id — required for NEW_SHORTCUT and CORRECTION where the target app already exists; nullable for APP_REQUEST since the requested app does not exist in the database yet — app name and details are carried in the `data` JSON field instead), shortcutId (nullable FK to shortcuts.id — populated for CORRECTION only, references the shortcut being corrected), data (Json — stores the submitted field values: command, keyCombo, platform, context, notes for shortcuts; appName/url/category/platforms for app requests), reviewerNotes (String?, set on reject/edit), reviewedBy (String?, admin userId), createdAt, updatedAt, reviewedAt (DateTime?, set when status changes from PENDING)
- `User.isAdmin Boolean @default(false)` — guards admin-only routes without a full RBAC table; per PRD recommendation, a boolean is correct for v1 with a single admin
- Inverse relation: `User.submissions Submission[]`, `Application.submissions Submission[]`
- New Prisma migration: `add_submission_schema`

**New backend components:**
- `SubmissionsService` — owns all Submission queries; creates submissions with rate-limit and duplicate checks; applies approved submissions to the shortcuts table; rejects with optional notes
- `RateLimitError` in `lib/errors.ts` — thrown when user exceeds 20 submissions/day; controller maps to 429
- `DuplicateSubmissionError` in `lib/errors.ts` — thrown when server-side duplicate detection finds an exact app + platform + keyCombo match; controller maps to 409

**New API routes (all in `packages/web/app/api/`):**
- `POST /api/submissions` — creates a pending submission; auth required
- `GET /api/submissions` — returns the authenticated user's own submissions (all statuses), newest first
- `GET /api/admin/submissions` — returns all PENDING submissions, oldest first; requires `isAdmin`
- `PATCH /api/admin/submissions/:id` — approve / reject / edit-and-approve; requires `isAdmin`

**Modified backend components:**
- `packages/web/lib/errors.ts` — add `RateLimitError` and `DuplicateSubmissionError` classes alongside existing `LimitReachedError`

**New frontend components:**
- None in this task — UI comes in TASK-0028 and TASK-0029

**New shared types (packages/core):**
- `SubmissionType`, `SubmissionStatus` string enums
- `Submission` — the wire shape returned by GET routes
- `SubmissionCreatePayload` — shape expected by POST /api/submissions
- `SubmissionAdminAction` — union type for the PATCH body (`{ action: 'approve' | 'reject' | 'edit-and-approve'; reviewerNotes?: string; data?: object }`)

## Key architectural decisions

- **JSON `data` field for submitted values** — the three submission types have different field shapes (shortcut fields vs app-request fields). A typed JSON column avoids a complex polymorphic table design and is flexible enough for PRD-defined fields. The service validates the shape for each type before insert; the admin reviewer sees raw field values in the UI (TASK-0029).
- **Rate limiting in the service layer, not middleware** — the 20/day limit is per-user and requires a Prisma count query. Putting it in the service keeps the route thin and makes it easy to test without HTTP overhead.
- **Server-side duplicate detection on NEW_SHORTCUT only** — the PRD calls for detecting exact matches on app + platform + keyCombo. The check looks for an existing ShortcutKeyBinding (via ShortcutKeyStep.keyCombo) matching the submitted values. CORRECTION and APP_REQUEST types are exempt — corrections intentionally reference an existing shortcut, and app requests have no shortcut data to de-dupe.
- **approve() applies changes synchronously** — the PRD says "approved submissions go live within 5 minutes of approval." Synchronous Prisma writes in the same request satisfy this; no background job or queue is needed for v1.
- **CORRECTION applies to the existing shortcut row** — when approving a correction, the service updates the matched `Shortcut` (command, context) and its `ShortcutKeyStep` (keyCombo, key, modifiers). The original values are preserved in the `Submission.data` JSON field for audit. New shortcuts and app requests create new rows rather than updating existing ones.
- **isAdmin boolean on User** — per PRD open-question resolution: a boolean is correct for a solo-admin project. RBAC is out of scope.
- **No session table writes for rate-limit tracking** — rate limit uses a COUNT query on the Submission table filtered by submitterId + createdAt >= startOfDayUTC. No separate rate-limit table needed.

## Test coverage plan

- **Vitest unit/integration tests (real test DB via Docker Compose)**:
  - `submissions.test.ts`: POST 401 (unauthenticated), POST 201 (success — new shortcut), POST 429 (21st submission in a day), POST 409 (exact duplicate detected), GET 200 (own list returned), GET 401
  - `admin-submissions.test.ts`: GET 403 (non-admin), GET 200 (pending list oldest-first), PATCH approve (200, Shortcut row created/updated), PATCH reject (200, status REJECTED, reviewerNotes set), PATCH edit-and-approve (200, data merged before applying), PATCH 404 (unknown submission id), PATCH 401 (unauthenticated), PATCH 403 (non-admin)
  - `SubmissionsService.test.ts`: rate limit boundary (count=20 → create succeeds, count=20 → next create throws RateLimitError), duplicate detection (matching keyCombo → DuplicateSubmissionError, non-match → no error), approve CORRECTION updates existing shortcut row, approve APP_REQUEST inserts new Application

## Out of scope (technical)

- Submission form UI, key recorder component, correction form UI, app request form UI — TASK-0028/0030/0031
- Admin review queue page at `/admin/review` — TASK-0029
- Contributor profile page — TASK-0032
- In-app notification system (PRD scope — separate future task)
- Client-side duplicate detection (belongs in TASK-0028 submission form)
- Background jobs or queues for applying approved submissions
- Email notifications (PRD out of scope for v1)
- Bulk submission / CSV import

## Risks and open questions

- **keyCombo matching format** — the `data.keyCombo` field submitted by the user needs to be comparable to `ShortcutKeyStep.keyCombo` in the database. The key recorder (TASK-0028) will normalize format; for server-side duplicate detection this task will do a case-insensitive string match on keyCombo. If the format convention changes in TASK-0028, the duplicate detection query may need an update — low risk since TASK-0028 hasn't shipped yet.
- **Application lookup for submissions** — `appId` is required for NEW_SHORTCUT and CORRECTION; the API validates that the provided appId exists in the applications table before inserting. For APP_REQUEST, appId is nullable (schema reflects this) — the requested app doesn't exist yet, so its name and details travel in the `data` JSON field. The API accepts a null/absent appId for APP_REQUEST and rejects a null appId for the other two types.
- **Approve for APP_REQUEST** — the PRD says "if approved, the app is added to the database." This means approve() for APP_REQUEST inserts a new Application row using data fields (appName, website, category, platforms). If categoryId is provided but doesn't exist, the service should return a 400. The admin UI (TASK-0029) is responsible for displaying the data clearly; this task only implements the write path.

# TRD: App Request Form & "No Results" Request Button

**Task:** TASK-0031
**Branch:** goals/31-app-request-form
**PRD:** research/agents/prds/goal-08-community-contributions.md
**Date:** 2026-05-11

---

## What we're building

When a user searches for an app that doesn't exist in the database, the "no results" state currently shows a dead-end message. This task adds a "Request this app" button that opens a submission form, allowing logged-in users to request new apps via the existing `POST /api/submissions` API with `type: APP_REQUEST`. This maps to PRD Flow 3 (Requesting a new app). No backend changes are needed — the Submission model and API route already support the APP_REQUEST type from TASK-0027.

## Technical components needed

**New frontend components:**
- `AppRequestModal` — client component rendering the app request form inside a modal. Follows the same structural pattern as the existing `SubmitShortcutModal`: auth-gated content, form fields, mutation-driven submit, success/error states. Fetches categories via the existing `fetchCategories()` API function for the category dropdown.
- `useSubmitAppRequest` hook — TanStack Query `useMutation` wrapping the submission API call with `type: APP_REQUEST` and `appId: null`. Mirrors `useSubmitShortcut`.

**Modified frontend components:**
- `SearchResults` — needs a "Request this app" button in the empty-results state. The button opens `AppRequestModal` with the search query pre-filled as the app name.

**New backend components:**
- None. The existing `POST /api/submissions` route already handles `APP_REQUEST` type submissions (appId is optional for this type, validated in the route handler). Rate limiting (20/day) is enforced server-side by `SubmissionsService`.

**Schema changes:**
- No schema changes. The `Submission` model already includes the `APP_REQUEST` enum value and the `data` JSON field stores the request payload.

**API changes:**
- No new endpoints. The existing `POST /api/submissions` endpoint accepts `{ type: 'APP_REQUEST', data: { appName, websiteUrl?, categoryId?, platforms? } }` with `appId: null`.
- The existing `GET /api/categories` endpoint provides the category list for the dropdown.

## Key architectural decisions

- **No backend work needed** — TASK-0027 built the Submission model and API to be type-generic. APP_REQUEST submissions use `appId: null` and store request details in the `data` JSON field. This was a deliberate design choice in the data model that pays off here.
- **Reusing `submitShortcut` API function pattern** — rather than adding a new API endpoint, we call the same `POST /api/submissions` with a different type. A thin `submitAppRequest` wrapper in `lib/api.ts` makes the call semantically clear at the component level.
- **Pre-filling app name from search query** — the search term that produced zero results is the most likely app name the user wants to request. Passing it through reduces friction (PRD: "submissions complete in under 30 seconds").
- **Same modal pattern as SubmitShortcutModal** — consistent UX and code structure. Auth check, form, mutation, confirmation, error handling all follow the established pattern.
- **Category dropdown from existing API** — `GET /api/categories` already returns the category list with counts. The dropdown is optional per the PRD, so no validation is needed on the backend.

## Test coverage plan

- **Component Vitest tests:** AppRequestModal render states (unauthenticated prompt, form fields, success confirmation, error state), form validation (submit disabled without app name).
- **E2E Playwright specs:** Authenticated user submits app request from no-results page → sees confirmation. Unauthenticated user clicks request button → sees sign-in prompt. Rate limit scenario → user-friendly error message. Form validation prevents empty app name submission.

## Out of scope (technical)

- Admin handling of app requests (TASK-0029 covers the review queue, already shipped).
- Auto-populating shortcuts for newly approved apps.
- Search improvements or fuzzy matching to reduce false "no results" states.
- Notification to user when their app request is approved/rejected.
- Mobile-optimized form layout.
- Duplicate app request detection (e.g., checking if someone already requested the same app).

## Risks and open questions

- **Search query as app name:** The search query may not be a clean app name (e.g., "blender shortcuts" vs "Blender"). The pre-fill is a convenience — the user can edit it. No risk to data quality since all requests go through admin review.
- **Category list staleness:** Categories are fetched on modal open. If the category list is large or changes frequently, this could cause a stale dropdown. Low risk given the current database size and the field is optional.

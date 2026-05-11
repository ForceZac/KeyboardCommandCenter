# Plan: TASK-0031 — App Request Form & "No Results" Request Button

**Branch:** goals/31-app-request-form
**Task:** TASK-0031
**PRD:** research/agents/prds/goal-08-community-contributions.md (Flow 3)

---

## Work breakdown

### Phase 1 — API client: app request submission

1. Add `submitAppRequest(payload)` to `lib/api.ts` — calls existing `POST /api/submissions` with `type: 'APP_REQUEST'` and `appId: null`.
2. Create `hooks/useSubmitAppRequest.ts` — TanStack Query `useMutation` wrapping the API call.

### Phase 2 — Component: AppRequestModal

1. Create `packages/web/components/AppRequestModal.tsx` — client component.
2. Fields: app name (text, required), website URL (text, optional), category (dropdown from `fetchCategories()`), platform checkboxes (Windows / macOS / Linux).
3. Unauthenticated state: show sign-in prompt instead of form fields (same pattern as SubmitShortcutModal).
4. On submit: calls `useSubmitAppRequest` mutation; shows confirmation on success; shows user-friendly message on 429.
5. Form validates app name is non-empty before enabling submit.

### Phase 3 — Integration: "Request this app" button on no-results page

1. Modify `SearchResults.tsx` to show a "Request this app" button when results are empty.
2. Button opens AppRequestModal; passes the search query as a pre-filled app name.
3. Unauthenticated users see the sign-in prompt inside the modal.

### Phase 4 — Tests

1. Vitest unit test for AppRequestModal (render states, form validation).
2. Playwright E2E: authenticated user requests an app from no-results → sees confirmation.
3. Playwright E2E: unauthenticated user clicks request → sees sign-in prompt.
4. Playwright E2E: rate limit (429) → user-friendly message shown.

### Phase 5 — Final checks

- `npm run lint` clean.
- All Vitest tests pass.
- No TypeScript errors.
- No regressions on existing search/browse pages.

## Build order rationale

API client + hook first → modal depends on mutation. Modal before integration → SearchResults depends on the modal component. Tests after integration → tests the full path. This task is lighter than TASK-0028 since the API route already supports APP_REQUEST type — no backend changes needed.

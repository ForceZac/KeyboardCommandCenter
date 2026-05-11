# Plan: TASK-0028 — Submission Form UI — New Shortcut & Key Recorder

**Branch:** goals/28-submission-form-ui
**Task:** TASK-0028
**PRD:** research/agents/prds/goal-08-community-contributions.md (Flows 1 & 6)

---

## Work breakdown

### Phase 1 — API: Duplicate check endpoint
1. Add `ShortcutService.checkDuplicate(appId, platform, keyCombo)` — queries for exact match on app + platform + key combo (case-insensitive) and fuzzy matches on command name similarity.
2. Create `GET /api/shortcuts/check-duplicate` route — accepts `appId`, `platform`, `keyCombo` query params; returns `{ exact: ShortcutEntry | null, fuzzy: ShortcutEntry[] }`.
3. Vitest unit test for the service method.

### Phase 2 — Component: KeyRecorder
1. Create `packages/web/components/KeyRecorder.tsx` — client component.
2. Captures `keydown` events when focused; normalizes modifier names to database conventions (Ctrl/Cmd, Shift, Alt/Option); displays formatted key combo string.
3. Clear button to reset the recorded combo.
4. Vitest unit test for key normalization logic (pure function, exported separately).

### Phase 3 — Hook + API client: submission mutation + duplicate check
1. Add `submitShortcut(payload)` to `lib/api.ts` — POST /api/submissions.
2. Add `checkDuplicate(appId, platform, keyCombo)` to `lib/api.ts` — GET /api/shortcuts/check-duplicate.
3. Create `hooks/useSubmitShortcut.ts` — TanStack Query `useMutation` wrapping `submitShortcut`.
4. Create `hooks/useDuplicateCheck.ts` — debounced TanStack Query `useQuery` wrapping `checkDuplicate`. Fires on key combo change with 200ms debounce.

### Phase 4 — Component: SubmitShortcutModal
1. Create `packages/web/components/SubmitShortcutModal.tsx` — client component using shadcn/ui Dialog.
2. Fields: command name (text, required, max 100 chars), key combo (KeyRecorder, required), platform (dropdown: Windows/macOS/Linux/All), context/scope (text, optional), notes (textarea, optional).
3. Inline duplicate detection warnings: exact match warning with existing command name + link to correction flow; fuzzy match softer hint.
4. On submit: calls `useSubmitShortcut` mutation; shows confirmation on success; shows user-friendly message on 429; does not block on duplicate warnings.
5. Unauthenticated state: show sign-in prompt instead of form fields when user is not logged in.

### Phase 5 — Integration: "Submit a shortcut" button on AppPageClient
1. Add `SubmitShortcutModal` to `AppPageClient.tsx`.
2. "Submit a shortcut" button above the shortcut list.
3. Button opens the modal; passes `appId` down to the modal so the form is pre-scoped to the current app.
4. Unauthenticated users who click the button see the sign-in prompt inside the modal.

### Phase 6 — E2E tests
1. Playwright test: authenticated user submits a new shortcut → sees confirmation.
2. Playwright test: unauthenticated user clicks button → sees sign-in prompt.
3. Playwright test: rate limit error → user-friendly message shown (mock 429).

### Phase 7 — Final checks
- `npm run lint` clean.
- All Vitest tests pass.
- No TypeScript errors.

## Build order rationale

API first → components depend on known endpoint shape. KeyRecorder standalone → SubmitShortcutModal depends on it. Hooks before modal → modal depends on mutation hook. Integration last → brings everything together. E2E after integration → tests the full path.

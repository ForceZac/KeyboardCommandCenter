# TRD: Submission Form UI — New Shortcut & Key Recorder

**Task:** TASK-0028
**Branch:** goals/28-submission-form-ui
**PRD:** research/agents/prds/goal-08-community-contributions.md
**Date:** 2026-05-11

---

## What we're building

TASK-0027 shipped the `Submission` data model and `POST /api/submissions` route. This task builds the user-facing side of that API: a "Submit a shortcut" button on every per-app shortcut page, a modal form with a custom key recorder input, and client-side duplicate detection that warns users before they submit a duplicate. The key recorder captures actual keystrokes and normalizes modifier names to match database conventions, solving the formatting inconsistency problem described in the PRD. PRD Flows 1 and 6 define the full user experience.

---

## Technical components needed

**New backend components:**

- `ShortcutService.checkDuplicate(appId, platform, keyCombo)` — service method that queries for exact match (same app + platform + key combo, case-insensitive) and fuzzy matches (same command name similarity for the same app). Returns `{ exact: ShortcutEntry | null, fuzzy: ShortcutEntry[] }`. Needed to power the <200ms client-side duplicate check.
- `GET /api/shortcuts/check-duplicate` — lightweight route accepting `appId`, `platform`, `keyCombo` query params. Delegates to the new service method. No auth required (reads public data). Needed so the browser can check for duplicates without submitting the full form.

**New frontend components:**

- `KeyRecorder` — client component that captures `keydown` events when focused, normalizes modifier key names to database conventions (`Ctrl`/`Cmd`, `Shift`, `Alt`/`Option`), and displays the formatted combo string. Exports a pure `normalizeKeyCombo(event)` function separately so it can be unit-tested without a DOM. Includes a clear button. Reused by TASK-0030 (correction form) per PRD recommendation.
- `SubmitShortcutModal` — client component wrapping a shadcn/ui Dialog. Contains the submission form (command name, KeyRecorder, platform dropdown, context, notes), inline duplicate warnings (exact + fuzzy), confirmation state on success, 429 error state, and a sign-in prompt for unauthenticated users. Receives `appId` and `appName` as props from the parent page.

**Modified frontend components:**

- `AppPageClient` — add "Submit a shortcut" button to the controls row; mount `SubmitShortcutModal` with the current app's `id` and `name`; pass session state down so the modal can detect unauthenticated users. No other changes.

**New hooks:**

- `useSubmitShortcut` — TanStack Query `useMutation` wrapping `POST /api/submissions` via the existing `apiMutate` in `lib/api.ts`. Handles success and error states for the modal.
- `useDuplicateCheck` — TanStack Query `useQuery` wrapping `GET /api/shortcuts/check-duplicate`. Enabled only when `keyCombo`, `appId`, and `platform` are all non-empty. Debounced via a 200ms timeout on the key combo value before the query fires (useDebounce pattern inside the hook).

**New API client functions (lib/api.ts):**

- `submitShortcut(payload: SubmissionCreatePayload)` — POST /api/submissions, returns `ISubmission`.
- `checkDuplicate(appId, platform, keyCombo)` — GET /api/shortcuts/check-duplicate, returns `{ exact: ShortcutEntry | null, fuzzy: ShortcutEntry[] }`.

**Schema changes:**

No schema changes — `Submission` model and `ShortcutKeyStep` table were added in TASK-0027. The `checkDuplicate` query reads from existing `Shortcut` and `ShortcutKeyStep` tables.

**API changes:**

- New: `GET /api/shortcuts/check-duplicate?appId=&platform=&keyCombo=` — returns duplicate match results. Authenticated or not (reads public shortcut data).

---

## Key architectural decisions

- **Custom KeyRecorder, no third-party library** — the PRD explicitly recommends a custom implementation using `keydown` listeners. The normalization logic is a pure function and fully testable in Vitest without a DOM.
- **shadcn/ui Dialog for the modal** — consistent with existing shadcn/ui usage in the codebase (FavoriteToggle, UserMenu). No new UI primitives needed.
- **Separate check-duplicate endpoint** — reusing the full-text `/api/shortcuts/search` would be semantically wrong and potentially slower. A dedicated endpoint with an indexed Prisma query on `appId + platform + keyCombo` can reliably hit <200ms.
- **Debounce inside useDuplicateCheck hook** — keeps the component clean; the hook owns the timing. 200ms matches the PRD performance requirement.
- **Duplicate warnings are non-blocking** — per PRD: the user can submit even if a duplicate is detected. Warnings are informational only.
- **Sign-in prompt inside the modal** — the button is always visible (encouraging discovery), but clicking it when unauthenticated shows the auth prompt inline rather than navigating away. Consistent with how `FavoriteToggle` handles unauthenticated state.
- **`appId` passed as prop** — `AppPageClient` already receives the full `AppDetail` object from the server component; it passes `app.id` and `app.name` down to the modal. No additional data fetching needed.

---

## Test coverage plan

- **E2E (Playwright):**
  - Authenticated user: opens modal → fills form with KeyRecorder → submits → sees confirmation message
  - Unauthenticated user: clicks "Submit a shortcut" → sees sign-in prompt inside modal
  - Rate limit: mock 429 response → user sees friendly error message (not a raw error)
  - Duplicate detection: entering a known key combo → exact match warning appears within 200ms

- **Vitest unit tests:**
  - `normalizeKeyCombo` pure function — tests for Ctrl/Cmd, Shift, Alt/Option on Windows and macOS, modifier-only combos, single keys
  - `ShortcutService.checkDuplicate` — exact match found, no match, fuzzy match returned

- **No snapshot tests** — per frontend standards.

---

## Out of scope (technical)

- Correction form and "Suggest edit" icon (TASK-0030 — depends on KeyRecorder from this task)
- App request form on the no-results page (TASK-0031)
- Admin review queue UI (TASK-0029)
- Contributor profile page (TASK-0032)
- Server-side duplicate detection (already shipped in TASK-0027 — the `SubmissionsService.create` method)
- Mobile-optimized key recorder (PRD explicitly out of scope)
- In-app notification system (separate goal)

---

## Risks and open questions

- **KeyRecorder focus management:** The recorder must intercept `keydown` events only when focused and must not conflict with browser shortcuts (e.g. Ctrl+W closes the tab). We will call `event.preventDefault()` only for specific modifier+key combos captured inside the recorder; single-key events without modifiers will not be captured to avoid blocking text input elsewhere.
- **`keyCombo` format in checkDuplicate:** The existing database stores key combos as strings (e.g. `"Ctrl+Shift+P"`). The normalization function must produce the exact same format used in seeded data. We will read a sample from the existing `ShortcutKeyStep` table to confirm the convention before finalizing normalization logic.
- **Session availability in AppPageClient:** `AppPageClient` is a client component. It will use NextAuth's `useSession()` hook to determine auth state for the sign-in prompt. This hook is already used elsewhere (UserMenu, FavoriteToggle) via the SessionProvider already mounted in `app/providers.tsx`.

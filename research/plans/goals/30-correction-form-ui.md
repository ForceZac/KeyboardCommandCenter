# Plan: TASK-0030 — Correction Form UI

**Task:** TASK-0030
**Branch:** goals/30-correction-form-ui
**PRD:** research/agents/prds/goal-08-community-contributions.md (Flow 2)

---

## Work breakdown

### Phase 1: CorrectionModal component
Create `packages/web/components/CorrectionModal.tsx` — a modal form for submitting corrections to existing shortcuts. Modeled after `SubmitShortcutModal` but:
- Accepts a `shortcut: ShortcutEntry` prop plus `appId`, `appName`, and initial `platform`
- Pre-fills command, key combo, platform, and context from the shortcut data
- Includes a "Reason for correction" textarea (maps to `notes` in submission data)
- Submits via `useSubmitShortcut` with `type: 'CORRECTION'` and `shortcutId`
- Shows sign-in prompt for unauthenticated users
- Handles 429 rate limit with friendly message
- Shows confirmation on success

### Phase 2: Wire "Suggest edit" into ShortcutRow
Modify `ShortcutRow` to accept an optional `onSuggestEdit` callback. When provided, render a pencil icon button that appears on hover (like FavoriteToggle). Clicking calls `onSuggestEdit(shortcut)`.

### Phase 3: Wire ContextGroup to forward callback
Add `onSuggestEdit` prop to `ContextGroup` and pass it through to each `ShortcutRow`.

### Phase 4: Wire AppPageClient to manage correction state
Add correction modal state to `AppPageClient`:
- `correctionTarget: ShortcutEntry | null` state
- Pass `onSuggestEdit` callback through `ContextGroup` → `ShortcutRow`
- Render `CorrectionModal` with the target shortcut

### Phase 5: Tests
- Vitest integration tests for CORRECTION submission via POST /api/submissions
- Playwright E2E tests:
  - "Suggest edit" icon visible on shortcut row hover
  - Correction form opens pre-filled
  - Submit creates CORRECTION submission
  - Unauthenticated user sees sign-in prompt
  - Rate limit error displays friendly message

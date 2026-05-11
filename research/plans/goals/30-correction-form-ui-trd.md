# TRD: Correction Form UI — Suggest Edit & Pre-filled Submission

**Task:** TASK-0030
**Branch:** goals/30-correction-form-ui
**PRD:** research/agents/prds/goal-08-community-contributions.md
**Date:** 2026-05-11

---

## What we're building

A "Suggest edit" button on each shortcut row in per-app pages that opens a correction form pre-filled with the existing shortcut's data. The form lets authenticated users submit corrections to shortcuts (updated key combo, command name, platform, or context) via the existing `POST /api/submissions` endpoint with `type: CORRECTION`. This implements PRD Flow 2 (Submitting a correction).

The backend infrastructure already supports CORRECTION submissions (TASK-0027 shipped the data model and API, including `shortcutId` validation). This task is purely frontend — no new API routes, no schema changes.

## Technical components needed

**New frontend components:**
- `CorrectionModal` — modal form for editing an existing shortcut's data and submitting a CORRECTION. Structurally similar to the existing `SubmitShortcutModal` (TASK-0028) but pre-fills fields from the target shortcut and sends `type: 'CORRECTION'` with `shortcutId`. Reuses the existing `KeyRecorder` component for key combo editing and `useSubmitShortcut` hook for the mutation.

**Modified frontend components:**
- `ShortcutRow` — add an optional `onSuggestEdit` callback prop. When provided, renders a pencil icon button (hover-visible, same pattern as `FavoriteToggle`) that triggers the callback with the shortcut data.
- `ContextGroup` — add `onSuggestEdit` prop passthrough to forward the callback from `AppPageClient` to each `ShortcutRow`.
- `AppPageClient` — manage correction modal state (`correctionTarget: ShortcutEntry | null`). Wire the `onSuggestEdit` callback through `ContextGroup` to `ShortcutRow`. Render `CorrectionModal` with the selected shortcut, passing `appId`, `appName`, and current platform.

**Schema changes:**
No schema changes. The `Submission` model already supports `type: CORRECTION` with `shortcutId` (shipped in TASK-0027).

**API changes:**
No new endpoints. `POST /api/submissions` already validates and stores CORRECTION submissions. The `data` JSON field stores the corrected values (command, keyCombo, key, modifiers, platform, context, notes).

## Key architectural decisions

- **Single modal instance at AppPageClient level** rather than one per ShortcutRow — avoids rendering hundreds of modal instances on pages with many shortcuts. The selected shortcut is lifted into state and passed down.
- **Reusing useSubmitShortcut hook** — the existing mutation hook and `submitShortcut` API client function are type-agnostic (they accept any `SubmissionCreatePayload`). No new hook needed for corrections.
- **No duplicate detection for corrections** — unlike new shortcut submissions, corrections target an existing shortcut by ID. The `useDuplicateCheck` hook is not needed since the user is editing, not creating.
- **Pre-filling from the selected platform binding** — the correction form pre-fills the key combo from whichever platform binding is currently displayed (matching the platform toggle selection). The user can change the platform in the form if needed.
- **Hover-reveal pattern for the pencil icon** — matches the existing FavoriteToggle heart icon behavior (`opacity-0 group-hover:opacity-100`). Keeps the shortcut row clean at rest.

## Test coverage plan

- **Vitest integration tests:** CORRECTION submission through `POST /api/submissions` with `shortcutId` — verify the submission is created with correct type and linked to the target shortcut. (Supplements existing tests in `SubmissionsService.test.ts`.)
- **Playwright E2E tests:**
  - "Suggest edit" icon appears on shortcut row hover in a per-app page
  - Clicking the icon opens the correction modal with pre-filled data
  - Submitting creates a CORRECTION-type submission (verify via API or confirmation message)
  - Unauthenticated user sees sign-in prompt instead of the form
  - Rate limit (429) displays a user-friendly error message

## Out of scope (technical)

- Admin review of corrections (TASK-0029, already shipped)
- Diff view rendering in the admin queue (already handled by TASK-0029's `originalShortcut` field)
- Key recorder component implementation (TASK-0028, already shipped — reused here)
- Server-side duplicate detection for corrections (not needed — corrections target a specific shortcut by ID)
- New shortcut submission form (TASK-0028, already shipped)
- Notification to contributor on approval/rejection (future task)

## Risks and open questions

- **ShortcutRow becomes a client component** — adding the `onSuggestEdit` callback and pencil button with hover state requires interactivity. `ShortcutRow` is currently a server component (no `'use client'` directive). However, it's already rendered inside `AppPageClient` (a client component), so React treats it as a client component at runtime anyway. Adding `'use client'` explicitly won't change behavior but will make it clear. The icon uses `dynamic()` import (same pattern as `FavoriteToggle`) to avoid pulling in session deps for the icon itself.
- **Platform binding selection for pre-fill** — if the user's selected platform has no binding for the shortcut (fallback case), the form pre-fills with the fallback platform's data. The user can correct the platform in the form. This matches the existing display behavior in `ShortcutRow`.

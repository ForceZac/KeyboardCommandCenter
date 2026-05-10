# Plan: TASK-0020 — Overlay Detection Integration & App-Switch Content Updates

**Branch:** goals/20-overlay-detection-integration
**PRD:** research/agents/prds/goal-06-overlay-mode.md
**TRD:** research/plans/goals/20-overlay-detection-integration-trd.md

---

## Context

TASK-0017 (Overlay BrowserWindow — approved, not yet merged) creates the overlay window and forwards
`detection:app-changed` events from the detection service to the overlay renderer. TASK-0018 (merged)
built the renderer components that display shortcuts in `loaded` and `unrecognized` states.

TASK-0020 fills the remaining gaps:

1. The detection service does not emit when `getActiveWindow()` returns null — the overlay stays
   stuck in whatever its last state was rather than showing "No app detected".
2. The overlay renderer (TASK-0018) has no `'no-detection'` state.
3. The overlay BrowserWindow has no event buffer — detection events that arrive before the renderer
   finishes loading are silently dropped.
4. During transitions between two recognized apps there is a brief gap while the async
   `getShortcutsForApp` call resolves; the renderer should keep the previous content visible until
   the new data lands (prefetch cache makes this fast, but the gap is non-zero in the first load).

## Dependency note

Phase 3 (ready-state guard) modifies `overlay-window.ts`, which is introduced by TASK-0017. This
file does not exist on `main` yet. Phases 1 and 2 can be built and pushed on a branch from `main`
immediately. Phase 3 must be added after TASK-0017 merges (rebase this branch onto updated `main`).

---

## Work breakdown

### Phase 1 — Detection service: emit on "no active window"

**File:** `packages/desktop/src/detection.ts`

- In `tick()`: when `getActiveWindowFn()` returns null AND `lastDetected` was previously non-null,
  emit `detection:app-changed` with `{ appSlug: null, processName: '', windowTitle: '' }` and clear
  `lastDetected`. This allows the overlay (and panel) to react to the user reaching the desktop or
  minimizing all windows.
- Update `detection.test.ts` with cases:
  - transition from recognized app → null window → emits no-detection payload
  - null window on first tick → does not emit (nothing to clear)
  - null window when already null → does not emit a second time

### Phase 2 — Overlay renderer: no-detection state and flash prevention

**Files:** `packages/overlay/src/`

Step 2a — `types.ts`
- Add `'no-detection'` to `OverlayStatus` union.

Step 2b — `components/NoDetection.tsx` (new file)
- Muted "No app detected" message, same low-opacity style as `NoShortcuts`.

Step 2c — `hooks/useOverlayData.ts`
- Treat `processName === ''` (empty string) as the no-detection signal → set status to
  `'no-detection'`, clear `appDetail` and `processName`.
- Flash prevention: when a new event arrives with a recognized slug, do not clear the current
  `appDetail` immediately; keep the previous state until the `getShortcutsForApp` promise resolves.
  Only then update state in one atomic `setState` call. This prevents a blank frame between apps.
- Add tests to `hooks/__tests__/useOverlayData.test.ts`:
  - empty processName → no-detection status
  - recognized → recognized transition does not flash blank
  - unrecognized → recognized transition (previous content stays until new data)

Step 2d — `App.tsx`
- Add a render branch for `status === 'no-detection'` that renders `<NoDetection />` inside the
  shared `containerStyle` div.

### Phase 3 — Ready-state guard in OverlayWindowManager

**File:** `packages/desktop/src/overlay-window.ts` (introduced by TASK-0017 — requires merge first)

- Add a `private lastDetectionPayload: unknown = null` field to `OverlayWindowManager`.
- In `sendToRenderer()`: when `channel === 'detection:app-changed'`, always update
  `lastDetectionPayload` with the payload, regardless of whether the window exists yet.
- After `loadFile()` resolves (or on `did-finish-load`): if `lastDetectionPayload` is not null,
  send it to the renderer. This ensures the overlay shows the correct app on first render even if
  the detection event fired while the window was still loading.
- Add a test to the overlay-window test suite for this replay behavior.

### Phase 4 — Final wiring verification and E2E test

- Manual verification (dev mode): open overlay, switch between apps, verify content updates,
  verify "No app detected" appears when minimizing all windows.
- Playwright E2E: overlay content updates within 200ms of app-changed event — drive via IPC mock
  in the test harness.

---

## File checklist

| File | Change |
|------|--------|
| `packages/desktop/src/detection.ts` | emit on null-window transition |
| `packages/desktop/src/detection.test.ts` | new test cases |
| `packages/desktop/src/overlay-window.ts` | lastPayload buffer + replay (Phase 3, post-TASK-0017 merge) |
| `packages/overlay/src/types.ts` | add `'no-detection'` |
| `packages/overlay/src/components/NoDetection.tsx` | new |
| `packages/overlay/src/hooks/useOverlayData.ts` | no-detection + flash prevention |
| `packages/overlay/src/hooks/__tests__/useOverlayData.test.ts` | new test cases |
| `packages/overlay/src/App.tsx` | no-detection render branch |

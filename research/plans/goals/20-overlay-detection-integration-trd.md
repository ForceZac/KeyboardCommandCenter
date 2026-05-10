# TRD: Overlay Detection Integration & App-Switch Content Updates

**Task:** TASK-0020
**Branch:** goals/20-overlay-detection-integration
**PRD:** research/agents/prds/goal-06-overlay-mode.md
**Date:** 2026-05-10

---

## What we're building

TASK-0017 (approved, pending merge) creates the overlay BrowserWindow and wires it to the detection
service — `emitToRenderer` in `main.ts` now calls both `panelManager.sendToRenderer()` and
`overlayManager.sendToRenderer()`. TASK-0018 (shipped) built the overlay renderer with `useOverlayData`
subscribing to `window.kccOverlay.onAppChanged`, plus components for `loaded` and `unrecognized`
states.

TASK-0020 completes the integration by closing three remaining gaps the PRD requires:

1. **No-detection signal** — The detection service's `tick()` returns early when `getActiveWindow()`
   yields null. Nothing is emitted, so the overlay freezes at its last state instead of showing "No
   app detected" (PRD Flow 3/5 requirement). We add a null-window emission from the detection
   service and handle it in the overlay renderer.

2. **Overlay ready-state guard** — `OverlayWindowManager.sendToRenderer()` silently drops events
   when the BrowserWindow is loading (`loadFile` is async). A detection event that fires during that
   window can result in the overlay showing stale or no content on first display. We buffer the last
   payload and replay it on `did-finish-load`.

3. **Flash-free app transitions** — `useOverlayData` transitions immediately on the arrival of a new
   `app-changed` event. For a transition between two recognized apps, there is a short async gap
   while `getShortcutsForApp` resolves (even from the prefetch cache, this is non-zero). We defer
   the state update until new data arrives so the overlay never shows a blank frame.

---

## Technical components needed

### Modified backend components

- **`packages/desktop/src/detection.ts`** — `DetectionService.tick()` needs a new branch: when
  `getActiveWindowFn()` returns null and `lastDetected` is non-null, emit
  `detection:app-changed` with `{ appSlug: null, processName: '', windowTitle: '' }` and clear
  `lastDetected`. The empty `processName` is the agreed sentinel for "no active window" (as
  distinct from `processName` being a real name with `appSlug: null` for unrecognized apps).

- **`packages/desktop/src/overlay-window.ts`** _(TASK-0017 new file — requires merge before
  this task can build Phase 3)_ — Add a `lastDetectionPayload` private field to
  `OverlayWindowManager`. Update `sendToRenderer()` to capture the payload whenever
  `channel === 'detection:app-changed'`. In `getOrCreateWindow()`, hook into `did-finish-load` to
  replay `lastDetectionPayload` if non-null. This ensures the overlay renderer receives the current
  app state even when the detection event predates window load.

### Modified overlay components

- **`packages/overlay/src/types.ts`** — Add `'no-detection'` to the `OverlayStatus` union. The
  empty `processName` sentinel from the detection service maps to this status in the hook.

- **`packages/overlay/src/hooks/useOverlayData.ts`** — Two changes:
  - Treat `processName === ''` as `'no-detection'` (clear `appDetail`, set `processName` to `''`).
  - Flash prevention: when a new event arrives for a recognized slug, do not clear state before the
    `getShortcutsForApp` promise resolves. Hold the previous `appDetail` until the new data is
    ready, then do a single atomic `setState`. The overlay continues displaying the old app's
    content (not a blank frame) while the async call completes.

- **`packages/overlay/src/App.tsx`** — Add a render branch for `status === 'no-detection'` that
  renders `<NoDetection />` inside the shared container div (same opacity and position as other
  states).

### New overlay components

- **`packages/overlay/src/components/NoDetection.tsx`** — Stateless component rendering a muted
  "No app detected" message. Mirrors the low-opacity style of `NoShortcuts.tsx` for visual
  consistency.

### Schema changes

No schema changes.

### API changes

No new endpoints. The existing `detection:app-changed` IPC channel and
`shortcuts:get-by-app` IPC handler are sufficient. The `processName === ''` payload is a convention
within the existing channel rather than a new channel.

---

## Key architectural decisions

- **Empty `processName` as no-detection sentinel** — Rather than adding a new IPC channel or a
  separate boolean field to `DetectionPayload`, we reuse the existing shape: `appSlug: null,
  processName: ''`. The overlay (and panel, if it ever checks) can distinguish "no active window"
  from "unrecognized app" by testing `processName === ''`. This keeps the payload type stable and
  avoids modifying the `DetectionPayload` interface shared across packages.

- **Buffering in `OverlayWindowManager`, not in the detection service** — The ready-state problem
  is specific to the overlay's lazy window creation. The panel uses an eagerly created window and
  does not have this issue. Rather than adding buffering to the detection service (which would
  affect the panel too), we isolate the fix to `OverlayWindowManager`.

- **Atomic state update to prevent flash** — The flash fix is in `useOverlayData`, not in the
  main process. The prefetch cache means `getShortcutsForApp` nearly always returns from memory
  (< 5ms). The fix handles the rare case (first detection of a new app slug not yet cached) cleanly
  at the React state layer without adding complexity to main-process event routing.

- **No changes to `DetectionPayload` type** — `processName` is already typed as `string` (not
  `string | null`), so the empty-string sentinel does not require a type change and remains
  backward compatible with panel consumers.

---

## Test coverage plan

- **`detection.test.ts`** — Unit tests for the null-window emission: (a) transition from detected
  app to null window emits the no-detection payload; (b) null on the very first tick (nothing
  previously detected) does not emit; (c) consecutive null ticks emit only once (no duplicate
  events after `lastDetected` is cleared).

- **`hooks/__tests__/useOverlayData.test.ts`** — New cases: (a) empty `processName` → no-detection
  status; (b) transition recognized → recognized holds previous `appDetail` until new data resolves;
  (c) transition unrecognized → recognized also holds state.

- **`packages/desktop/src/__tests__/overlay-window.test.ts`** (or equivalent) — Test that
  `sendToRenderer` with `detection:app-changed` updates `lastDetectionPayload`, and that a
  `did-finish-load` event causes the buffered payload to be sent to the renderer.

---

## Out of scope (technical)

- Drag-to-reposition and free-form resizing (PRD explicitly defers to v2)
- Full-screen app detection (PRD recommends hiding overlay over fullscreen — deferred)
- Scroll within the overlay for apps with many shortcuts
- Live opacity preview (overlay prefs changes are wired in TASK-0019)
- Panel fallback states (TASK-0016)
- Linux/Wayland support

---

## Risks and open questions

- **TASK-0017 not yet merged**: Phase 3 (`overlay-window.ts` modifications) cannot be built until
  TASK-0017 merges. Phases 1 and 2 (detection service + overlay renderer) can be committed and
  pushed to this branch from `main` immediately. The branch will need rebasing onto updated `main`
  after TASK-0017 merges before Phase 3 work begins.

- **Panel reaction to empty `processName`**: The panel's `useActiveApp` hook (renderer-side) also
  subscribes to `detection:app-changed`. The empty-processName payload will reach the panel too.
  The panel should degrade gracefully (empty string resolves to the no-shortcuts fallback state,
  which TASK-0016 handles). This is not a blocker for TASK-0020 but should be verified during
  manual testing.

- **E2E test environment**: Playwright tests that verify overlay content updates require driving
  IPC events in the Electron test harness. If the existing test setup does not support this,
  unit tests for `useOverlayData` plus manual verification in dev mode will be the primary proof.

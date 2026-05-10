# Plan: TASK-0019 — Overlay Settings UI Section

**Branch:** goals/19-overlay-settings-ui
**PRD:** research/agents/prds/goal-06-overlay-mode.md
**TRD:** research/plans/goals/19-overlay-settings-ui-trd.md
**Date:** 2026-05-10

---

## Work Breakdown

### Phase 1: Store Layer
1. Extend `packages/desktop/src/settings.ts` with overlay prefs namespace
   - Expand `SettingsSchema` with `overlay` sub-schema (enabled, hotkey, opacity, position, size)
   - Add `getOverlayPrefs()` aggregate getter
   - Add individual setters: `setOverlayEnabled`, `setOverlayHotkey`, `setOverlayOpacity`, `setOverlayPosition`, `setOverlaySize`
   - Export `OverlayPrefs` type for use across main process and preload

### Phase 2: IPC Bridge
2. Extend `packages/desktop/src/settings-preload.ts`
   - Add `overlay` sub-namespace to `window.kccSettings`
   - Expose: `getOverlay()`, `setEnabled(bool)`, `setHotkey(acc)`, `setOpacity(num)`, `setPosition(str)`, `setSize(str)`
3. Update `packages/desktop/src/renderer/kccSettings.d.ts`
   - Add `OverlayPrefs` interface and `overlay` property on `KccSettingsAPI`

### Phase 3: Main Process IPC Handlers
4. Register `ipcMain.handle` calls in `packages/desktop/src/main.ts`:
   - `overlay:get` → return `getOverlayPrefs()`
   - `overlay:set-enabled` → persist + call `overlayController?.setEnabled()`
   - `overlay:set-hotkey` → validate conflict vs panel hotkey, persist, call `overlayController?.setHotkey()`
   - `overlay:set-opacity` → persist + call `overlayController?.setOpacity()`
   - `overlay:set-position` → persist + call `overlayController?.setPosition()`
   - `overlay:set-size` → persist + call `overlayController?.setSize()`
5. Define `OverlayController` interface in `packages/desktop/src/overlay-controller.ts`
   - Interface only — actual implementation provided by TASK-0017's overlay window manager
   - Module exports an `overlayController` registry that TASK-0017 populates at startup

### Phase 4: Settings Window UI
6. Increase settings window height in `packages/desktop/src/settings-window.ts` (480×320 → 480×560)
7. Add Overlay section markup to `packages/desktop/src/renderer/settings.html`
   - Section after existing controls, headed "Overlay"
   - Enable toggle, hotkey input (record-on-click like panel hotkey), opacity slider (range 20–80), position dropdown, size toggle (Compact/Standard)
   - Conflict error span for hotkey
   - Section wrapped in `<fieldset id="overlay-section">` for easy enable/disable
8. Add Overlay section logic to `packages/desktop/src/renderer/settings.ts`
   - Load overlay prefs on page ready (alongside existing settings load)
   - Wire: enable toggle → `overlay:set-enabled`; hotkey record → `overlay:set-hotkey` (with conflict inline error); opacity slider input → `overlay:set-opacity`; position select → `overlay:set-position`; size radio → `overlay:set-size`
   - Disable fieldset when overlay feature unavailable (overlayPrefs returns null or disabled=true while window absent)

### Phase 5: Tests
9. Unit tests in `packages/desktop/src/__tests__/overlay-settings.test.ts`
   - Overlay store: getter returns correct defaults; setters persist values
   - Hotkey conflict logic: same as panel hotkey → returns conflict=true
   - IPC handler: overlay:get returns defaults; overlay:set-opacity validates range (20–80)

### Phase 6: Verification
10. `npm run test -w packages/desktop` → all tests pass
11. `npm run lint` → clean
12. `tsc --noEmit` → no errors

---

## What Remains After This Task

- TASK-0017: Creates the overlay BrowserWindow, instantiates the OverlayController, populates the registry — the live preview and hotkey registration become functional
- TASK-0016: Panel fallback states (independent of overlay)

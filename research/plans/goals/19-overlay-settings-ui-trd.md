# TRD: Overlay Settings UI Section

**Task:** TASK-0019
**Branch:** goals/19-overlay-settings-ui
**PRD:** research/agents/prds/goal-06-overlay-mode.md
**Date:** 2026-05-10

---

## What we're building

The existing Settings window (480×320, launched from the tray) has two controls: Global Hotkey and Start on Login. TASK-0019 adds a third section — "Overlay" — that exposes all five overlay-mode preferences to the user: enable toggle, overlay hotkey, opacity slider, position preset dropdown, and size toggle. The section maps directly to PRD Flows 1 and 4 (enabling overlay mode and adjusting overlay position/opacity). All preferences are persisted to `electron-store` and survive app restart. When the overlay window is visible, opacity and position changes take effect in real time (live preview). The enable toggle registers or unregisters the overlay global hotkey. Assigning the same key combo as the panel hotkey is rejected with an inline error.

This task also defines the `electron-store` overlay preferences schema and the `OverlayController` interface contract. TASK-0017 (overlay BrowserWindow) will implement that interface when it runs; until then, store reads/writes function correctly and live preview is a no-op.

---

## Technical components needed

**Modified backend components:**

- `packages/desktop/src/settings.ts` — Extend `SettingsSchema` with `overlay` sub-object (`enabled: boolean`, `hotkey: string`, `opacity: number`, `position: string`, `size: string`) and their electron-store defaults. Add `getOverlayPrefs()` aggregate getter and five individual setters. Export `OverlayPrefs` type.

- `packages/desktop/src/main.ts` — Register six `ipcMain.handle` handlers for the `overlay:*` namespace. The `overlay:set-enabled`, `overlay:set-opacity`, `overlay:set-position`, and `overlay:set-size` handlers persist the pref and then call the matching method on `overlayController` if it is non-null. The `overlay:set-hotkey` handler validates that the proposed accelerator does not match the current panel hotkey before persisting.

**New backend components:**

- `packages/desktop/src/overlay-controller.ts` — Defines the `OverlayController` interface (methods: `setEnabled`, `setHotkey`, `setOpacity`, `setPosition`, `setSize`) and exports a singleton registry (`overlayController: OverlayController | null`, `registerOverlayController(c: OverlayController): void`). TASK-0017 calls `registerOverlayController` at startup when the overlay BrowserWindow is created; TASK-0019's IPC handlers check `overlayController !== null` before calling through.

**Modified frontend components (settings renderer):**

- `packages/desktop/src/renderer/settings.html` — Add an `<section id="overlay-section">` block after the existing settings rows. Contains: enable toggle (`<input type="checkbox" id="overlay-enabled">`), hotkey recorder (`<button id="overlay-hotkey-btn">` + `<span id="overlay-hotkey-display">` + `<span id="overlay-hotkey-error">`), opacity slider (`<input type="range" min="20" max="80" id="overlay-opacity">`), position dropdown (`<select id="overlay-position">` with six preset options), and size radio group (`<input type="radio" name="overlay-size">`for Compact/Standard).

- `packages/desktop/src/renderer/settings.ts` — Load overlay prefs alongside existing settings on page ready. Wire all five controls to their respective `overlay:set-*` IPC calls. Reuse the existing accelerator recording pattern (keyboard capture → `eventToAccelerator`) for the overlay hotkey input. Show an inline error on `overlay-hotkey-error` when the returned result includes `conflict: true`. Opacity slider fires on the `input` event for real-time updates; position and size fire on `change`.

- `packages/desktop/src/settings-preload.ts` — Add an `overlay` sub-object to the existing `window.kccSettings` exposure: `getOverlay()`, `setEnabled(bool)`, `setHotkey(acc)`, `setOpacity(num)`, `setPosition(str)`, `setSize(str)`.

- `packages/desktop/src/renderer/kccSettings.d.ts` — Add `OverlayPrefs` interface and `overlay: { getOverlay(): Promise<OverlayPrefs>; setEnabled(e: boolean): Promise<void>; setHotkey(acc: string): Promise<{ success: boolean; conflict: boolean; message: string }>; setOpacity(o: number): Promise<void>; setPosition(p: string): Promise<void>; setSize(s: string): Promise<void>; }` to `KccSettingsAPI`.

**Modified infrastructure:**

- `packages/desktop/src/settings-window.ts` — Increase window height from 320 to 560 to accommodate the new overlay section without scrolling.

**Schema changes:**

No new database tables. The `electron-store` schema gains an `overlay` namespace:

- `overlay.enabled` (boolean, default `false`) — whether overlay mode is active
- `overlay.hotkey` (string, default `"Ctrl+Shift+O"` on Windows / `"Cmd+Shift+O"` on macOS) — overlay toggle accelerator
- `overlay.opacity` (number, default `0.4`) — overlay background opacity (maps 20–80% slider to 0.2–0.8)
- `overlay.position` (string, default `"Top Right"`) — one of six preset positions
- `overlay.size` (string, default `"Standard"`) — `"Compact"` or `"Standard"`

**API changes (IPC channels, settings window ↔ main process):**

- `overlay:get` — no args → returns `OverlayPrefs`
- `overlay:set-enabled` — `{ enabled: boolean }` → `void`; side-effect: calls `overlayController?.setEnabled(enabled)` if non-null
- `overlay:set-hotkey` — `{ accelerator: string }` → `{ success: boolean; conflict: boolean; message: string }`; conflict when accelerator matches current panel hotkey
- `overlay:set-opacity` — `{ opacity: number }` (0.2–0.8) → `void`; side-effect: calls `overlayController?.setOpacity(opacity)`
- `overlay:set-position` — `{ position: string }` → `void`; side-effect: calls `overlayController?.setPosition(position)`
- `overlay:set-size` — `{ size: string }` → `void`; side-effect: calls `overlayController?.setSize(size)`

---

## Key architectural decisions

- **`OverlayController` interface + registry pattern** — The IPC handlers in `main.ts` need to reach the overlay BrowserWindow (which doesn't exist until TASK-0017 runs). Rather than importing a concrete class that may not exist, the handlers call through a nullable `overlayController` registry. TASK-0017 calls `registerOverlayController(manager)` at startup, making live preview functional from that point. Before TASK-0017 ships, prefs persist correctly; only the live forwarding is a no-op. This avoids circular imports and keeps TASK-0019 buildable and testable independently.

- **Overlay pref schema defined here** — TASK-0017's backlog scope includes defining overlay prefs in electron-store. Since TASK-0019 runs first (PM's ordering), the schema is defined in this task. The `OverlayPrefs` type and store keys are the canonical definition; TASK-0017 reads from the same keys without redefining them. A note is added to `proposals.md` so the PM is aware of the coordination requirement.

- **Hotkey conflict validation in main process** — The conflict check (overlay hotkey must not match panel hotkey) lives in the `overlay:set-hotkey` IPC handler, not the renderer. The renderer displays the result. This keeps validation logic server-side and testable.

- **Opacity slider maps percentage to float** — The `<input type="range">` exposes 20–80 (integers). The IPC layer divides by 100 before persisting and forwarding to the overlay window. The renderer receives the raw float from `overlay:get` and multiplies by 100 to set the slider value on load.

- **No new webpack entry point** — The overlay settings section is added to the existing `settings_window` webpack entry point. No new BrowserWindow, no new preload, no new HTML file. All changes are additive within the existing settings surface.

---

## Test coverage plan

- **Unit tests** (`packages/desktop/src/__tests__/overlay-settings.test.ts`):
  - Store: `getOverlayPrefs()` returns correct defaults; each setter round-trips through `getOverlayPrefs()`
  - Hotkey conflict: proposed accelerator equals current panel hotkey → `conflict: true`; different accelerator → `success: true`
  - Opacity range: value outside 0.2–0.8 is clamped before persisting

- **IPC handler tests** (same file, using `ipcMain.handle` mock pattern established by TASK-0012/0015 tests):
  - `overlay:get` returns defaults on fresh store
  - `overlay:set-opacity` persists clamped value and calls `overlayController.setOpacity` when controller is non-null
  - `overlay:set-enabled` passes `enabled: false` to controller

- No E2E tests for this task — the settings window is Electron-only and Playwright cannot drive it in the current CI setup (established precedent from prior tasks).

---

## Out of scope (technical)

- Overlay BrowserWindow creation, positioning, and memory budget (TASK-0017)
- Overlay hotkey global registration/unregistration infrastructure — `overlayController.setEnabled()` is the interface point; the implementation is TASK-0017's
- Overlay renderer content (TASK-0018, already shipped)
- Detection integration — overlay content update on app switch (separate task)
- Drag-to-reposition (PRD explicitly out of scope for v1)
- Free-form resize (PRD explicitly out of scope for v1)
- Linux/Wayland (Goal 10)

---

## Risks and open questions

1. **TASK-0017 dependency** — Live opacity/position preview and hotkey registration only function after TASK-0017's `OverlayController` implementation is registered. Acceptance criteria for "Enable toggle registers/unregisters overlay hotkey" and "Opacity slider updates overlay opacity in real time" cannot be verified in isolation — they require TASK-0017 to be merged first. The settings UI and store layer are fully testable without TASK-0017.

2. **Task ordering** — TASK-0019 precedes TASK-0017 in the Ready queue, but logically TASK-0017 should ship first. A note has been added to `proposals.md` flagging this ordering concern. The `OverlayController` registry pattern mitigates the dependency, but the PM should be aware.

3. **Settings IPC handlers** — TASK-0007 (Settings Persistence) is marked Shipped, but `main.ts` does not appear to contain `ipcMain.handle('settings:get', ...)` or the related handlers. If they are missing, the existing settings UI is broken independently of this task. This task does not fix that gap but notes it as a potential test-environment risk. The overlay IPC handlers use a separate `overlay:*` namespace and are unaffected.

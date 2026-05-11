# Plan: TASK-0033 — electron-updater Integration — Auto-Update Check & Notification

**Branch:** goals/33-electron-updater-auto-update
**TRD:** research/plans/goals/33-electron-updater-auto-update-trd.md
**PRD:** research/agents/prds/goal-09-auto-update-distribution.md

---

## Work breakdown

### Slice 1: Install electron-updater
Add `electron-updater` to `packages/desktop` dependencies.
- Add `electron-builder` config to `packages/desktop/package.json` (or a top-level `electron-builder.yml`) pointing at the GitHub provider with `ForceZac/KeyboardCommandCenter` as the repo.
- Confirm `electron-builder` is already in devDependencies or add it.

### Slice 2: UpdateService
Create `packages/desktop/src/update-service.ts` — wraps `electron-updater`.
- Constructor takes a `notify: (channel: string, payload: unknown) => void` callback (main process calls this to forward to settings window + tray).
- `start()`: registers `autoUpdater` event listeners, triggers initial `checkForUpdates()`, starts a 4-hour interval.
- `stop()`: clears the interval, removes listeners.
- `checkNow()`: calls `autoUpdater.checkForUpdates()` — returns current status.
- `restartAndInstall()`: calls `autoUpdater.quitAndInstall()`.
- `getStatus()`: returns current `UpdateStatus` (idle | checking | available | downloading | ready | error).
- Emits status changes back via `notify` callback so main process can push to renderer.
- `autoUpdater.autoDownload = true` — download silently in background.
- `autoUpdater.autoInstallOnAppQuit = true` — applies on next quit.
- Configure GitHub provider via `autoUpdater.setFeedURL` or rely on `electron-builder.yml` config.

### Slice 3: Wire into main.ts
- Instantiate `UpdateService` after tray/window setup (app.whenReady).
- Pass a `notify` callback that forwards events to `settingsWindowManager.sendToRenderer` and triggers tray menu refresh.
- Register IPC handlers: `update:get-status`, `update:check-now`, `update:restart-and-install`.
- On `update-downloaded` event: show a native tray balloon/notification ("Update available — will apply on next restart").
- Call `updateService.start()` after wiring.
- Call `updateService.stop()` in `before-quit`.

### Slice 4: TrayManager update
Add "Check for updates" item to the tray context menu.
- Constructor receives two new callbacks: `onCheckForUpdates: () => void` and `getUpdateStatus: () => UpdateStatus`.
- Menu item label: "Check for updates" (or "Update available — restart to apply" when status is `ready`).
- Clicking "Check for updates" calls `onCheckForUpdates()`.
- When status is `ready`, add a second menu item "Restart to update" that calls `onRestartAndInstall`.

### Slice 5: Settings preload + settings renderer
Expose `kccSettings.update` namespace in `settings-preload.ts`:
- `getStatus()`: IPC invoke `update:get-status`
- `checkNow()`: IPC invoke `update:check-now`
- `restartAndInstall()`: IPC invoke `update:restart-and-install`
- `onStatusChanged(cb)`: IPC on `update:status-changed`

Add version display + "Check for updates" section to `settings.html` and `settings.ts`:
- Show current version via `app.getVersion()` — exposed via a new IPC handler `app:get-version`.
- "Check for updates" button with status feedback label (idle / checking… / up to date / "Update v1.x available").
- "Restart to update" button (hidden until status is `ready`).

### Slice 6: Types
Add `UpdateStatus` type to `packages/core/src/types.ts` (or a local `update.ts` type file in desktop) so it can be shared across main/renderer/preload.

### Slice 7: Tests
Write Vitest unit tests in `packages/desktop/src/__tests__/update-service.test.ts`:
- `start()` registers listeners and fires `checkForUpdates` on launch
- `stop()` clears the interval
- `checkNow()` calls `autoUpdater.checkForUpdates()`
- `restartAndInstall()` calls `autoUpdater.quitAndInstall()`
- Status transitions (idle → checking → available → downloading → ready)
- `notify` callback fires on each status change

---

## What's NOT in this slice
- GitHub Actions CI pipeline (separate Goal 9 task)
- Code signing configuration (macOS notarization, Windows signing)
- Landing page `/download` route (TASK-0034)
- Update channels / beta builds
- Forced/mandatory updates
- In-app changelog display

# TRD: electron-updater Integration — Auto-Update Check & Notification

**Task:** TASK-0033
**Branch:** goals/33-electron-updater-auto-update
**PRD:** research/agents/prds/goal-09-auto-update-distribution.md
**Date:** 2026-05-11

---

## What we're building

The desktop app currently has no update mechanism — users stay on whatever version they installed unless they manually re-download. This task wires in `electron-updater` (from the `electron-builder` ecosystem) to enable silent background update checks, background downloads, and user-visible notification when an update is ready to install. It also exposes a manual "Check for updates" action from both the tray menu and the settings panel, and displays the current app version in settings. This covers PRD Flows 1 (background update) and 2 (manual check).

## Technical components needed

**New backend (main process) components:**
- `UpdateService` — encapsulates `autoUpdater` from `electron-updater`. Owns event listener registration, the 4-hour polling interval, and status state. Emits status change events to a provided `notify` callback so the rest of main.ts stays decoupled from updater internals.
- IPC handlers in `main.ts`: `update:get-status`, `update:check-now`, `update:restart-and-install`, `app:get-version` — thin wrappers over UpdateService and `app.getVersion()`.

**Modified backend (main process) components:**
- `main.ts` — instantiate and start `UpdateService`; wire its `notify` callback to push `update:status-changed` events to the settings window renderer; add tray refresh on update-ready; add `updateService.stop()` to `before-quit`.
- `TrayManager` — two new constructor callbacks (`onCheckForUpdates`, `onRestartAndInstall`) and a `getUpdateStatus` reader. The "Check for updates" menu item is added between Settings and the separator. When status is `ready`, a "Restart to update" item appears.

**New renderer components:**
- Version + update section in `settings.html` — static HTML block with: version display element, "Check for updates" button, status feedback label, "Restart to update" button (hidden until `ready`).
- `settings.ts` additions — wires the new DOM elements to `window.kccSettings.update.*` IPC calls; subscribes to `update:status-changed` push events to keep the label live.

**New preload surface:**
- `kccSettings.update` namespace in `settings-preload.ts` — exposes `getStatus()`, `checkNow()`, `restartAndInstall()`, `onStatusChanged(cb)` via `contextBridge`.
- `kccSettings.app.getVersion()` — exposes `app:get-version` IPC call.

**Schema changes:**
- No schema changes. This is a pure desktop/Electron addition with no database involvement.

**API changes:**
- No new web API endpoints. `electron-updater` communicates directly with GitHub Releases using its built-in GitHub provider — no proxy through our own backend.

**New config:**
- `electron-builder.yml` (or equivalent config in `packages/desktop/package.json`) — defines the GitHub provider (`owner: ForceZac`, `repo: KeyboardCommandCenter`) so `electron-updater` knows where to fetch `latest.yml`/`latest-mac.yml` from.

## Key architectural decisions

- **`electron-updater`, not Electron's built-in `autoUpdater`**: The PRD explicitly requires this. `electron-updater` supports GitHub Releases out of the box without a Squirrel server, handles macOS and Windows in one code path, and is the standard companion to `electron-builder`.
- **`autoUpdater.autoDownload = true`**: Silent background download is a PRD requirement (Flow 1). No UI interruption during download.
- **`autoUpdater.autoInstallOnAppQuit = true`**: Ensures the update applies on the user's next natural quit — satisfies the "will apply on next restart" wording in the PRD.
- **`UpdateService` as a standalone class**: Keeps updater logic out of the already-large `main.ts`. Consistent with the pattern established by `SyncEngine`, `TrayManager`, etc.
- **Notify callback pattern**: `UpdateService` receives a `notify(channel, payload)` function from `main.ts` rather than importing window managers directly. Same decoupling pattern used by `DetectionService` (`emitToRenderer`).
- **Tray notification on download complete**: When `update-downloaded` fires, use Electron's `Notification` API (or `tray.displayBalloon` on Windows) to surface "Update available — will apply on next restart." This is non-blocking and respects OS notification preferences.
- **4-hour interval, not a shorter poll**: PRD specifies "every 4 hours while running." GitHub API rate limits and the low update cadence (weekly at most) make shorter intervals wasteful.
- **`app:get-version` IPC handler**: `app.getVersion()` is only available in the main process. Exposing it via IPC is the standard Electron pattern for surfacing it in a renderer.

## Test coverage plan

- **Unit tests (Vitest)** for `UpdateService`:
  - `start()` calls `checkForUpdates()` on launch and sets up the 4-hour interval
  - `stop()` clears the interval and removes listeners
  - `checkNow()` delegates to `autoUpdater.checkForUpdates()`
  - `restartAndInstall()` delegates to `autoUpdater.quitAndInstall()`
  - Status transitions fire the `notify` callback: `idle → checking → downloading → ready`
  - Error event fires `notify` with error status
- **No E2E tests for the update flow**: Playwright cannot trigger a real GitHub Release download. The unit tests cover the service logic; manual QA on a real release build is the acceptance gate.

## Out of scope (technical)

- GitHub Actions CI release pipeline (separate Goal 9 task)
- macOS code signing and notarization configuration
- Windows code signing configuration
- Landing page `/download` route (TASK-0034)
- `latest.yml` / `latest-mac.yml` file generation — `electron-builder` produces these automatically during `make`/`package`; no code change needed
- Update channels (beta/alpha)
- Auto-restart without user action
- Rollback mechanism

## Risks and open questions

- **`electron-updater` + Electron Forge**: This project uses `electron-forge` (not a raw `electron-builder` CLI invocation). `electron-updater` is a runtime-only package — it doesn't require `electron-builder` to be the packager. The GitHub provider config can be specified in `package.json` under the `"build"` key (electron-builder's standard location) or via `autoUpdater.setFeedURL()` directly in code. If Forge and electron-builder configs conflict, the in-code `setFeedURL` approach is a clean fallback.
- **Dev/CI builds won't have a valid `latest.yml`**: `autoUpdater` will throw in dev mode because there's no GitHub Release to check. Guard with `if (app.isPackaged)` before calling `updateService.start()` — standard practice.
- **Code signing not yet configured**: Unsigned macOS builds will fail notarization, and Windows will show SmartScreen warnings. This is acceptable for this task — signing is a separate concern (CI pipeline task). The updater code is still correct; it just can't be exercised end-to-end until signing is in place.
- **`electron-updater` version compatibility**: Need to verify the version compatible with Electron 28 (currently installed). As of early 2026, `electron-updater` 6.x is the current major; check for any peer dependency conflicts.

# TRD: Detection Polling Service & IPC Integration

**Task:** TASK-0010
**Branch:** goals/10-detection-polling-service
**PRD:** research/agents/prds/goal-04-process-detection.md
**Date:** 2026-05-09

---

## What we're building

The polling service is the integration layer that wires together the three pieces of Goal 4's backend: the native active-window detector (TASK-0009), the static process-to-app mapping table (TASK-0008), and the existing Electron IPC infrastructure. On each poll tick it detects the foreground process, maps it to a database app slug, and—when the app changes—pushes an event to the renderer so the panel can pre-load the right shortcuts. It also maintains an in-memory list of the last 5 unique detected apps (consumed by TASK-0011's tray submenu) and logs unrecognized processes locally for future database expansion.

---

## Technical components needed

**New backend components:**
- `DetectionService` (`packages/desktop/src/detection.ts`) — stateful class that owns the polling loop, change-detection logic, recent-apps list, and unrecognized-process log writer. Accepts injected `getActiveWindow` and `lookupApp` functions so it can be unit-tested without native binaries or Electron.

**Modified backend components:**
- `main.ts` — instantiates `DetectionService` after the panel window is created, registers the `detection:get-recent-apps` IPC handler, starts the service based on the `detection.enabled` electron-store setting, and stops it on `before-quit`.
- `preload.ts` — extends the `kcc` contextBridge object with `onAppChanged(callback)` and `getRecentApps()` so the renderer can subscribe to detection events and query recent apps.
- `renderer/kcc.d.ts` — adds TypeScript declarations for the two new `kcc` methods.

**New frontend components:**
- None. The renderer receives IPC events; the UI for consuming them is Goal 5.

**Schema changes:**
No schema changes. Detection state is ephemeral (in-memory) or written to a plain-text log file outside the database.

**API changes:**
No HTTP API changes. New Electron IPC channels:
- `detection:app-changed` (main → renderer, one-way event) — emitted when the foreground app changes. Payload: `{ appSlug: string | null, processName: string, windowTitle: string }`.
- `detection:get-recent-apps` (renderer → main, invoke/handle) — returns `string[]` of the last ≤5 unique detected app slugs, most recent first.

---

## Key architectural decisions

- **Dependency injection over direct imports.** `DetectionService` accepts `getActiveWindow` and `lookupApp` as constructor arguments rather than importing them directly. This makes the class testable in a pure Node.js Vitest environment without a compiled `.node` binary or Electron globals.

- **Change-detection keyed on processName, not appSlug.** Emitting IPC only when `processName` changes prevents duplicate events when the same app is detected on consecutive ticks. Keying on `processName` (rather than `appSlug`) also catches transitions to unrecognized apps (null slug) correctly.

- **Recent apps stores slugs, not display names.** The renderer looks up display names from its own shortcut data; the slug is the stable key. Storing slugs avoids any dependency on the process-map's display-name logic in the main process.

- **Session-level deduplication for unrecognized process log.** An in-memory `Set` tracks which process names were logged this session. The same process name is never appended twice to the log file within a session, keeping the file useful without noise.

- **electron-store settings are read once at construction.** Interval and enabled flag are read at `DetectionService` construction time. Dynamic reconfiguration (changing interval without restart) is deferred to a future goal — it adds complexity for minimal v1 value. The Settings UI (TASK-0007) can stop and restart the service when the user saves new settings; that wiring is out of scope here.

- **Reuses existing platform adapter.** `getActiveWindow` from `packages/desktop/src/platform/active-window.ts` (TASK-0009) already handles the native module load failure by returning `null`. `DetectionService` treats `null` as "detection temporarily unavailable" and skips that tick — no additional error handling needed.

---

## Test coverage plan

Unit tests (`packages/desktop/src/detection.test.ts`) via Vitest — no Electron env required:
- **Lifecycle:** `start()` / `stop()` / `isRunning()` correctness
- **Polling integration:** `getActiveWindow` is called on each interval tick
- **Change gating:** IPC emit callback fires only when `processName` changes, not on identical consecutive detections
- **Recent apps:** list fills to 5, caps at 5 on overflow, dedupes by moving existing slug to front of list
- **Unknown process logging:** log write fires on first occurrence of an unknown process name; does not fire again for the same name within the session
- **Graceful null:** `getActiveWindow` returning `null` causes no crash and no emit
- **Disabled service:** `start()` is a no-op when `detection.enabled` is false

No E2E/Playwright tests for this task — the renderer UI for detection is Goal 5. Manual smoke test: run app in dev mode, switch between VS Code and Terminal, confirm console logs show correct slug transitions.

---

## Out of scope (technical)

- Tray "Recent Apps" submenu UI and its IPC (TASK-0011)
- Renderer panel UI changes for displaying detected-app shortcuts (Goal 5)
- Settings window UI for the detection toggle (TASK-0007 owns the Settings window; this task only reads the stored values)
- Linux platform support (Goal 10)
- Persisting the recent-apps list across app restarts (PRD explicitly defers this)
- Battery-aware polling frequency reduction (PRD marks this as nice-to-have, not required)

---

## Risks and open questions

- **TASK-0008 and TASK-0009 not yet merged to main.** This task depends on `lookupApp()` and `getActiveWindow()` from those branches. The interfaces are defined in their TRDs and stable. This branch should stub minimal type stubs if those branches are still pending at build time; reconcile at merge.
- **electron-store version mismatch.** TASK-0007 adds `electron-store` to `packages/desktop/package.json`. If that PR is not merged when this branch lands, we need to add it ourselves. Confirm the version matches on merge.
- **IPC send to renderer window.** `DetectionService` needs a reference to the `BrowserWindow` to call `webContents.send('detection:app-changed', ...)`. The renderer window may not yet exist when the service starts (if the panel is created lazily). `PanelWindowManager` must expose a method to send to the window if it exists, or the service must gracefully skip emission when the window is not ready.

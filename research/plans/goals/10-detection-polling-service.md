# Plan: TASK-0010 — Detection Polling Service & IPC Integration

**Branch:** goals/10-detection-polling-service
**PRD:** research/agents/prds/goal-04-process-detection.md
**TRD:** research/plans/goals/10-detection-polling-service-trd.md

---

## Overview

Build the `DetectionService` class that ties together:
- `getActiveWindow()` from the TASK-0009 native module
- `lookupApp()` from the TASK-0008 process-map module
- IPC emission to the renderer on app changes
- electron-store settings (enabled toggle, poll interval)
- In-memory recent-apps list
- Unrecognized process logging

All code lives in `packages/desktop/src/`. No web or core changes.

---

## Work breakdown

### Slice 1 — DetectionService skeleton
**File:** `packages/desktop/src/detection.ts`

Class with:
- Constructor accepting injected `getActiveWindow`, `lookupApp`, `emitToRenderer`, and `store` — allows full unit testing without native binaries
- `start()`: begins polling at configured interval
- `stop()`: clears interval, resets state
- `isRunning()`: boolean accessor
- `getRecentApps()`: returns copy of recent-apps array

### Slice 2 — Settings integration
Wire electron-store settings inside `DetectionService`:
- `detection.enabled` (boolean, default `true`) — if false, `start()` is a no-op; existing polling stops immediately
- `detection.intervalMs` (number, default `1500`) — sets the `setInterval` delay
- Settings are read once at construction time; the service must be restarted to pick up interval changes (simpler than dynamic reconfiguration, sufficient for v1)

### Slice 3 — Polling loop
Inside the `setInterval` callback:
1. Call `getActiveWindow()` — handle `null` (native unavailable or call failed) by returning early without crashing
2. Extract `processName`, `windowTitle`, `bundleId`

### Slice 4 — Process mapping
Pass `processName` and `bundleId` to `lookupApp()` from the process-map module (TASK-0008).
Result: `appSlug: string | null`.

### Slice 5 — Change detection + IPC emit
- Track `lastDetected: { processName, appSlug, windowTitle } | null`
- Compare incoming `processName` with `lastDetected.processName`
- If changed (or first detection): update `lastDetected`, call `emitToRenderer('detection:app-changed', payload)`
- Payload shape: `{ appSlug: string | null, processName: string, windowTitle: string }`

### Slice 6 — Recent apps tracking
- `recentApps: string[]` — stores appSlugs (only non-null slugs), capped at 5, most recent first
- Updated on each detection change where `appSlug !== null`
- Deduped: if the same slug appears again, move it to front rather than adding a duplicate
- Exposed via `ipcMain.handle('detection:get-recent-apps')` in `main.ts`

### Slice 7 — Unrecognized process logging
- When `appSlug === null`: check session-seen set; if `processName` not seen yet, append to log file and add to set
- Log file path: `path.join(app.getPath('home'), '.shortcutvault', 'unrecognized-processes.log')`
- mkdir -p on first write; one entry per line (processName + timestamp)
- Error in log write is caught and printed to console only — never throws

### Slice 8 — Wire into main.ts
- Import `DetectionService` and the real `getActiveWindow` + `lookupApp` implementations
- Instantiate after `panelManager` is created
- Pass `panelManager.getWindow()` (or a send callback) so DetectionService can emit to the renderer
- Register `ipcMain.handle('detection:get-recent-apps', ...)` that calls `detectionService.getRecentApps()`
- Start the service if `store.get('detection.enabled', true)` is true
- On `app.on('before-quit')`: call `detectionService.stop()`

### Slice 9 — Preload + renderer types
- `preload.ts`: add `onAppChanged(cb)` (wraps `ipcRenderer.on('detection:app-changed', ...)`) and `getRecentApps()` (wraps `ipcRenderer.invoke('detection:get-recent-apps')`) to the `kcc` contextBridge object
- `renderer/kcc.d.ts`: extend the `Kcc` interface with the new methods
- No renderer UI changes (that's Goal 5)

### Slice 10 — Unit tests
**File:** `packages/desktop/src/detection.test.ts`

Tests (all run via Vitest; no Electron env needed — pure TS logic):
- `start()` / `stop()` lifecycle: `isRunning()` returns correct value
- Polling calls `getActiveWindow()` on each tick
- No IPC emit when processName is unchanged between ticks
- IPC emit fires when processName changes
- Recent apps list: fills to 5, caps there, dedupes by moving existing slug to front
- Unknown process (null slug): appends to log; second occurrence of same processName does NOT append again
- `getActiveWindow()` returns null: no crash, no emit

---

## Dependencies

This branch compiles against the interfaces defined in TASK-0009's `active-window.ts` and TASK-0008's process-map module. If those branches are not yet merged when this branch is cut, define stub type stubs here and reconcile at merge time.

---

## Out of scope

- Tray "Recent Apps" submenu UI (TASK-0011)
- Renderer panel content changes (Goal 5)
- Settings UI for the detection toggle (part of TASK-0007)
- Linux support (Goal 10)

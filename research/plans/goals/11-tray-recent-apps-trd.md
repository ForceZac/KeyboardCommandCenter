# TRD: Tray "Recent Apps" Submenu

**Task:** TASK-0011
**Branch:** goals/11-tray-recent-apps
**PRD:** research/agents/prds/goal-04-process-detection.md
**Date:** 2026-05-10

---

## What we're building

This task adds the user-facing half of Goal 4's tray integration: a "Recent Apps" submenu that surfaces the last ≤5 detected app slugs maintained by `DetectionService` (TASK-0010). The submenu sits between "Open" and "Settings" in the tray context menu, shows each app's human-readable display name, and opens the shortcut panel pre-loaded with that app's shortcuts when clicked. It handles two empty states: "No recent apps" (detection on but nothing detected yet) and "Detection off" (detection disabled in settings). The submenu rebuilds from the live in-memory list on every tray menu open so it always reflects the current session state without polling.

---

## Technical components needed

**Modified backend components:**
- `process-map.json` — add a `displayNames` field: a flat object mapping each known app slug to its human-readable display name (e.g. `"google-chrome": "Google Chrome"`). Covers all 50+ seeded apps so the tray can resolve any slug the detection service may return.
- `process-map.ts` — export a `getDisplayName(slug: string): string` function that reads from the new `displayNames` field and falls back to a title-cased, hyphen-stripped version of the slug for any unknown slug. This keeps the main process independent of the database for display-name resolution.
- `tray.ts` — refactor `TrayManager` to accept four new injected dependencies (see below) and replace the static `setContextMenu` call with a `buildContextMenu()` method that constructs the full context menu fresh on each invocation. The "Recent Apps" submenu is generated inside `buildContextMenu()` from the live injected data. A new `right-click` event handler (Windows/Linux) and `click` handler (macOS) each call `buildContextMenu()` and pass the result to `tray.popUpContextMenu()`.
- `main.ts` — update the `TrayManager` constructor call to pass the four new callbacks wired to `DetectionService`, `process-map.ts`, `electron-store`, and `PanelWindowManager`.

**New injected dependencies on TrayManager:**
- `getRecentApps: () => string[]` — returns the current in-memory recent-apps list from `DetectionService.getRecentApps()`; called synchronously at menu-open time (no IPC round-trip needed since main process owns the service directly)
- `getDisplayName: (slug: string) => string` — resolves a slug to a display name; sourced from `process-map.ts`
- `isDetectionEnabled: () => boolean` — reads `detection.enabled` from electron-store at menu-open time so it reflects any settings changes made since app start
- `onOpenPanelWithApp: (slug: string) => void` — shows the panel and sends a `detection:app-changed` payload to the renderer with the selected slug so the panel pre-loads that app's shortcuts

**New frontend components:**
None. The renderer already handles `detection:app-changed` events from TASK-0010.

**Schema changes:**
No schema changes.

**API changes:**
No new IPC channels. The submenu click handler reuses the existing `detection:app-changed` channel (push from main process to renderer) to pre-load the selected app.

---

## Key architectural decisions

- **Direct call to `DetectionService.getRecentApps()`, not IPC.** The tray runs in the main process and holds a direct reference to `DetectionService`. Calling the method synchronously avoids an unnecessary IPC round-trip and keeps menu construction instantaneous. The preload's `getRecentApps()` (via IPC) is for renderer-side consumers only.

- **Display names live in process-map.json, not the database.** Querying PostgreSQL for display names from the tray main process would add latency, a DB dependency, and error-handling complexity to a synchronous menu-build path. Keeping display names in the static JSON file (alongside the process→slug mappings) is the right layer for this data — it changes at the same cadence as the process map itself.

- **`buildContextMenu()` called at open time, not on detection events.** Rebuilding the menu on every detection event (every ~1500ms) would create unnecessary Electron objects and could interfere with an already-open menu. Building at open time is simpler and sufficient — the submenu reflects the state at the moment the user opens the tray.

- **Injected dependencies, not direct imports.** Following the pattern established by `DetectionService` (TASK-0010), `TrayManager` receives its runtime dependencies via the constructor. This allows the tray logic to be unit-tested with Vitest stubs in a pure Node environment, without Electron globals or a running app.

- **`tray.popUpContextMenu()` replaces static `setContextMenu`.** Static menus can't reflect live data. Switching to `popUpContextMenu` on click/right-click gives us a fresh menu on every open. This is the standard Electron pattern for dynamic tray menus.

- **`onOpenPanelWithApp` reuses `detection:app-changed`.** The renderer already handles this channel (TASK-0010) to pre-load shortcuts for the active app. Reusing it for tray-initiated app selection means the renderer needs no new IPC handling for this task.

---

## Test coverage plan

Unit tests (`packages/desktop/src/__tests__/tray.test.ts`) via Vitest — mocked Electron `Menu`/`Tray` APIs:
- Detection enabled + recent apps → submenu contains one enabled item per app (up to 5), with correct display names
- Detection enabled + empty recent-apps list → submenu contains a single disabled "No recent apps" item
- Detection disabled → submenu contains a single disabled "Detection off" item
- Recent-apps list with 6+ entries → submenu capped at 5
- Clicking a recent-app submenu entry calls `onOpenPanelWithApp` with the correct slug

Unit tests for `getDisplayName` in `packages/desktop/src/__tests__/process-map.test.ts`:
- Known slug returns mapped display name
- Unknown slug returns a reasonable fallback (title-cased, hyphens removed)

No E2E tests for this task — the tray context menu cannot be reliably driven by Playwright in headless Electron without significant test infrastructure work. Manual smoke test: run app in dev mode, switch between two detected apps, right-click tray, confirm both appear in "Recent Apps" with correct names.

---

## Out of scope (technical)

- Persisting the recent-apps list across restarts (PRD explicitly defers this)
- Shortcut panel content or layout changes (Goal 5)
- Overlay mode (Goal 6)
- Linux tray support (Goal 10)
- Settings window changes
- Replacing the stub `lookupApp` in process-map.ts with a real implementation (a gap from TASK-0008 reconciliation — logged separately; not a blocker for TASK-0011 since display names use a separate `displayNames` field)

---

## Risks and open questions

- **`process-map.ts` stub is still present on main.** TASK-0008 added `process-map.json` data but `process-map.ts` was not updated with a real `lookupApp` implementation. TASK-0011 adds `getDisplayName` to process-map.ts. The `lookupApp` stub will remain until reconciled separately — this is noted in proposals.md. The `getDisplayName` function is independent of `lookupApp` and is unaffected.

- **`popUpContextMenu` deprecation.** Electron's `Tray.popUpContextMenu()` is documented in older versions. If the project's Electron version has removed it, fall back to calling `tray.setContextMenu(buildContextMenu())` immediately before a native click triggers the display. Confirm the available Electron API version in `packages/desktop/package.json` before coding.

- **macOS click behavior.** On macOS, the tray icon always shows a menu on click (no separate left/right click distinction). The current `tray.ts` calls `setContextMenu` for both platforms. After the refactor, the macOS `click` handler must pop up the dynamic menu instead. Verify the click event fires before macOS tries to show the previously-set static menu.

- **`TrayManager` constructor signature change is a breaking refactor.** `main.ts` is the only caller, so this is low-risk, but any future callers must pass all four new dependencies. Document in the PR.

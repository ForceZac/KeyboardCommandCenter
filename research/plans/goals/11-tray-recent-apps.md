# Plan: Tray "Recent Apps" Submenu — TASK-0011

**Branch:** goals/11-tray-recent-apps
**TRD:** research/plans/goals/11-tray-recent-apps-trd.md

---

## Work breakdown

### Slice 1 — Extend process-map with display names
- Add a `displayNames` field to `process-map.json`: `{ "google-chrome": "Google Chrome", ... }` covering all 50+ seeded apps
- Export `getDisplayName(slug: string): string` from `process-map.ts` (falls back to title-casing the slug if not found)
- Unit tests for `getDisplayName` in `__tests__/process-map.test.ts`

### Slice 2 — Refactor TrayManager for dynamic menus
- Accept four new injected dependencies via constructor:
  - `getRecentApps: () => string[]` — queries DetectionService's in-memory list
  - `getDisplayName: (slug: string) => string` — resolves slug to display name
  - `isDetectionEnabled: () => boolean` — checks electron-store `detection.enabled`
  - `onOpenPanelWithApp: (slug: string) => void` — shows panel pre-loaded with the app's slug
- Replace static `setContextMenu` call with a `buildContextMenu()` private method that assembles the menu fresh on each call
- Add the "Recent Apps" submenu between "Open" and "Settings" items
- Wire right-click / click event handlers to call `buildContextMenu()` and `tray.popUpContextMenu()` so the submenu is always current

### Slice 3 — Wire TrayManager dependencies in main.ts
- Update `TrayManager` constructor call in `main.ts` to pass the four new callbacks
- `getRecentApps`: `() => detectionService.getRecentApps()`
- `getDisplayName`: imported from `process-map.ts`
- `isDetectionEnabled`: reads `store.get('detection.enabled', true)` at call time
- `onOpenPanelWithApp`: shows panel and sends slug to renderer via `panelManager.sendToRenderer('detection:app-changed', payload)`

### Slice 4 — Unit tests for tray logic
- Test `buildContextMenu()` output in isolation using injected stubs:
  - Detection enabled + 3 recent apps → submenu with 3 enabled entries
  - Detection enabled + 0 recent apps → submenu with single disabled "No recent apps" item
  - Detection disabled → submenu with single disabled "Detection off" item
  - 5+ apps → submenu capped at 5 entries
  - Clicking an app entry invokes `onOpenPanelWithApp` with correct slug

### Slice 5 — Mark PR ready
- Run `npm run test -w packages/web` and all desktop Vitest tests; confirm green
- Run TypeScript check; confirm no errors
- Mark PR ready, strip WIP prefix, move task to In Review

---

## Order
Slices run in order 1→2→3→4→5. Slices 2 and 3 are tightly coupled (interfaces defined in 2, wired in 3) so commit them together.

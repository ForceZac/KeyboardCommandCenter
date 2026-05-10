# Plan: TASK-0014 — Reconcile Goal 4 Stubs

**Branch:** goals/14-reconcile-goal4-stubs
**Task:** TASK-0014
**PRD:** research/agents/prds/goal-04-process-detection.md

---

## What we're doing

Two stub files on `main` were intentionally left unimplemented and need real implementations:

1. `packages/desktop/src/process-map.ts` — `lookupApp()` always returns null (stub)
2. `packages/desktop/src/platform/active-window.ts` — `getActiveWindow()` always returns null; `loadNativeModule` and `createActiveWindowDetector` are not exported (test-incompatible)

Both real implementations were written once in PR #11 (TASK-0011) and then reverted as out of scope. The implementations are validated and correct — this task restores them on a clean branch.

## Slices

### Slice 1 — Implement `lookupApp` in process-map.ts

- Remove stub body
- Import ProcessMap type, load process-map.json
- Implement: bundleId lookup first (byBundleId), then normalized processName (lowercase, trim, strip .exe) via byProcess
- Return null for unknowns
- **Target:** 40 process-map tests pass

### Slice 2 — Implement `loadNativeModule` + `createActiveWindowDetector` in active-window.ts

- Export `NativeModule` interface
- Export `loadNativeModule()` — tries three candidate paths for the .node binary; returns null if none found
- Export `createActiveWindowDetector(mod)` — factory that returns a safe getter; warns when mod is null; catches exceptions from native calls
- Export `getActiveWindow` as the default instance using `loadNativeModule()`
- **Target:** 9 active-window tests pass

## Order

Slice 1 → Slice 2. Both are independent file changes; no shared state between them.

## Tests to run after each slice

`npm run test -w packages/desktop` — all 67 tests should pass when both slices are done.

## What we're NOT doing

- Modifying process-map.json data
- Touching DetectionService, TrayManager, or any other file
- Changing test files

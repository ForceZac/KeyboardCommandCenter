# TRD: Reconcile Goal 4 Stubs — process-map.ts & active-window.ts

**Task:** TASK-0014
**Branch:** goals/14-reconcile-goal4-stubs
**PRD:** research/agents/prds/goal-04-process-detection.md
**Date:** 2026-05-10

---

## What we're building

Goal 4 shipped three tasks (TASK-0008, TASK-0009, TASK-0010) whose implementations were meant to be reconciled at merge time. That reconciliation never happened, leaving two production stubs on `main`:

- `lookupApp()` in `process-map.ts` — always returns null, defeating the entire detection pipeline
- `getActiveWindow()` + the wrapper factory in `active-window.ts` — stub-only; missing exports the test suite expects (`loadNativeModule`, `createActiveWindowDetector`, `NativeModule`)

49 of 67 desktop unit tests fail on `main` because of these stubs. The PRD (Flow 1: auto-detected app in panel) cannot work at all until lookupApp returns real slugs. This task replaces both stubs with the real implementations that were validated in PR #11 and then correctly reverted as out-of-scope for TASK-0011.

## Technical components needed

**Modified backend components:**

- `packages/desktop/src/process-map.ts` — replace stub `lookupApp` with real lookup logic:
  - Try `byBundleId[bundleId]` first (macOS — more stable than process names)
  - Fall back to `byProcess[normalize(processName)]` where normalize = lowercase + trim + strip `.exe`
  - Return null when neither matches
  - No schema changes to the JSON file — the data is complete and correct

- `packages/desktop/src/platform/active-window.ts` — replace stub with real TypeScript wrapper for the kcc-native .node binary:
  - Export `NativeModule` interface `{ getActiveWindow(): { processName, windowTitle, bundleId? } | null }`
  - Export `loadNativeModule(): NativeModule | null` — probes three binary paths (packaged, webpack dev, non-webpack test); returns null if none load cleanly
  - Export `createActiveWindowDetector(mod): () => ActiveWindowInfo | null` — factory that wraps the native call in try/catch, warns to `console.warn` when mod is null, never propagates exceptions
  - Export `getActiveWindow` as the pre-loaded singleton: `createActiveWindowDetector(loadNativeModule())`

**Schema changes:** None

**API changes:** None — these are internal Electron main-process modules, no IPC surface changes

## Key architectural decisions

- **Reuse validated code from PR #11** — the implementations were already reviewed once and are correct. This task is pure reconciliation, not new design.
- **bundleId-first lookup** — bundle IDs are version-stable on macOS; process names change with app updates. PRD technical notes specified this order.
- **Three-path binary probe in `loadNativeModule`** — covers packaged app (resourcesPath/native), webpack dev (.webpack/main/../../native), and non-webpack test runners (src/../native). The test suite expects null when no binary exists, which this gracefully handles.
- **`createActiveWindowDetector` factory exported for testability** — callers inject a mock `NativeModule` in tests; no compiled binary required. This pattern was explicitly designed in TASK-0009's TRD.
- **No changes to process-map.json** — the data is complete. The bug is purely in the lookup code.

## Test coverage plan

These tests already exist and are currently failing — passing them is the acceptance criterion:

- **Unit tests (process-map):** 40 tests in `src/__tests__/process-map.test.ts` covering PRD top-10 apps, normalization edge cases (`.exe`, case, whitespace), bundleId priority, null returns for unknowns, and extended app coverage.
- **Unit tests (active-window):** 9 tests in `src/platform/active-window.test.ts` covering null-module behavior, mock native module success/failure paths, exception isolation, console.warn emission, and the loadNativeModule loader (null-safe in CI).

No new test files are needed — this task's goal is to make the existing 49 failing tests pass.

## Out of scope (technical)

- Modifying process-map.json (data is correct)
- DetectionService, TrayManager, main.ts — no changes to callers
- Adding new entries to the process map
- Linux platform support (Goal 10)
- Any UI changes

## Risks and open questions

- **Binary path probe order** — the `__dirname` resolution inside Vitest may differ from webpack dev mode. The three-path probe was tested in PR #11 and handles this; the test for `loadNativeModule` accepts either null or a valid module, so no fragility there.
- **No other open questions** — implementations are known-good from PR #11 review cycle.

# TRD: Process-to-App Mapping Table

**Task:** TASK-0008
**Branch:** goals/8-process-map
**PRD:** research/agents/prds/goal-04-process-detection.md
**Date:** 2026-05-09

---

## What we're building

The PRD's "process-to-app mapping layer" requires a static lookup table that translates a raw process name (e.g. `Code.exe`, `code`, `Code Helper`) or macOS bundle ID (e.g. `com.microsoft.VSCode`) into the database application slug (e.g. `vscode`). This task delivers that lookup table as a static JSON file and a TypeScript module that wraps it with a typed `lookupApp()` function. The module is the foundational building block that TASK-0009's native `getActiveWindow()` result flows into — no detection logic lives here, only the mapping. The mapping covers all 50+ apps in the existing seed database and handles common process name aliases and variations as required by the PRD success metrics.

---

## Technical components needed

**New components in `packages/desktop/src/`:**

- `process-map.json` — Static mapping file with two top-level lookup objects:
  - `byProcess`: flat map of `{ [normalizedProcessName]: slug }` where keys are lowercased process names (with `.exe` suffix stripped for Windows parity). Covers all 50+ database apps with common aliases and version-suffixed variants.
  - `byBundleId`: flat map of `{ [bundleId]: slug }` for macOS canonical bundle identifiers (e.g. `com.microsoft.VSCode → vscode`). These are the authoritative identifiers on macOS and take lookup priority.
  - Each app slug in the values must match an existing slug from `database/seeds/apps/`.

- `process-map.ts` — TypeScript module with a single exported function:
  - `lookupApp(processName: string, bundleId?: string): string | null` — checks `byBundleId` first (if `bundleId` provided), then normalizes `processName` (lowercase, `.exe` stripped) and checks `byProcess`. Returns the matched slug or `null` for unrecognized inputs.
  - Imports `process-map.json` directly (TypeScript `resolveJsonModule`). No file I/O at runtime — the module is bundled into the Electron main process via webpack.
  - Exports a `ProcessMap` type for typed consumers (TASK-0009's polling service).

**No new backend components.** **No new frontend components.** **No Electron IPC changes** (those come in a future polling service task).

**Schema changes:** No schema changes.

**API changes:** No new endpoints. This module is consumed internally by the Electron main process only.

---

## Key architectural decisions

- **Static JSON over database query:** The PRD explicitly recommends a static JSON file shipped with the app for offline reliability. The desktop app may run when the web API is unreachable, and process mapping must work in all conditions. A Prisma query at lookup time would add latency and a network/DB dependency that this hot path doesn't need.

- **Bundle ID takes priority on macOS:** macOS bundle IDs (e.g. `com.apple.Terminal`) are stable across app version changes and system updates, while process names (e.g. `Terminal`, `terminal`) are slightly less reliable. When both are available, bundle ID match wins. On Windows, bundle IDs are not available so `byProcess` is the only path.

- **`.exe` suffix normalization at lookup time:** Windows process names returned by the Win32 API often include `.exe` (e.g. `slack.exe`). Normalizing the suffix away at lookup time (in `lookupApp()`) means the JSON keys stay clean and platform-neutral. Both `slack` and `slack.exe` resolve correctly without duplicating every Windows entry.

- **Flat lookup objects (not nested arrays):** The `byProcess` and `byBundleId` structures are flat `Record<string, string>` objects rather than an array of `{ processNames: [], slug }` objects. Flat lookup is O(1) and eliminates iteration at call time, which matters for a function called every 1-2 seconds by the polling service.

- **No build-time sync with seed data:** The PRD suggests the mapping file could be synced from seed data at build time. That adds tooling complexity for minimal gain at this stage — the 50 apps are stable and hand-authoring the process names is trivial. A future task can introduce a generator script if the app set grows significantly.

---

## Test coverage plan

- **Vitest unit tests (`packages/desktop/src/__tests__/process-map.test.ts`):**
  - `lookupApp()` returns correct slug for each of the 10 PRD-specified apps (VS Code, Chrome, Photoshop, Figma, Slack, Terminal/Finder as macOS bundle ID, Word, Excel, Spotify if seeded)
  - Returns `null` for an unrecognized process name
  - Case-insensitive: `SLACK` and `Slack` both resolve to `slack`
  - `.exe` suffix stripping: `slack.exe` resolves to `slack`
  - Bundle ID priority: when `bundleId` matches, process name mismatch is ignored
  - Empty string inputs return `null` gracefully

- **No E2E/Playwright tests:** This is a pure TypeScript utility module with no UI surface. Unit tests are sufficient and appropriate per project standards.

---

## Out of scope (technical)

- Rust native module (`getActiveWindow()` implementation) — TASK-0009
- Background polling service that calls `lookupApp()` on a timer — future task
- IPC channel from main to renderer (sending detected slug) — future task
- Tray "Recent Apps" submenu — future task
- Settings toggle to enable/disable detection — future task
- Linux process names — Goal 10
- Any frontend or web package changes

---

## Risks and open questions

- **Process name accuracy:** The mapping is hand-authored based on known process names. Some apps (particularly those with aggressive auto-updaters like Chrome or Slack) may use multiple binary names across OS versions. The unit tests will confirm coverage for the top 10, but long-tail apps may have gaps that only surface during integration testing with TASK-0009.

- **Multi-process apps (e.g. Chrome, Electron apps):** The Win32 and NSWorkspace APIs return the process that *owns* the foreground window, not child/helper processes. This is noted in the PRD open questions section. The mapping only needs to cover the main process name (e.g. `chrome`, not `chrome_crashpad_handler`). However, on macOS, Electron-based apps often expose a `Helper` process as the frontmost — the mapping should include `App Helper` aliases for common Electron apps (Slack, Discord, VS Code, Figma) as a fallback, with the bundle ID as the primary resolver.

- **Spotify not in seed data:** The PRD success metrics list Spotify as one of the top 10 apps to cover, but `database/seeds/apps/` does not currently include a `spotify.json`. The mapping can include a Spotify entry pointing to a future slug (`spotify`) — the `lookupApp()` function will return it, and if no database record exists, the panel will show "no shortcuts found." This is acceptable per PRD Flow 3.

---

## Addendum: Intentionally excluded seed slugs

*(Added post-review to document omissions that are by design, not accidental.)*

Cross-checking `database/seeds/apps/` against `process-map.json` reveals four seed slugs with no entries in either `byProcess` or `byBundleId`:

- **`google-docs`**, **`google-sheets`**, **`google-slides`** — Browser-hosted web apps. There is no standalone process to detect; the frontmost process is always the browser (Chrome, Firefox, Safari, etc.). Mapping a browser slug to `google-docs` would produce wrong results whenever the user has Chrome open on a non-Google-Docs page. These apps are intentionally not mappable at the process level; they would require a URL/tab-inspection layer that is explicitly out of scope for Goal 4.

- **`windows-11`** — An operating system, not a detectable foreground application. There is no "Windows 11" process that becomes the active window — the OS manifests as individual apps (Explorer, Settings, etc.) which are mapped under their own slugs. Excluding `windows-11` from the process map is correct; it is a shortcut-catalog entry, not a detectable process.

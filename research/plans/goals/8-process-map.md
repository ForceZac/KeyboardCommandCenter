# Plan: TASK-0008 — Process-to-App Mapping Table

**Branch:** goals/8-process-map
**Task:** TASK-0008
**PRD:** research/agents/prds/goal-04-process-detection.md

---

## Work breakdown

### Phase 1: JSON mapping file
- Create `packages/desktop/src/process-map.json`
- Cover all 50 apps from `database/seeds/apps/`
- Each entry has: `slug` (matches database), `processNames` (array of lowercase process names), optionally `bundleId` (macOS canonical bundle ID)
- Include common variations per app (helper processes, version-suffixed names, abbreviated names)
- Priority order for matching: bundle ID first (macOS only, more reliable), then process name (normalized to lowercase)
- Structure: top-level object with two lookup indexes:
  - `byProcess`: `{ [processNameLowercase]: slug }` — flat lookup for fast match
  - `byBundleId`: `{ [bundleId]: slug }` — macOS bundle ID lookup

### Phase 2: TypeScript lookup module
- Create `packages/desktop/src/process-map.ts`
- Import JSON directly (TypeScript resolveJsonModule)
- Export `lookupApp(processName: string, bundleId?: string): string | null`
  - Normalize: `processName.toLowerCase().trim()`; strip `.exe` suffix for Windows normalization
  - Check `byBundleId[bundleId]` first if bundleId provided
  - Fall back to `byProcess[normalizedProcessName]`
  - Return `null` on no match
- Export `ProcessMap` type for type-safe consumers

### Phase 3: Vitest unit tests
- Create `packages/desktop/src/__tests__/process-map.test.ts`
- Test the top 10 apps from the PRD success metrics:
  - VS Code: `code`, `Code.exe`, `Code Helper` → `vscode`
  - Chrome: `google chrome`, `chrome` → `google-chrome`
  - Photoshop: `Adobe Photoshop 2024`, `photoshop` → `photoshop`
  - Figma: `figma`, `Figma` → `figma`
  - Slack: `slack` → `slack`
  - Terminal (macOS): bundle ID `com.apple.Terminal` → `macos`
  - Finder: bundle ID `com.apple.finder` → `macos`
  - Word: `winword`, `Microsoft Word` → `microsoft-word`
  - Excel: `excel`, `Microsoft Excel` → `microsoft-excel`
  - Spotify: `spotify` → `spotify` (if in seed data, else skip)
- Test null return for unknown process: `zerglings.exe` → `null`
- Test case-insensitive matching: `SLACK` → `slack`
- Test `.exe` suffix stripping: `slack.exe` → `slack`
- Test bundleId priority over processName

### Phase 4: Wrap-up
- Run `npx tsc --noEmit` (from `packages/desktop/`) to confirm no TypeScript errors
- Run `npm run test -w packages/desktop` to confirm tests green
- Run `npm run lint`
- Commit with `FINAL:` prefix
- Mark PR ready, strip WIP from title
- Move task to In Review in backlog.md

---

## What is NOT in this plan

- Rust native module / `getActiveWindow()` implementation (TASK-0009)
- Background polling service (future task)
- IPC channel to renderer (future task)
- Tray "Recent Apps" submenu (future task)
- Settings toggle for detection (future task)
- Linux process names (Goal 10)
- Any frontend changes

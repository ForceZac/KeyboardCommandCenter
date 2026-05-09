# Plan: TASK-0002 — Seed Script & Data for 50+ Applications

**Branch:** goals/2-seed-script
**Task:** TASK-0002
**PRD:** research/agents/prds/goal-01-shortcut-data-schema.md

**Dependency:** TASK-0001 (Prisma schema) must be merged to main before the build phase can execute. TRD can be written and reviewed now; actual code requires the 6-model schema to exist.

---

## Work breakdown

### Phase 1: Seed file structure + JSON for all 50+ apps
- Define JSON format per app: `{ name, slug, description, category, shortcuts: [{ command, context, bindings: { windows?, macos?, linux?: { steps: [{ keyCombo, key, modifiers }] } } }] }`
- Create `database/seeds/apps/` directory
- Write seed JSON for all 50+ applications — 10+ verified shortcuts each:
  - **Creative (7):** photoshop, illustrator, premiere-pro, after-effects, figma, blender, davinci-resolve
  - **Developer Tools (12):** vscode, intellij-idea, pycharm, webstorm, goland, vim, neovim, emacs, sublime-text, iterm2, windows-terminal, xcode
  - **Productivity (13):** google-docs, google-sheets, google-slides, microsoft-word, microsoft-excel, microsoft-powerpoint, notion, slack, obsidian, trello, zoom, asana, linear
  - **Gaming (4):** steam, discord, obs-studio, streamlabs-obs
  - **Music (4):** fl-studio, ableton-live, logic-pro, garageband
  - **System (5):** windows-11, macos, ubuntu-gnome, i3-window-manager, windows-explorer
  - **Browsers (5):** google-chrome, mozilla-firefox, safari, microsoft-edge, opera

### Phase 2: Full-text search migration
- Create `database/migrations/20260509000001_add-fts-indexes/migration.sql`
- GIN index on `shortcuts.command` via `to_tsvector('english', command)`
- GIN index on `applications.name` via `to_tsvector('english', name)`
- This migration must apply after TASK-0001's `20260509000000_init-shortcut-schema`

### Phase 3: Seed script
- Create `database/seeds/seed.ts` (TypeScript, runs via `ts-node` or `npx tsx`)
- Add script to `database/package.json`: `"seed": "tsx seeds/seed.ts"`
- Script flow:
  1. Connect via Prisma client
  2. Upsert platforms: windows, macos, linux (reference data — idempotent)
  3. Upsert categories: one per category slug (reference data — idempotent)
  4. For each JSON file in `seeds/apps/`:
     - Upsert Application (by slug)
     - For each shortcut: upsert Shortcut (by applicationId + command + context)
     - For each platform binding: upsert ShortcutKeyBinding (unique constraint on shortcutId + platformId), then upsert ShortcutKeySteps
  5. Log progress to stdout (count of apps, shortcuts, bindings seeded)
  6. Disconnect cleanly

### Phase 4: Validation + tests
- Run `npm run seed` against a local PostgreSQL instance (requires TASK-0001 schema)
- Verify: 50+ apps present, each has ≥10 shortcuts, script exits 0
- Write integration test in `database/tests/seed.test.ts`:
  - Verify app count ≥ 50 after seed
  - Verify FTS query `to_tsquery('english', 'undo')` returns results in <100ms
- Run `npm run test` in `database/` to confirm tests green
- Run `npx tsc --noEmit` if any TypeScript is added to `packages/core`

---

## What is NOT in this plan
- API endpoints (TASK-0003)
- Web UI (Goal 2)
- Community submission flow (Goal 8)
- Shortcut versioning
- FTS integration in the API layer (TASK-0003)

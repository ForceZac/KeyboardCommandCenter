# TRD: Seed Script & Data for 50+ Applications

**Task:** TASK-0002
**Branch:** goals/2-seed-script
**PRD:** research/agents/prds/goal-01-shortcut-data-schema.md
**Date:** 2026-05-09

---

## What we're building

The PRD requires a populated shortcut database before any downstream feature (web search, desktop panel) can be developed or tested. TASK-0002 delivers that data layer: static JSON seed files for 50+ applications, a TypeScript seed script that reads those files and upserts records into the database via Prisma, and a PostgreSQL migration that adds GIN full-text search indexes on command descriptions and application names. This task depends on TASK-0001's 6-model Prisma schema being on `main` before the build phase can execute; the TRD can be reviewed independently.

---

## Technical components needed

**New backend components:**

- `database/seeds/seed.ts` — standalone TypeScript seed script (not part of application runtime). Reads all JSON files from `database/seeds/apps/`, upserts reference data (platforms, categories), then upserts applications, shortcuts, and per-platform key bindings/steps via Prisma. Idempotent — safe to re-run on an existing database.

**New data files:**

- `database/seeds/apps/<slug>.json` — one JSON file per application (50+ total). Each file contains the app's metadata and its shortcuts with per-platform key bindings. Static and versionable — community can contribute by adding files.

**Schema changes:**

- No new Prisma models. One new migration: `database/migrations/20260509000001_add-fts-indexes/migration.sql` — adds two PostgreSQL GIN indexes using `to_tsvector('english', ...)` on `shortcuts.command` and `applications.name`. These are raw SQL (Prisma schema.prisma does not support GIN index syntax). This migration must apply after TASK-0001's `20260509000000_init-shortcut-schema`.

**Modified backend components:**

- `database/package.json` — add `"seed"` npm script: `tsx seeds/seed.ts`

**New frontend components:** None.

**API changes:** None.

---

## Seed file JSON format

Each `database/seeds/apps/<slug>.json` follows this shape (enforced by the seed script at parse time):

```json
{
  "name": "VS Code",
  "slug": "vscode",
  "description": "Lightweight but powerful source code editor",
  "category": "developer-tools",
  "shortcuts": [
    {
      "command": "Toggle Line Comment",
      "context": "Editor",
      "bindings": {
        "windows": {
          "steps": [{ "keyCombo": "Ctrl+/", "key": "/", "modifiers": ["Ctrl"] }]
        },
        "macos": {
          "steps": [{ "keyCombo": "Cmd+/", "key": "/", "modifiers": ["Cmd"] }]
        },
        "linux": {
          "steps": [{ "keyCombo": "Ctrl+/", "key": "/", "modifiers": ["Ctrl"] }]
        }
      }
    }
  ]
}
```

- `category` must match a `CategorySlug` from TASK-0001's `packages/core` types.
- `bindings` keys are `PlatformSlug` values (`windows`, `macos`, `linux`). Not all platforms need to be present for every shortcut.
- `steps` is an ordered array — chords have length > 1 (e.g. VS Code's `Ctrl+K, Ctrl+C` = 2 steps).
- `modifiers` entries are normalized modifier names matching `ModifierKey` from `packages/core` (e.g. `"Ctrl"`, `"Cmd"`, `"Alt"`, `"Shift"`, `"Win"`, `"Option"`).

---

## Apps to be seeded (50 total)

| Category | Count | Applications |
|---|---|---|
| Creative | 7 | Photoshop, Illustrator, Premiere Pro, After Effects, Figma, Blender, DaVinci Resolve |
| Developer Tools | 12 | VS Code, IntelliJ IDEA, PyCharm, WebStorm, GoLand, Vim, Neovim, Emacs, Sublime Text, iTerm2, Windows Terminal, Xcode |
| Productivity | 13 | Google Docs, Google Sheets, Google Slides, Word, Excel, PowerPoint, Notion, Slack, Obsidian, Trello, Zoom, Asana, Linear |
| Gaming | 4 | Steam, Discord, OBS Studio, Streamlabs OBS |
| Music | 4 | FL Studio, Ableton Live, Logic Pro, GarageBand |
| System | 5 | Windows 11, macOS, Ubuntu GNOME, i3 Window Manager, Windows Explorer |
| Browsers | 5 | Chrome, Firefox, Safari, Edge, Opera |

---

## Key architectural decisions

- **Static JSON over scraping:** seed files are committed to the repo, reviewable in PRs, and contribute-friendly. No scraping or live data fetching — avoids flaky builds and rate-limit issues.
- **One file per app:** keeps individual files small and diff-readable. Makes community contributions easy (one new file = one new app).
- **Upsert-based script:** `prisma.$transaction` + `upsert` on every entity ensures the script is idempotent. Re-running on a live database updates stale data rather than erroring.
- **FTS via raw SQL migration:** Prisma schema.prisma does not expose GIN index configuration. A hand-written migration (`IF NOT EXISTS`) is the standard Prisma pattern for this. The migration is self-contained and rolls forward cleanly.
- **No FTS in the seed script itself:** the GIN index migration and the seed script are independent; the migration can apply even before seeding, and the seed script does not need to know about FTS.
- **`tsx` runner for seed script:** avoids a separate TypeScript compilation step. No new build tooling — `tsx` is already used for Next.js tooling in the monorepo.

---

## Test coverage plan

- **Integration test** (`database/tests/seed.test.ts`): runs the seed script against a Docker Compose PostgreSQL instance (same infra as other integration tests per backend standards). Verifies:
  - Total application count ≥ 50
  - Each application has ≥ 10 shortcuts
  - FTS query (`to_tsquery('english', 'undo')`) executes in < 100ms and returns results
  - Script is idempotent — running it twice produces the same counts (no duplicates)
- **No unit tests for seed script** — it has no non-trivial domain logic; integration coverage is sufficient.
- **No E2E tests** — no web UI involved in this task.

---

## Out of scope (technical)

- Full-text search integration in API route handlers (TASK-0003)
- Pagination or filtering at the database layer (TASK-0003)
- User-customizable shortcuts or keymaps
- Community submission flow (Goal 8)
- Shortcut versioning by app version
- Any changes to `packages/core` types (TASK-0001 defined these; extending them is a separate task if needed)

---

## Risks and open questions

- **TASK-0001 must be merged first:** the seed script and FTS migration both depend on the 6-model schema being in `main`. If TASK-0001 is still awaiting merge during the build phase, the seed script cannot be tested. Plan: the build phase does not begin until TASK-0001 is on `main`.
- **Reviewer note from TASK-0001 TRD:** FK columns on `shortcut_key_bindings` and `shortcut_key_steps` lack `@@index` decorators. At current seed scale this is fine, but we should add `@@index` on the FK fields (`applicationId`, `shortcutId`, `bindingId`, `platformId`) before or during this task's build phase per the Reviewer's recommendation. Proposing to include this in the FTS migration as additional `CREATE INDEX` statements — this keeps all performance indexes in one migration and avoids a schema.prisma change that would require another Prisma migration.
- **Shortcut accuracy:** seed data is hand-authored from official docs. Risk of stale or platform-incorrect shortcuts. Mitigation: source from official keyboard shortcut reference pages; flag uncertain shortcuts with a `"note"` field in JSON.
- **`CategorySlug` type alignment:** TASK-0001 uses `CategorySlug` (not `CategoryName`). The JSON files must use the exact slug values defined in `packages/core` (e.g. `"developer-tools"`, not `"Developer Tools"`). Seed script validates at parse time.

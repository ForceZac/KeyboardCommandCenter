# TRD: Define Prisma Schema for Shortcut Database

**Task:** TASK-0001
**Branch:** goals/1-prisma-schema
**PRD:** research/agents/prds/goal-01-shortcut-data-schema.md
**Date:** 2026-05-09

---

## What we're building

The foundation layer for all of KeyboardCommandCenter: a normalized PostgreSQL schema managed by Prisma that stores applications, their shortcuts, platform-specific key bindings, and chord sequences. This maps directly to every PRD requirement — multi-platform support, chord support, context/scope, category taxonomy, and structured modifier storage. Without this schema, no downstream feature (web UI, search, desktop overlay) can be built or tested.

## Technical components needed

**Schema changes:**
- `categories` table — top-level taxonomy for applications. Fields: `id` (cuid), `name` (unique), `slug` (unique). Seeded with: Creative, Developer Tools, Productivity, Gaming, Music, System, Browsers.
- `platforms` table — OS variants a shortcut may target. Fields: `id`, `name` (unique), `slug` (unique). Seeded with: Windows, macOS, Linux.
- `applications` table — represents an app (e.g. VS Code, Photoshop). Fields: `id`, `name`, `slug` (unique), `description` (optional), `categoryId` (FK → categories).
- `shortcuts` table — a command within an application (e.g. "Save File"). Fields: `id`, `applicationId` (FK → applications), `command` (description), `context` (optional string: "Global", "Editor", "Normal Mode", etc.).
- `shortcut_key_bindings` table — one row per shortcut + platform combination. Fields: `id`, `shortcutId` (FK → shortcuts), `platformId` (FK → platforms). A shortcut with bindings on Win and Mac has two rows here.
- `shortcut_key_steps` table — one row per key-press step in a binding. Fields: `id`, `bindingId` (FK → shortcut_key_bindings), `stepOrder` (int, 1-based), `keyCombo` (display string, e.g. "Ctrl+Shift+P"), `key` (base key, e.g. "p"), `modifiers` (String[] PostgreSQL array, e.g. `["Ctrl", "Shift"]`). A simple shortcut has one step; a chord (e.g. Ctrl+K → Ctrl+C) has two steps with stepOrder 1 and 2.

**New backend components:**
- `database/schema.prisma` (modified) — adds the six models above to the existing placeholder schema. Migration generated via `prisma migrate dev --create-only`.

**New frontend components:**
- None — this task is schema only.

**API changes:**
- None — this task is schema only.

**New `packages/core` exports:**
- `packages/core/src/types.ts` (new) — hand-written TypeScript domain types kept free of `@prisma/client` dependency, usable by any package. Exports:
  - `ModifierKey` — `"Ctrl" | "Cmd" | "Alt" | "Option" | "Shift" | "Super" | "Win" | "Meta"` (normalized names per PRD)
  - `PlatformSlug` — `"windows" | "macos" | "linux"`
  - `CategoryName` — union of the seven category slugs
  - `ShortcutContext` — `string` (alias; context strings are app-defined)
  - Plain TS interfaces mirroring each model: `IApplication`, `IShortcut`, `IShortcutKeyBinding`, `IShortcutKeyStep`, `ICategory`, `IPlatform`

## Key architectural decisions

- **Schema lives in `database/schema.prisma`, not in `packages/core`** — the existing repo structure already placed the Prisma schema in the `database` workspace. This is where `prisma migrate` runs and where the Prisma client is generated. Keeping it there avoids restructuring.

- **`packages/core` types are hand-written interfaces, not Prisma re-exports** — this keeps `@kcc/core` free of `@prisma/client` as a runtime dependency. Other packages (`@kcc/web`, `@kcc/desktop`) can import lightweight domain types from core without pulling in the Prisma client. Packages that need the full Prisma client (e.g. a future API layer) will import from `@kcc/database` directly.

- **`ShortcutKeyStep` model for chords rather than a JSON column** — storing steps as rows (with `stepOrder`) keeps the data queryable and avoids opaque blobs. A single-step shortcut is just one row with `stepOrder = 1`.

- **`modifiers` as a `String[]` array column (PostgreSQL array)** — Prisma supports native PostgreSQL array types. This avoids a separate modifiers join table for what is effectively a small, bounded list per key press.

- **No full-text search index in this task** — the PRD FTS requirement is explicitly in TASK-0002's scope (seeding + indexing together). The schema must be in place first.

- **Modifier names normalized at write time** — the `ModifierKey` type in `@kcc/core` defines the canonical names (e.g. `"Ctrl"` not `"Control"`, `"Cmd"` not `"Command"`). Seed scripts and future submission flows are expected to normalize to these names before inserting.

## Test coverage plan

- **Schema validation:** `prisma validate` — confirms the schema is syntactically and semantically valid without requiring a live database. Run in CI.
- **Migration smoke test:** `prisma migrate dev --create-only` generates migration SQL; the test environment can run `prisma migrate deploy` against a test PostgreSQL instance to confirm the migration applies cleanly.
- **TypeScript compilation:** `tsc --noEmit` in `packages/core` — confirms exported types are valid TypeScript with no errors.

No unit tests beyond compilation — there is no domain logic in this task, only schema and type definitions.

## Out of scope (technical)

- Seed data, seed scripts, or static JSON files — those are TASK-0002.
- Full-text search index — TASK-0002.
- API endpoints or resolvers — Goal 2.
- Prisma client re-exports from `@kcc/core` — keeps core dependency-free.
- Application version tracking on shortcuts (future consideration per PRD).

## Risks and open questions

- **PostgreSQL array support in Prisma:** `String[]` fields require `provider = "postgresql"` in the datasource, which is already set. No risk.
- **Prisma migration environment:** the `prisma migrate dev --create-only` command generates the SQL without applying it, so no live DB is needed to complete this task. The Reviewer should note that the migration will be applied as part of TASK-0002 testing (which requires a seeded DB).
- **`@kcc/core` → `@kcc/database` dependency boundary:** if a future task needs Prisma-generated types in `core`, the team should add `@kcc/database` as a dev dependency of `core` and re-export. That is out of scope here.

# TRD: Define Prisma Schema for Shortcut Database

**Task:** TASK-0001
**Branch:** goals/1-prisma-schema
**PRD:** research/agents/prds/goal-01-shortcut-data-schema.md
**Date:** 2026-05-09

---

## What we're building

We are establishing the foundational PostgreSQL schema via Prisma ORM that all downstream features depend on. The PRD requires a normalized relational model covering Applications, Shortcuts, Categories, and Platforms — with first-class support for multi-platform key bindings, chord (multi-step) shortcuts, and context/scope scoping (e.g. "Normal Mode", "Editor", "Global"). We also need TypeScript types exported from `packages/core` so that the web app, desktop app, and overlay can share typed data structures without importing Prisma client directly.

---

## Technical components needed

**New backend components:**

- `database/schema.prisma` — Full Prisma schema defining all models and relations (replaces current placeholder)

**Schema changes:**

- **`categories` table** — Top-level groupings for applications. Fields: `id`, `name` (unique), `slug` (unique, URL-safe), `description`, `icon` (string — icon name or emoji for UI). Covers: Creative, Developer Tools, Productivity, Gaming, Music, System, Browsers.

- **`platforms` table** — Represents operating systems a shortcut binding targets. Fields: `id`, `name` (enum: `WINDOWS`, `MACOS`, `LINUX`). Kept as a table (not just an enum column) to allow future per-platform metadata (e.g. distro variants). Unique constraint on `name`.

- **`applications` table** — A software application in the catalog. Fields: `id`, `name`, `slug` (unique, URL-safe), `description`, `iconUrl` (nullable), `categoryId` (FK → categories), `createdAt`, `updatedAt`. One application belongs to one category; one category has many applications.

- **`shortcuts` table** — A logical shortcut command — the action being performed, independent of OS binding. Fields: `id`, `applicationId` (FK → applications), `command` (short label, e.g. "Cut"), `description` (human-readable explanation), `context` (string — where in the app this applies: "Global", "Editor", "Terminal", "Normal Mode", "Insert Mode", etc.; nullable for app-global shortcuts), `isChord` (boolean — true if this shortcut requires multiple sequential key presses), `createdAt`, `updatedAt`.

- **`shortcut_steps` table** — Represents one step in a chord sequence, or the single step for non-chord shortcuts. Fields: `id`, `shortcutId` (FK → shortcuts), `stepOrder` (int, 1-based — defines sequence for chords), `keyCombo` (display string, e.g. "Ctrl+K"), `modifiers` (string[] — normalized array of modifier names: "Ctrl", "Cmd", "Alt", "Option", "Shift", "Super", "Win"), `key` (string — the base key, e.g. "K", "F5", "Space", "Delete"). A non-chord shortcut has exactly one `shortcut_step` with `stepOrder = 1`. A chord like VS Code's Ctrl+K → Ctrl+C has two steps with `stepOrder` 1 and 2.

- **`shortcut_bindings` table** — Links a `shortcut_step` to a specific platform, allowing the same logical shortcut to have different key combos on Windows vs macOS vs Linux. Fields: `id`, `stepId` (FK → shortcut_steps), `platformId` (FK → platforms), `keyCombo` (display string for this platform, e.g. "Cmd+K" on macOS vs "Ctrl+K" on Windows), `modifiers` (string[] — platform-specific modifiers), `key` (string — platform-specific base key). Unique constraint on `(stepId, platformId)`. If a shortcut has no platform-specific override, a single binding covers all platforms (can be represented by a special "ALL" platform entry, or by convention a null platformId — see key decisions).

**New frontend/core components:**

- `packages/core/src/types.ts` — TypeScript interfaces mirroring the Prisma models. Exported by `packages/core/src/index.ts`. These are plain interfaces (no Prisma imports) so web, desktop, and overlay can use them without a database dependency.
  - `Platform` enum: `WINDOWS | MACOS | LINUX`
  - `Modifier` enum: `CTRL | CMD | ALT | OPTION | SHIFT | SUPER | WIN`
  - `CategoryRecord` interface
  - `ApplicationRecord` interface
  - `ShortcutRecord` interface (includes nested `steps: ShortcutStepRecord[]`)
  - `ShortcutStepRecord` interface (includes `bindings: ShortcutBindingRecord[]`)
  - `ShortcutBindingRecord` interface

**No new API endpoints.** No web UI. No seed data. Per PRD scope.

---

## Key architectural decisions

**1. Chord support via `shortcut_steps` table, not a self-referential column.**
A chord is a sequence of key presses (e.g. Ctrl+K then Ctrl+C). Storing this as a single string ("Ctrl+K → Ctrl+C") would make it unsearchable and uneditable. A separate `shortcut_steps` table with an ordered `stepOrder` column cleanly represents both single-key shortcuts (one step) and multi-step chords (N steps) in the same data structure without nulls or special-casing.

**2. Platform-specific bindings at the step level, not the shortcut level.**
A shortcut like "Copy" may be Ctrl+C on Windows/Linux and Cmd+C on macOS. These are the same logical command with different bindings per platform. Storing the binding at the `shortcut_step` level (via `shortcut_bindings`) allows per-step, per-platform overrides without duplicating the shortcut record or the command metadata.

**3. Both `keyCombo` string and structured `modifiers[]` + `key` fields on binding records.**
Per PRD recommendation: `keyCombo` is a human-readable display string ("Ctrl+Shift+P") for fast UI rendering; `modifiers[]` + `key` are machine-readable for programmatic remapping, search filtering, and future conflict detection. Both are stored on `shortcut_bindings` (and `shortcut_steps` for platform-agnostic defaults).

**4. `context` field as a free string, not a foreign key.**
Context/scope values vary greatly across applications (Vim uses "Normal Mode"/"Insert Mode"/"Visual Mode"; VS Code uses "Editor"/"Terminal"; most apps just use "Global"). A foreign key to a `contexts` table would require pre-seeding every possible context value, creating friction for contributors. A free string field is simpler, and context values can be normalized later if needed (Goal 8+).

**5. `platforms` as a table, not a pure Prisma enum.**
A Prisma `enum` would work, but a `platforms` table allows future addition of platform metadata (version ranges, distro-specific notes) without a schema migration. The allowed values are still constrained by the `name` field using a Prisma `enum` type for the column value.

**6. `packages/core/src/types.ts` as plain TypeScript interfaces, not generated Prisma types.**
Prisma generates types in `node_modules/.prisma/client` — not portable to frontend/desktop/overlay packages that don't run a database. A manually maintained `types.ts` in `@kcc/core` provides typed shapes without a Prisma dependency. These types are kept in sync with the schema by convention; a future linting rule can enforce alignment.

---

## Test coverage plan

Since this task is schema-only (no API, no UI), test coverage focuses on database correctness:

- **Migration smoke tests:** Verify `prisma migrate dev` runs clean on a fresh empty PostgreSQL instance with no errors. Verify that running it twice is idempotent. (Manual / CI check via `prisma migrate deploy` in CI pipeline.)
- **Schema constraint tests (unit — Prisma in test DB):** Verify unique constraints (e.g. duplicate `application.slug` rejected). Verify FK constraints (e.g. creating a Shortcut without a valid `applicationId` fails). Verify `isChord` + multi-step round-trip (create Application → Shortcut → 2 ShortcutSteps → ShortcutBindings, query back and verify shape).
- **TypeScript compile test:** `tsc --noEmit` across all packages confirms `packages/core/src/types.ts` exports compile with no errors and are importable by `packages/web` and `packages/desktop`.
- No E2E tests — there is no UI in this task scope.

---

## Out of scope (technical)

- Seed data and seed script (TASK-0002)
- Full-text search indexes (TASK-0002 — added during seeding)
- PostgreSQL views or stored procedures
- Prisma middleware or soft-delete logic
- Multi-tenancy or user ownership of shortcuts
- Shortcut version tracking by app version
- Community submission flow (Goal 8)
- API routes (Goal 2)
- Web or desktop UI (Goals 2, 3+)

---

## Risks and open questions

- **Cross-platform default bindings:** If a shortcut is identical across all platforms (e.g. most browser shortcuts), should we create one binding per platform (3 rows) or a special "ALL_PLATFORMS" record? Creating 3 rows is verbose but consistent; a special "ALL" marker is DRY but adds nullable FK complexity. Recommendation: store 3 explicit rows per platform in seed data. Schema doesn't enforce this — seed script handles convention.

- **`modifiers[]` storage:** PostgreSQL `TEXT[]` arrays work well in Prisma (`String[]` maps to `text[]`). Querying for shortcuts with a specific modifier requires `@> ARRAY['Ctrl']` syntax. This is acceptable for now; if query complexity grows, a `shortcut_modifiers` join table could be added later.

- **Prisma version compatibility:** Using Prisma 5.x. The `String[]` array type requires `@db.Text` annotation in some configurations. Will verify during implementation.

- **`packages/core/src/types.ts` drift:** Plain interfaces can fall out of sync with the Prisma schema. This is a known tradeoff. Acceptable for now; a future task could add a code generation step or lint rule.

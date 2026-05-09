# Goal 1 — Shortcut Data Schema & Seed Database

**Roadmap phase:** Phase 1 — Foundation
**PRD:** KeyboardCommandCenter/research/agents/prds/goal-01-shortcut-data-schema.md

Goal 1 establishes the data foundation for all of KeyboardCommandCenter: a normalized PostgreSQL schema that stores applications, their keyboard shortcuts, per-platform key bindings, and chord sequences. It also covers seeding that schema with 50+ real-world applications and building the full-text search index the web interface depends on. Nothing downstream — web UI, desktop overlay, API routes — can be built without this goal in place.

---

## TASK-0001: Define Prisma Schema for Shortcut Database
**PR:** #1 | **Branch:** goals/1-prisma-schema | **Approved:** 2026-05-09

### What shipped
A six-model Prisma schema (`Category`, `Platform`, `Application`, `Shortcut`, `ShortcutKeyBinding`, `ShortcutKeyStep`) with a generated migration SQL file and hand-written TypeScript domain types in `packages/core/src/types.ts`. The schema supports multi-platform key bindings via the `ShortcutKeyBinding` join model (one row per shortcut+platform pair) and chord sequences via `ShortcutKeyStep` rows with a `stepOrder` field. Modifier keys are stored as a `String[]` PostgreSQL array with canonical names enforced by the `ModifierKey` type.

### Key technical decisions
- **`ShortcutKeyStep` rows for chord support** — storing chord steps as relational rows (not JSON) keeps them queryable and avoids opaque blobs; single-step shortcuts are just one row with `stepOrder = 1`.
- **`modifiers` as a PostgreSQL `String[]` array** — avoids a separate modifiers join table for a small, bounded list per key press; Prisma natively supports this.
- **Hand-written interfaces in `@kcc/core`, no Prisma re-exports** — keeps `@kcc/core` free of `@prisma/client` so web, desktop, and overlay packages can import lightweight domain types without the Prisma runtime.
- **Schema in `database/` workspace** — matches the existing monorepo layout; `prisma migrate` runs here and generates the client.

### Codebase areas touched
- **Backend:** `database/schema.prisma` (6 models), `database/migrations/20260509000000_init-shortcut-schema/migration.sql`
- **Frontend:** None (schema-only task)
- **Tests:** `prisma validate` (schema syntax/semantics), `tsc --noEmit` in `packages/core` (type correctness). No unit tests — no domain logic in this task.

### Reviewer notes
`ICategory.slug` and `IPlatform.slug` are typed as `SomeUnion | string`, which collapses to `string` in TypeScript — slug validation must happen at the application layer (seed script, submission flow), not the type layer. TASK-0002 seed script should validate slugs against the `CategorySlug` type explicitly before inserting.

# Plan: TASK-0001 — Define Prisma Schema for Shortcut Database

**Branch:** goals/1-prisma-schema
**Task:** TASK-0001
**PRD:** research/agents/prds/goal-01-shortcut-data-schema.md

---

## Work breakdown

### Phase 1: Prisma schema models
- Add `Category` model to `database/schema.prisma` (name, slug)
- Add `Platform` model (name, slug — Windows/macOS/Linux)
- Add `Application` model (name, slug, description, category FK)
- Add `Shortcut` model (application FK, command description, optional context)
- Add `ShortcutKeyBinding` model (shortcut FK, platform FK — one row per shortcut+platform combo)
- Add `ShortcutKeyStep` model (binding FK, stepOrder, keyCombo string, key, modifiers array — supports chords)
- Run `prisma validate` to confirm schema is valid
- Generate a migration file with `prisma migrate dev --create-only --name init-shortcut-schema`

### Phase 2: TypeScript types in packages/core
- Create `packages/core/src/types.ts` with domain types:
  - `ModifierKey` — literal union of normalized modifier names
  - `PlatformSlug` — "windows" | "macos" | "linux"
  - `CategoryName` — union of all category slugs from the PRD
  - `ShortcutContext` — string alias (open-ended, app-defined context strings)
  - Mirror interfaces for all models (Application, Shortcut, ShortcutKeyBinding, ShortcutKeyStep, etc.)
- Export all types from `packages/core/src/index.ts`

### Phase 3: Validate and wrap up
- Run `prisma validate` to confirm schema is well-formed
- Confirm `packages/core` builds without errors (`cd packages/core && npx tsc --noEmit`)
- Update `backlog.md` — fill in Branch, PR, TRD fields
- Commit plan + TRD, push, open draft PR

---

## What is NOT in this plan
- Seed data or seed script (TASK-0002)
- Full-text search index (TASK-0002)
- API endpoints (Goal 2)
- Web UI (Goal 2)

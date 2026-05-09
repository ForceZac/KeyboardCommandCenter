# PRD: Goal 01 — Shortcut Data Schema & Seed Database

**Status:** ready
**Owner:** Product Manager agent
**Last updated:** 2026-05-09

## Problem

Every other feature — web search, desktop panel, overlay, process detection — depends on having a well-structured, queryable shortcut database. Without a solid schema and seed data, nothing downstream can be built or tested. Power users across creative, development, gaming, and productivity software currently have no single source of truth for keyboard shortcuts. Data is scattered across official docs, community wikis, and app settings menus.

## User stories

- As a power user, I want to browse shortcuts organized by application so I can quickly find the commands I need.
- As a developer building the web UI, I want a typed, normalized schema so I can query shortcuts by app, platform, category, and context without data wrangling.
- As a contributor (future), I want a clear data model so I know exactly what fields a shortcut entry needs.

## UX flow

1. Developer runs the seed script against a local PostgreSQL instance.
2. Database populates with 50+ applications and their verified shortcuts.
3. Each shortcut record includes: app name, category, platform(s), key combination, command description, and context/scope.
4. Data is queryable via Prisma — full-text search across command descriptions and app names works out of the box.

## Success metrics

- Prisma schema compiles and migrates cleanly on a fresh PostgreSQL instance.
- Seed script completes without errors and populates 50+ applications.
- Each application has at least 10 verified shortcuts.
- Schema supports multi-platform shortcuts (Win/Mac/Linux) per command.
- Full-text search query returns results in <100ms on seeded data.
- Schema handles chords (multi-step shortcuts like Ctrl+K, Ctrl+C) and context-scoped shortcuts (e.g. "Editor" vs "Terminal").

## Scope

**In:**
- Prisma schema design: Application, Shortcut, Category, Platform models and their relationships
- Platform support: Windows, macOS, Linux key combos stored per shortcut (a single command may have different bindings per OS)
- Modifier key normalization: consistent representation of Ctrl/Cmd, Alt/Option, Shift, Super/Win
- Chord support: multi-step shortcuts (e.g. VS Code's Ctrl+K → Ctrl+C)
- Context/scope field: where a shortcut is active within an app (e.g. "Global", "Editor", "Terminal", "Navigator")
- Category taxonomy: top-level categories for applications (e.g. "Creative", "Developer Tools", "Productivity", "Gaming", "Communication", "System")
- Seed script covering 50+ popular applications across categories:
  - Creative: Adobe Photoshop, Illustrator, Premiere Pro, After Effects, Figma, Blender
  - Developer: VS Code, JetBrains IDEs, Vim/Neovim, Sublime Text, Terminal/iTerm
  - Productivity: Google Docs/Sheets, Microsoft Office (Word, Excel, PowerPoint), Notion, Slack, Obsidian
  - Gaming: Steam, Discord, OBS Studio
  - Music: FL Studio, Ableton Live, Logic Pro
  - System: Windows OS, macOS, Ubuntu/GNOME
  - Browsers: Chrome, Firefox, Safari
- Full-text search index on command descriptions and app names
- TypeScript types exported from `packages/core` for shared use

**Out:**
- Web UI (Goal 2)
- User-customizable keymaps or reading user config files (open question — deferred)
- Community submission flow (Goal 8)
- API endpoints (Goal 2)
- Desktop app integration (Goal 3+)
- Shortcut versioning by app version (future consideration)

## Open questions

- Should we store shortcuts as a single string ("Ctrl+Shift+P") or decompose into structured modifier + key fields? Structured is more queryable but more complex to seed. **Recommendation:** store both — a `keyCombo` display string and structured `modifiers[]` + `key` fields for programmatic use.
- How do we handle apps with modal shortcuts (e.g. Vim normal vs insert mode)? **Recommendation:** use the `context` field — "Normal Mode", "Insert Mode", "Visual Mode" etc.
- Should the seed script pull from a static JSON/YAML file or scrape documentation? **Recommendation:** static JSON files per app in `database/seeds/` — reliable, versionable, reviewable. Community can contribute by adding seed files.

## Dependencies

- None — this is the foundation goal.

# Project Context

_High-level context every agent reads before acting. Keep this current — it's the anchor for all agent decisions._

## What we're building

Keyboard Command Center is a comprehensive keyboard shortcut database and background utility for power users. It catalogs shortcuts for all major software — from Adobe Creative Suite and JetBrains IDEs to Steam, FL Studio, and OS-level bindings — in a searchable, browsable web interface. When installed as a desktop app, it runs silently in the background, detects which application is in focus, and lets users instantly pull up the relevant shortcut list via a hotkey or system tray. An optional overlay mode displays shortcuts directly on screen without leaving the active app.

## Current status

- **Shipped goals:** Goal 1 (Schema & Seed), Goal 2 (Web Search & Browse), Goal 3 (Desktop App Shell), Goal 4 (Active Window Detection), Goal 5 (Shortcut Panel UI), Goal 6 (Overlay Mode)
- **Active goal:** Goal 7 — User Accounts & Favorites Sync (6 tasks: TASK-0021 shipped, TASK-0022 shipped, TASK-0023 in review — PR #23 ready for review, TASK-0024 Ready, TASK-0025 blocked on TASK-0023, TASK-0026 blocked on TASK-0025)
- **Queued:** Goal 8 — Community Contributions (PRD exists, TASK-0027 scoped in Blocked), Goal 9 — Auto-Update (PRD file missing — Product Manager logged writing it but file not found in prds/), Goal 10 — Linux Support (no PRD yet)
- **Stage:** Active development — Goals 1–6 shipped, Goal 7 in progress

## Architecture decisions

- **Monorepo structure:** `packages/web` (Next.js), `packages/desktop` (Electron), `packages/core` (shared logic/types), `packages/overlay` (lightweight React overlay UI), `database/` (Prisma schema/migrations/seeds)
- **Desktop uses Electron + Rust native modules** for low-overhead process detection
- **PostgreSQL via Prisma ORM** — raw SQL only for full-text search optimizations
- **Privacy-first:** no keylogging, no telemetry of user app usage without explicit opt-in

## Key file index

- `research/implementation-roadmap-v2.md`: 10-goal roadmap in dependency order
- `research/agents/backlog.md`: active task queue
- `research/agents/prds/`: Product Manager PRDs per goal
- `research/agents/prompts/`: agent prompt files
- `memory/feedback_backend_standards.md`: backend coding standards
- `memory/feedback_frontend_standards.md`: frontend coding standards

## Constraints

- **Team size:** 1 (solo — Zach)
- **Budget:** $0 during dev phase — free tiers only. Up to $50/month at launch.
- **Current phase:** dev — local Next.js dev server + local PostgreSQL (Docker Compose), Electron dev mode with hot reload.
- **Repo:** ForceZac/KeyboardCommandCenter on GitHub, `main` branch, `task/` branch prefix.

## Environment variables (names only — values in .env.local)

- `DISCORD_BOT_TOKEN` — bot auth for discord-post.js
- `DATABASE_URL` — PostgreSQL connection string
- `GITHUB_TOKEN` — CI + PR automation + gh CLI
- `ANTHROPIC_API_KEY` — direct Anthropic API calls (if needed)
- `NEXTAUTH_SECRET` — session encryption
- `NEXTAUTH_URL` — callback URL
- `SENTRY_DSN` — error tracking
- `POSTHOG_API_KEY` — analytics
- `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` — macOS notarization
- `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` — Windows code signing

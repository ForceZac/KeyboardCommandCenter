# Project Context

_High-level context every agent reads before acting. Keep this current — it's the anchor for all agent decisions._

## What we're building

Keyboard Command Center is a comprehensive keyboard shortcut database and background utility for power users. It catalogs shortcuts for all major software — from Adobe Creative Suite and JetBrains IDEs to Steam, FL Studio, and OS-level bindings — in a searchable, browsable web interface. When installed as a desktop app, it runs silently in the background, detects which application is in focus, and lets users instantly pull up the relevant shortcut list via a hotkey or system tray. An optional overlay mode displays shortcuts directly on screen without leaving the active app.

## Current status

- **Shipped goals:** Goal 1 (Schema & Seed), Goal 2 (Web Search & Browse), Goal 3 (Desktop App Shell), Goal 4 (Active Window Detection), Goal 5 (Shortcut Panel UI), Goal 6 (Overlay Mode), Goal 7 (User Accounts & Favorites Sync)
- **Active goals:** Goal 8 — Community Contributions (TASK-0028/0029 Ready, TASK-0030 Blocked on 0028, TASK-0031/0032 unblocked waiting for Ready slot); Goal 10 — Linux Support (TASK-0038 Approved PR #33, TASK-0039 Ready)
- **Shipped in parallel:** Goal 9 — Auto-Update & Distribution (TASK-0033/0034/0035 all merged)
- **Approved awaiting /merge:** TASK-0038 (PR #33), TASK-0037 (PR #32 merged), TASK-0036 (PR #31 merged), TASK-0035 (PR #30 merged), TASK-0034 (PR #29 merged), TASK-0033 (PR #28 merged), TASK-0027 (PR #27 merged)
- **PRD gaps:** Goals 9 and 10 have no PRDs in `research/agents/prds/` — see PROP-0008
- **Stage:** Active development — Goals 1–9 shipped, Goal 8 & 10 active

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

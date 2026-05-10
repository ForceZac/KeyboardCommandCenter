# Proposals

Off-roadmap ideas and system-improvement suggestions surfaced by the agents. The owner reviews and promotes items into the roadmap or the backlog.

## Format

```markdown
### PROP-NNNN: short title
- **Source:** agent that filed it (PM / System Reviewer / Domain Researcher / etc.)
- **Date:** YYYY-MM-DD
- **Impact:** 1–5
- **Effort:** 1–5
- **Evidence:** concrete log citations, timestamps, task IDs
- **Proposal:** the suggestion
- **Status:** open / accepted / rejected / deferred
```

---

## Open

### PROP-0001: Goal 3 work shipped without PRD or backlog tracking
- **Source:** Project Manager
- **Date:** 2026-05-09
- **Impact:** 4
- **Effort:** 1
- **Evidence:** PR #4 (goals/6-electron-app-shell) merged 2026-05-09 18:07 ET. TASK-0006 appears in agent-log.md developer entries but was never created in backlog.md. No PRD exists at research/agents/prds/goal-03-*.md. Developer worked on and shipped Goal 3 (Electron App Shell) entirely outside the PM→PRD→backlog flow.
- **Proposal:** (1) Product Manager should retroactively write goal-03 PRD to document what was built and establish acceptance criteria for future Goal 3 tasks. (2) Review whether the remaining Goal 3 definition-of-done items (global hotkey, <50MB RAM idle, CI builds for Win+Mac) were covered by PR #4 or still need tasks. (3) Reinforce that the Developer should only pick up tasks from backlog.md's Ready section, and the PM is the only agent that creates tasks. Owner decision needed on whether to accept what shipped as-is or require additional work to meet the full Goal 3 spec.
- **Status:** open

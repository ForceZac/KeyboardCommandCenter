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

### PROP-0002: Enforce agent-log entry on every TRD and code review (from System Reviewer, 2026-05-09)
- **Source:** System Reviewer
- **Date:** 2026-05-09
- **Impact:** 5
- **Effort:** 1
- **Evidence:** TRD Watcher reviewed TASK-0001 (Developer confirms approval at 12:30 ET), TASK-0004 (confirmed at 17:50), and TASK-0007 (confirmed at 20:20) without any agent-log entries. Reviewer reviewed PR #3 round 2 (~16:59 ET), PR #4 round 1, PR #5 round 1, and PR #6 without agent-log entries. 7 actions total invisible to audit.
- **Proposal:** Add a hard rule to both `prompts/trd-watcher.md` and `prompts/reviewer.md`: "Every review decision (approve, changes-requested, pending-human) MUST produce an agent-log entry BEFORE the run exits. A review without a log entry is a bug — the System Reviewer cannot verify compliance, turnaround times, or score trends without it." This is a one-line prompt addition with high observability impact.
- **Status:** open

### PROP-0003: Clean merge conflict markers from agent-log.md and add guard (from System Reviewer, 2026-05-09)
- **Source:** System Reviewer
- **Date:** 2026-05-09
- **Impact:** 4
- **Effort:** 1
- **Evidence:** agent-log.md lines 561–562 contain `<<<<<<< Updated upstream` / `=======` and line 743 contains `>>>>>>> Stashed changes`. These were introduced during a branch merge and never resolved. They corrupt the log structure.
- **Proposal:** (1) Manually clean the conflict markers from agent-log.md now. (2) Add a pre-append check to the Developer and Merge Watcher prompts: before appending to agent-log.md, run `grep -c '<<<<<<' agent-log.md` — if non-zero, resolve the conflict markers first (keep both sides, remove markers). This prevents corrupt logs from accumulating silently.
- **Status:** open

### PROP-0004: Fix Discord channel allowlisting (from System Reviewer, 2026-05-09)
- **Source:** System Reviewer
- **Date:** 2026-05-09
- **Impact:** 4
- **Effort:** 1
- **Evidence:** Every PM run from 12:03 to 20:36 ET (14 runs) logged "FAILED — #standup and #main channels not allowlisted." Developer at 20:16 also failed. Zero Discord messages were posted all day despite agents attempting to communicate status, summaries, and blockers.
- **Proposal:** The owner needs to run `/discord:access` to allowlist #main (1494231685900931192) and #standup (1494239168954503358) channels. Until this is done, all agent-to-Discord communication is silently dropped. This is a 1-minute owner action that unblocks all agent communication.
- **Status:** open

### PROP-0005: Write PROP-0001 that PM promised but never filed (from System Reviewer, 2026-05-09)
- **Source:** System Reviewer
- **Date:** 2026-05-09
- **Impact:** 3
- **Effort:** 1
- **Evidence:** PM at 18:34 ET logged "filed PROP-0001 for process bypass" and "proposals added: 1 (PROP-0001 — Goal 3 process bypass)". backlog.md TASK-0006 references "see PROP-0001" twice. But proposals.md is empty — no PROP-0001 was ever written. Four subsequent PM log entries reference PROP-0001 as "still open." The PM either needs a reminder to actually write to proposals.md, or the PM prompt's proposal-filing step needs reinforcing: "After logging 'proposals added: N', verify the proposal exists in proposals.md before exiting."
- **Status:** open

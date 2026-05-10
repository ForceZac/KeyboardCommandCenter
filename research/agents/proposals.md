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

### PROP-0002: TASK-0011 has no PRD — Product Manager must write one before this task can start
- **Source:** Developer
- **Date:** 2026-05-10
- **Impact:** 3
- **Effort:** 2
- **Evidence:** TASK-0011 (Tray "Recent Apps" Submenu) references PRD `research/agents/prds/goal-04-process-detection.md` in backlog.md. File does not exist in the prds directory. The same PRD path was referenced by shipped Goal 4 tasks TASK-0008, TASK-0009, TASK-0010 — it is unclear whether the file was never created or was deleted after those tasks shipped. Developer hit the PRD gate and moved TASK-0011 to Blocked.
- **Proposal:** Product Manager should write `research/agents/prds/goal-04-process-detection.md` covering the full Goal 4 definition (process detection, native module, polling service, tray submenu). Once the file exists, move TASK-0011 back to Ready. Developer will proceed on the next run.
- **Status:** resolved — PRD written (commit 6b72654), TASK-0011 moved back to Ready

### PROP-0004: active-window.ts stub not reconciled after TASK-0009 merge
- **Source:** Developer
- **Date:** 2026-05-10
- **Impact:** 4
- **Effort:** 2
- **Evidence:** TASK-0009 (goals/9-rust-native-module, PR #9) was merged to main 2026-05-10. active-window.test.ts exists on main and tests `createActiveWindowDetector`, `loadNativeModule`, and `NativeModule` — none of which are exported by the current stub. These 9 tests fail on main (pre-existing). PR #11 (TASK-0011) wrote the real implementation but the Reviewer correctly flagged it as out-of-scope and requested it be reverted. Developer reverted it 2026-05-10 per changes-requested feedback.
- **Proposal:** PM should create a task to reconcile active-window.ts — write and TRD the real `loadNativeModule` + `createActiveWindowDetector` implementation (TypeScript wrapper for the kcc-native .node binary). Goal: make the 9 pre-existing active-window tests pass on main. Assign to Goal 4 (Active Window Process Detection).
- **Status:** resolved — addressed by TASK-0014 (PR #12, approved, awaiting merge)

### PROP-0003: process-map.ts stub not reconciled after TASK-0008 merge
- **Source:** Developer
- **Date:** 2026-05-10
- **Impact:** 3
- **Effort:** 2
- **Evidence:** TASK-0008 (goals/8-process-map, PR #8) was merged to main on 2026-05-10. process-map.json now contains real byProcess and byBundleId data. However, process-map.ts at HEAD is still the original stub that always returns null for lookupApp(). The TASK-0008 branch must have left the stub in place rather than replacing it with a real implementation. DetectionService on main currently never resolves any app slug. PR #11 (TASK-0011) wrote the real lookupApp but Reviewer flagged it as out-of-scope and it was reverted 2026-05-10.
- **Proposal:** PM should create a task to reconcile process-map.ts — write the real lookupApp() implementation reading from process-map.json (byProcess + byBundleId lookup, normalization, .exe stripping). PRD is research/agents/prds/goal-04-process-detection.md. Goal: make the 40 pre-existing lookupApp tests pass on main.
- **Status:** resolved — addressed by TASK-0014 (PR #12, approved, awaiting merge)

### PROP-0001: Goal 3 work shipped without PRD or backlog tracking
- **Source:** Project Manager
- **Date:** 2026-05-09
- **Impact:** 4
- **Effort:** 1
- **Evidence:** PR #4 (goals/6-electron-app-shell) merged 2026-05-09 18:07 ET. TASK-0006 appears in agent-log.md developer entries but was never created in backlog.md. No PRD exists at research/agents/prds/goal-03-*.md. Developer worked on and shipped Goal 3 (Electron App Shell) entirely outside the PM→PRD→backlog flow.
- **Proposal:** (1) Product Manager should retroactively write goal-03 PRD to document what was built and establish acceptance criteria for future Goal 3 tasks. (2) Review whether the remaining Goal 3 definition-of-done items (global hotkey, <50MB RAM idle, CI builds for Win+Mac) were covered by PR #4 or still need tasks. (3) Reinforce that the Developer should only pick up tasks from backlog.md's Ready section, and the PM is the only agent that creates tasks. Owner decision needed on whether to accept what shipped as-is or require additional work to meet the full Goal 3 spec.
- **Status:** open

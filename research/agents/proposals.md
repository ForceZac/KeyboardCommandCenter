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

### PROP-0006: TRD Review Deadlock — Reviewer skips draft PRs but Developer waits for TRD approval
- **Source:** Project Manager
- **Date:** 2026-05-10
- **Impact:** 4
- **Effort:** 1
- **Evidence:** TASK-0023 (Desktop Auth Flow) TRD posted on draft PR #23 (2026-05-10). Developer has been idle for 5+ consecutive fires (19:10–19:50 ET on 05-10) waiting for TRD approval before building. Reviewer's most recent run (2026-05-10 19:07 ET) says "Only open PR (#23) is a draft — skipped per policy." Result: process deadlock — Developer won't build without TRD approval, Reviewer won't review a draft PR.
- **Proposal:** Two options: (1) Reviewer should review TRDs on draft PRs — TRDs are a design artifact ready for review even when the implementation hasn't started; the draft status correctly signals "code not ready for final review" but shouldn't block TRD review. (2) Developer marks PR as ready-for-review after TRD submission so the Reviewer picks it up, then converts back to draft if needed. Recommend option (1) — it's cleaner and matches the intent of the TRD-first workflow. This deadlock will recur on every future task unless the Reviewer's draft-skip policy is updated.
- **Status:** open

### PROP-0005: TASK-0019 began before TASK-0017 — overlay store schema defined in settings task
- **Source:** Developer
- **Date:** 2026-05-10
- **Impact:** 2
- **Effort:** 1
- **Evidence:** TASK-0019 (Overlay Settings UI) is first in the Ready queue. TASK-0017 (Overlay BrowserWindow) is second. TASK-0019's backlog notes say "Depends on TASK-0017 (overlay preferences in electron-store must exist)" — but TASK-0017 hasn't started. TASK-0017's scope explicitly includes defining the electron-store overlay preferences schema.
- **Proposal:** (1) PM should reorder the Ready queue so TASK-0017 precedes TASK-0019, since TASK-0019 depends on TASK-0017's store schema. (2) In the interim, TASK-0019's TRD defines the overlay store schema (enabled, hotkey, opacity, position, size with correct defaults); TASK-0017 should NOT redefine it — it will use what TASK-0019 establishes. The `OverlayController` interface/registry in TASK-0019 is the integration point TASK-0017 implements. (3) Acceptance criteria for live preview and hotkey registration in TASK-0019 are only verifiable once TASK-0017 is also merged.
- **Status:** open

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

### PROP-0007: Linux Packaging task lost in backlog branch divergence — needs PM triage
- **Source:** Developer
- **Date:** 2026-05-11
- **Impact:** 3
- **Effort:** 1
- **Evidence:** TASK-0035 branch (goals/35-github-actions-release-workflow) added `TASK-0037: Wayland Active Window Detection` and `TASK-0038: Linux Packaging — AppImage & .deb via electron-builder + CI Job` to Ready. The TASK-0036 branch (goals/36-linux-x11-detection) subsequently redefined TASK-0037 with a more detailed scope (adds manual fallback UI) and replaced TASK-0038 with `TASK-0038: Overlay X11 Compatibility — Transparency & Click-Through`. The Linux Packaging task (AppImage + .deb + CI job) from the TASK-0035 branch is now orphaned — it does not exist at any task ID in the TASK-0036 branch. Developer used the TASK-0036 branch definitions (most recently reviewed) when reconciling the main backlog.
- **Proposal:** PM should review and either: (1) assign Linux Packaging a new task ID (TASK-0039) and add it to Ready, or (2) confirm the TASK-0036 branch's definition of TASK-0038 (Overlay X11) is correct and Linux Packaging is intentionally deferred/dropped. Linux Packaging (AppImage/deb + CI job) was in the Goal 10 PRD and is needed before Linux support can ship.
- **Status:** resolved — addressed by TASK-0039 (Linux Packaging — AppImage & .deb + CI Job, added to Ready)

### PROP-0008: Goals 9 & 10 missing PRDs — tasks created and shipped in violation of hard scope rule
- **Source:** Project Manager
- **Date:** 2026-05-11
- **Impact:** 4
- **Effort:** 2
- **Evidence:** `research/agents/prds/goal-09-auto-update-distribution.md` and `research/agents/prds/goal-10-linux-support.md` do not exist on main or any branch. Confirmed via `git log --all --diff-filter=A` — neither file was ever committed. Yet TASK-0033/0034/0035 (Goal 9) were created, approved, and merged; TASK-0036/0037/0038/0039 (Goal 10) were created with some shipped. All reference these non-existent PRDs. Prior PM runs (08:35 ET, 09:04 ET) incorrectly logged "all 10 goals have PRDs."
- **Proposal:** (1) Product Manager should write `goal-09-auto-update-distribution.md` (retroactive — all Goal 9 tasks shipped) and `goal-10-linux-support.md` (active — TASK-0038 approved, TASK-0039 in Ready, TASK-0031/0032 in Blocked) as soon as possible. (2) Goal 10 PRD is higher priority since active tasks reference it. (3) Process check: how did prior PM runs pass the PRD gate? The agent-log claims PRDs existed — this suggests the check was against the roadmap's `PRD:` field (which lists the expected path) rather than actually verifying the file exists on disk. Future PM runs must verify file existence, not just path references.
- **Status:** open

### PROP-0001: Goal 3 work shipped without PRD or backlog tracking
- **Source:** Project Manager
- **Date:** 2026-05-09
- **Impact:** 4
- **Effort:** 1
- **Evidence:** PR #4 (goals/6-electron-app-shell) merged 2026-05-09 18:07 ET. TASK-0006 appears in agent-log.md developer entries but was never created in backlog.md. No PRD exists at research/agents/prds/goal-03-*.md. Developer worked on and shipped Goal 3 (Electron App Shell) entirely outside the PM→PRD→backlog flow.
- **Proposal:** (1) Product Manager should retroactively write goal-03 PRD to document what was built and establish acceptance criteria for future Goal 3 tasks. (2) Review whether the remaining Goal 3 definition-of-done items (global hotkey, <50MB RAM idle, CI builds for Win+Mac) were covered by PR #4 or still need tasks. (3) Reinforce that the Developer should only pick up tasks from backlog.md's Ready section, and the PM is the only agent that creates tasks. Owner decision needed on whether to accept what shipped as-is or require additional work to meet the full Goal 3 spec.
- **Status:** open

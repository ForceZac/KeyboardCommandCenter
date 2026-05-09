# Autonomous Dev Agents — Personalization Checklist

The scaffold is in place. Walk this list before flipping any cron `enabled` flag to `true`.

## 1. Rename the project folder

Everything assumes the project repo lives at `./project/` relative to `/workspace`. If you want a different folder name:

- Rename `/workspace/project/` to `/workspace/<your-name>/`
- Replace every occurrence of `./project/` in `/workspace/crons/jobs.json` with `./<your-name>/`
- Update `scripts/agent-watch.js` too if you reference paths there

## 2. Drop your project repo in place

The `./project/` folder currently contains only the agent scaffolding (`research/`, `memory/`, `SETUP.md`). Clone or move your actual codebase so it shares this directory — `git`, source files, tests, etc. live alongside the `research/` tree. The agents `cd` into this folder and run `git` commands inside it.

## 3. Fill the standards memory files

Located at `project/memory/`:

- `feedback_backend_standards.md` — your backend patterns
- `feedback_frontend_standards.md` — your frontend patterns
- `feedback_separation_of_concerns.md` — what lives where
- `feedback_pull_requests.md` — PR policy (already generic, tweak as needed)
- `project_context.md` — current status, architecture decisions, key file index

The Reviewer enforces these; the Developer follows them. Weak standards = weak reviews.

## 4. Write the implementation roadmap

`project/research/implementation-roadmap-v2.md` — every goal in dependency order. The Project Manager treats this as law. No goals, no tasks.

## 5. Customize the agent prompts

Located at `project/research/agents/prompts/`. Each file says `[your-project]` — search and replace with your project name. Read each prompt and tune the domain specifics (the Domain Researcher in particular is currently written for the vet PIMS domain — rewrite for yours).

Files:
- `developer.md`
- `reviewer.md`
- `trd-watcher.md`
- `project-manager.md`
- `product-manager.md`
- `domain-researcher.md`
- `system-reviewer.md`

## 6. Set your Discord channel ID

In `/workspace/crons/jobs.json`, every job has `"discordChannel": "YOUR_CHANNEL_ID"`. Replace with the real channel ID you want agent posts to land in. Same for the `[your-project]` placeholder in every `name` and `message` field.

## 7. Have the Product Manager seed PRDs before enabling the Developer

The Developer will Block any task without a PRD. Run the Product Manager first (or write the first PRD by hand) so there's at least one goal with a PRD in `research/agents/prds/` before the Developer wakes up.

## 8. Seed the backlog

`project/research/agents/backlog.md` starts empty. Either:
- Add 2–3 Ready tasks by hand (only if their PRDs exist), or
- Let the Project Manager run first and populate from the roadmap

## 9. Flip crons on

In `/workspace/crons/jobs.json`, set `enabled: true` for each agent cron. Recommended order:

1. Product Manager (gets PRDs written)
2. Domain Researcher (starts feeding product notes)
3. Project Manager (starts grooming the backlog)
4. TRD Watcher, Reviewer, Merge Watcher, Log Trim (all the low-risk helpers)
5. Developer (last — only when you have PRDs + Ready tasks)
6. System Reviewer (once the system has 24h of history to audit)

## 10. Monitor

```bash
node /workspace/scripts/agent-watch.js
```

## Kill switch

```bash
touch project/research/agents/PAUSE   # all agents exit immediately on next wake
rm project/research/agents/PAUSE       # resume
```

## Files already scaffolded

```
project/
  SETUP.md                             ← this file
  memory/
    feedback_backend_standards.md
    feedback_frontend_standards.md
    feedback_separation_of_concerns.md
    feedback_pull_requests.md
    project_context.md
  research/
    implementation-roadmap-v2.md
    agents/
      backlog.md
      agent-log.md
      proposals.md
      product-notes.md
      system-health.md
      velocity.md
      prds/
        _TEMPLATE.md
      prompts/
        developer.md
        reviewer.md
        trd-watcher.md
        project-manager.md
        product-manager.md
        domain-researcher.md
        system-reviewer.md
    goals/
    plans/
```

All agent crons are present in `/workspace/crons/jobs.json` with `enabled: false` — flip them on once the personalization above is done.

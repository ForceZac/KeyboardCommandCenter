# Pull Request Policy

_How the Developer opens, updates, and closes PRs. The Reviewer enforces this._

## Draft PR first

- Open a draft PR as soon as a TRD is committed or meaningful scaffolding is in place.

## Commit discipline

- Conventional commits (feat:, fix:, chore:, docs:). One logical change per commit. Squash-merge to main.

## Marking ready

- All tests pass. No TypeScript errors. Lint clean. Desktop builds successfully on CI (Windows + Mac). Feature works in dev mode.
- Moving to **In Review** happens simultaneously with marking ready.

## Never merge

- The Developer never merges. The Reviewer never merges. The owner (Zach) merges to `main`.

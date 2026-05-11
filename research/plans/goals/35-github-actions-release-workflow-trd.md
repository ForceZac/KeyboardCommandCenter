# TRD: GitHub Actions Release Workflow — Build, Sign & Publish

**Task:** TASK-0035
**Branch:** goals/35-github-actions-release-workflow
**PRD:** research/agents/prds/goal-09-auto-update-distribution.md
**Date:** 2026-05-11

---

## What we're building

A GitHub Actions release pipeline and its supporting build configuration that — on every `v*` git tag push — builds the Electron desktop app for macOS (signed + notarized universal DMG) and Windows (signed NSIS installer for x64 and arm64), then uploads all artifacts plus electron-updater metadata files (`latest.yml`, `latest-mac.yml`) to a draft GitHub Release.

This task completes the Goal 9 distribution story: TASK-0033 (approved, pending merge) wired the in-app auto-updater to check for and install updates; TASK-0034 (approved) added the `/download` landing page. TASK-0035 creates the CI pipeline that actually produces the release artifacts both features depend on.

## Technical components needed

**New CI/CD components:**
- `.github/workflows/release.yml` — GitHub Actions workflow triggered on `v*` tag push; two parallel jobs (`build-mac`, `build-win`) that build, sign, and upload artifacts to a draft GitHub Release

**New desktop build components:**
- `packages/desktop/electron-builder.yml` — electron-builder configuration defining macOS (dmg, universal) and Windows (nsis, x64+arm64) targets, GitHub publisher pointing at `ForceZac/KeyboardCommandCenter`, and signing hooks; draft release type
- `packages/desktop/scripts/notarize.js` — afterSign hook called by electron-builder on macOS; submits the `.app` for Apple notarization using `@electron/notarize` with `waitForNotarization: true`; guarded by a `CI_NOTARIZE` env var so local builds don't attempt notarization

**Modified desktop components:**
- `packages/desktop/package.json` — new `build:mac` and `build:win` npm scripts that invoke electron-builder with the correct platform flags; adds `electron-builder` and `@electron/notarize` as devDependencies

**Schema changes:** No schema changes.

**API changes:** No new endpoints.

## Key architectural decisions

**electron-builder alongside electron-forge, not replacing it.** electron-forge's webpack plugin handles dev (hot reload, HMR) and stays untouched. electron-builder is a production-only concern. In CI, the webpack compilation runs via electron-forge's webpack CLI, then electron-builder packages the compiled output into platform-specific installers. This avoids duplicating the webpack config and keeps the dev workflow unchanged.

**Draft GitHub Releases (never auto-publish).** electron-builder's GitHub publisher is configured with `releaseType: draft`. After CI completes, Zach reviews the build artifacts and release notes on GitHub before publishing. This provides a human review gate before bits reach users — important for a solo project with no QA team.

**Build fails on signing/notarization failure.** The workflow has no fallback to unsigned builds. If `APPLE_DEVELOPER_IDENTITY`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `WIN_CSC_LINK`, or `WIN_CSC_KEY_PASSWORD` are missing or invalid, the job fails. This enforces the PRD requirement: never ship unsigned binaries.

**Universal macOS binary.** electron-builder's `--universal` flag merges x64 and arm64 builds into a single DMG. The Rust native module (`.node` file) will need both architectures bundled — handled by the macOS CI runner via `cargo build --target x86_64-apple-darwin` and `cargo build --target aarch64-apple-darwin` with `lipo` merge, triggered by the `@electron/rebuild` step during `npm install`.

**Update metadata files auto-generated.** electron-builder produces `latest-mac.yml` (macOS) and `latest.yml` (Windows) alongside the installer artifacts. These are uploaded to the draft GitHub Release automatically. When the release is published, electron-updater in the shipped desktop app (TASK-0033) will find these files and know a new version is available.

## Test coverage plan

This task produces no runtime business logic — it's a build configuration and CI workflow file. Test coverage is structural:
- **Manual smoke test (documented in PR):** Developer runs `build:mac` locally (without notarization) and confirms a `.dmg` is produced
- **CI itself is the test:** The workflow is the validation — a successful workflow run on a test tag proves all signing, notarization, and upload steps work
- No Vitest unit tests or Playwright E2E tests apply to CI configuration

## Out of scope (technical)

- Linux builds (TASK-0036 covers the runtime detection layer; a separate task will add Linux CI once the Linux native module ships)
- Auto-publishing releases (drafts only — human review gate required)
- Delta/differential update packages (full binary replacement)
- Version bumping automation (`package.json` version is bumped manually before tagging)
- Squirrel Windows installer (NSIS only — wider compatibility, cleaner uninstall path)
- Store distribution (GitHub Releases only for v1)

## Risks and open questions

- **Rust native module cross-compilation on macOS CI:** Building a universal `.node` requires both x64 and arm64 Rust targets plus `lipo`. The `macos-latest` runner supports both via `rustup target add` + separate cargo builds + `lipo`. This needs careful script ordering in the CI job before the `electron-builder --mac` step.
- **Windows arm64 signing:** Windows arm64 NSIS installer can be built on an x64 Windows runner (cross-compile). Signing works the same way. No separate arm64 runner needed.
- **CI secrets not populated:** The first real release run requires `APPLE_DEVELOPER_IDENTITY`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `WIN_CSC_LINK`, and `WIN_CSC_KEY_PASSWORD` to be added to GitHub repository secrets. The PR description will document the required secrets. The workflow can be tested with a self-signed or dummy cert to verify the pipeline structure.
- **electron-updater compatibility:** TASK-0033 (pending merge) configures `electron-updater` to use the GitHub provider. The `publish` block in `electron-builder.yml` must match the provider configuration TASK-0033 wrote. If TASK-0033's UpdateService uses a specific `feedURL` pattern, the electron-builder publish config must produce metadata files at the matching path.

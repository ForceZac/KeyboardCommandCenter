# Plan: TASK-0035 — GitHub Actions Release Workflow — Build, Sign & Publish

**Branch:** goals/35-github-actions-release-workflow
**PRD:** research/agents/prds/goal-09-auto-update-distribution.md
**Date:** 2026-05-11

---

## What we're building

A GitHub Actions CI workflow that triggers on `v*` tag push and produces signed, notarized macOS DMG and signed Windows NSIS installers — plus the `latest.yml` / `latest-mac.yml` update metadata files that electron-updater (TASK-0033) needs.

## Work breakdown (order of operations)

### Slice 1 — electron-builder configuration
- Add `electron-builder` + `@electron/notarize` as devDependencies in `packages/desktop/package.json`
- Create `packages/desktop/electron-builder.yml` with:
  - GitHub publisher (ForceZac/KeyboardCommandCenter, releaseType: draft)
  - macOS: dmg target, universal arch, Apple Developer identity, afterSign hook
  - Windows: nsis target, x64 + arm64
  - files: webpack output + native modules + overlay dist
  - extraResources: native/.node files, overlay/dist

### Slice 2 — notarization afterSign hook
- Create `packages/desktop/scripts/notarize.js`
- Reads APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD from env, calls `@electron/notarize`
- Exits early (no-op) if not a macOS production build (CI_NOTARIZE env guard)

### Slice 3 — build scripts in package.json
- Add `"build:mac"` and `"build:win"` scripts using electron-builder
- These compile via webpack first (via electron-forge's webpack plugin CLI), then package with electron-builder

### Slice 4 — GitHub Actions workflow file
- Create `.github/workflows/release.yml`
- Trigger: `push` on `tags: ['v*']`
- Job `build-mac`: macos-latest runner, sets up code signing cert + notarization creds, runs `build:mac`, uploads DMG + `latest-mac.yml`
- Job `build-win`: windows-latest runner, sets up code signing cert, runs `build:win`, uploads NSIS exe(s) + `latest.yml`
- Both jobs: upload artifacts to the draft GitHub Release created by electron-builder's GitHub publisher

### Slice 5 — backlog + log update
- Move TASK-0035 to In Review, update PR fields

## Key risks to address during build
- Rust `.node` native module must be compiled for the target platform in CI — `npm install` triggers node-gyp rebuild but we need to ensure architecture matches (universal on macOS)
- electron-builder webpack integration must consume the same entry points as electron-forge to avoid divergence
- Certificate secrets must be documented in the PR description for Zach to configure before first live run

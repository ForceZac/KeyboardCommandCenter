# Plan: TASK-0039 — Linux Packaging (AppImage & .deb via electron-builder + CI Job)

**Branch:** goals/39-linux-packaging
**Task:** TASK-0039
**PRD:** research/agents/prds/goal-10-linux-support.md

---

## Work breakdown

### Phase 1: electron-builder Linux configuration
- Add `linux:` section to `electron-builder.yml` with AppImage and deb targets (x64 only)
- Configure deb runtime dependencies (`libx11-6`, `libdbus-1-3`, `libappindicator3-1` as recommended)
- Add native module `extraResources` for Linux (arch-specific .node file from napi-rs)
- Create XDG `.desktop` file in `packages/desktop/assets/` for app launcher integration
- Add `build:linux` and `build:linux:local` scripts to `packages/desktop/package.json`

### Phase 2: XDG autostart integration
- Add autostart `.desktop` file creation logic in `packages/desktop/src/platform/`
- On first launch, prompt user to enable autostart (write `.desktop` to `~/.config/autostart/`)
- Wire autostart toggle into existing settings persistence (electron-store)
- Add settings UI entry for autostart toggle on Linux

### Phase 3: Tray icon Linux enhancements
- Ensure tray icon works with libappindicator3 / StatusNotifierItem on KDE and GNOME
- Add Linux-appropriate icon asset (PNG, not template) in `assets/`
- Handle absence of tray gracefully — global hotkey still works (existing TrayManager already does this)

### Phase 4: GitHub Actions Linux CI job
- Add `build-linux` job to `.github/workflows/release.yml`
- Use `ubuntu-latest` runner
- Install X11/DBus dev libraries (`libx11-dev`, `libxcb1-dev`, `libdbus-1-dev`)
- Build Rust native module for `x86_64-unknown-linux-gnu`
- Compile webpack via electron-forge, then run electron-builder for Linux targets
- Publish Linux artifacts (AppImage, .deb, `latest-linux.yml`) to draft GitHub Release

### Phase 5: Tests
- Vitest unit tests for autostart `.desktop` file generation logic
- Vitest unit tests for Linux-specific electron-builder config validation
- Verify existing tests still pass (no regressions on Windows/macOS config)

## Acceptance criteria mapping

| Acceptance criterion | Phase |
|---|---|
| electron-builder produces .AppImage and .deb for x64 | 1 |
| AppImage launches on Ubuntu 22.04+ | 1 (verified manually) |
| .deb installs via dpkg -i | 1 |
| .deb declares correct runtime deps | 1 |
| CI builds Linux alongside Win/Mac | 4 |
| CI Linux job installs dev libs | 4 |
| XDG autostart .desktop entry | 2 |
| Tray icon on GNOME + KDE | 3 |
| App works via hotkey when no tray | 3 (already handled) |
| latest-linux.yml published | 1, 4 |
| No regressions on Win/Mac | 5 |

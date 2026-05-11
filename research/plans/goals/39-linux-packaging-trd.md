# TRD: Linux Packaging — AppImage & .deb via electron-builder + CI Job

**Task:** TASK-0039
**Branch:** goals/39-linux-packaging
**PRD:** research/agents/prds/goal-10-linux-support.md
**Date:** 2026-05-11

---

## What we're building

The desktop app currently ships for Windows (NSIS) and macOS (DMG). This task adds Linux x64 packaging via electron-builder — producing an AppImage (universal, no-install) and a .deb (Debian/Ubuntu) — and extends the GitHub Actions release workflow with a parallel Linux CI job. It also adds XDG autostart support so the app can register itself for login startup on Linux, and ensures the tray icon works correctly on supported desktop environments. This maps to the PRD's "In scope" items: AppImage packaging, .deb packaging, CI Linux job, XDG autostart, tray via libappindicator3, and `latest-linux.yml` metadata.

## Technical components needed

**New backend components:**
- None — this task is packaging/CI/platform infrastructure only, no API changes.

**Modified backend components:**
- None.

**New frontend components:**
- None — no web UI changes in this task (download page updates are TASK-0040).

**Modified frontend components:**
- None.

**New desktop components:**
- `packages/desktop/src/platform/linux-autostart.ts` — XDG autostart manager that creates/removes a `.desktop` entry in `~/.config/autostart/`. Reads the current autostart state from the filesystem and exposes enable/disable functions. Used by settings persistence and the first-launch prompt.
- `packages/desktop/assets/keyboard-command-center.desktop` — XDG `.desktop` file template for app launcher integration (Name, Exec, Icon, Categories, StartupNotify). Bundled into the .deb and available for AppImage self-registration.
- `packages/desktop/assets/icon.png` — Linux tray/app icon (256x256 PNG). Electron on Linux requires a PNG, not the macOS template image or Windows ICO.

**Modified desktop components:**
- `packages/desktop/electron-builder.yml` — Add `linux:` section with AppImage and deb targets for x64. Configure deb `depends` (runtime libraries), `recommends` (libappindicator3-1), `category`, and `desktop` file reference. Add Linux-specific `extraResources` for the native module. Add `latest-linux.yml` to publish metadata for electron-updater.
- `packages/desktop/package.json` — Add `build:linux` and `build:linux:local` scripts mirroring the existing `build:mac` / `build:win` pattern.
- `packages/desktop/src/main.ts` — On Linux first launch, show a dialog prompting the user to enable XDG autostart. Wire the autostart toggle to the existing settings store.
- `packages/desktop/src/tray.ts` — Add Linux-specific icon path selection (PNG instead of template/ICO). The existing TrayManager already handles tray absence gracefully — no structural changes needed.

**Modified CI/CD:**
- `.github/workflows/release.yml` — Add a `build-linux` job that runs on `ubuntu-latest`, installs X11/DBus dev libraries, builds the Rust native module for `x86_64-unknown-linux-gnu`, compiles webpack, and runs electron-builder to produce AppImage + .deb artifacts published to the draft GitHub Release.

**Schema changes:**
- No schema changes.

**API changes:**
- No new endpoints.

## Key architectural decisions

- **x64 only for v1.** ARM64 Linux desktop usage is negligible per the PRD. This avoids cross-compilation complexity and a second CI runner. ARM64 can be added later if demand warrants.
- **AppImage + .deb, no RPM.** The PRD explicitly scopes out RPM. Fedora users can use AppImage. Two targets cover the widest audience with minimal packaging complexity.
- **libappindicator3-1 as `recommends`, not `depends`.** The PRD requires the app to function without a tray icon. Making it a hard dependency would prevent installation on systems without it. The existing TrayManager fallback (global hotkey still works) satisfies this requirement.
- **Reusing the existing electron-builder + electron-forge two-step pipeline.** The CI pattern is established: electron-forge compiles webpack, then electron-builder packages and publishes. The Linux job follows the same pattern — no new build tooling.
- **Single CI runner, no matrix.** Since we're only targeting x64, a single `ubuntu-latest` runner suffices. A matrix would be premature optimization for one architecture.
- **XDG autostart via filesystem `.desktop` file, not dbus or systemd.** Writing to `~/.config/autostart/` is the standard XDG autostart mechanism, works on all desktop environments, and requires no additional dependencies. The `.desktop` file is generated from a template with the correct `Exec` path resolved at runtime.
- **No code signing for Linux.** Per the PRD: "no established standard; checksums on GitHub Release are sufficient." electron-builder will produce SHA256 checksums in `latest-linux.yml`.

## Test coverage plan

- **Vitest unit tests:** linux-autostart.ts — test `.desktop` file content generation, enable/disable logic, path resolution for `~/.config/autostart/`. Mock the filesystem to test creation, removal, and idempotency.
- **Vitest unit tests:** Tray icon path selection — verify Linux gets PNG path, not template/ICO.
- **CI validation:** The `build-linux` job itself validates that electron-builder produces artifacts without errors. AppImage and .deb existence verified as a CI step.
- **Manual verification (not automated):** AppImage launches on Ubuntu 22.04+, .deb installs via dpkg -i, tray icon visible on GNOME/KDE. These are hardware/DE-dependent and can't be reliably automated in CI.
- **Regression:** Existing `build-mac` and `build-win` CI jobs are unchanged and continue to run in parallel — no regression vector.

## Out of scope (technical)

- RPM packaging (PRD: out of scope)
- ARM64 / aarch64 Linux builds (PRD: out of scope, x64 only)
- Flathub or Snap Store packaging (PRD: out of scope)
- AppImage delta updates (PRD: out of scope, full replacement is fine)
- Download page updates (TASK-0040)
- Wayland overlay support (blocked by protocol)
- APT repository / PPA setup
- Code signing for Linux packages

## Risks and open questions

- **CI build-time libraries:** The Linux runner needs `libx11-dev`, `libxcb1-dev`, `libdbus-1-dev` for the Rust native module. These are available in Ubuntu's package manager on `ubuntu-latest` but version pinning may be needed if napi-rs or x11rb expects specific versions. Low risk — `apt-get install` covers this.
- **Tray icon on GNOME without AppIndicator extension:** Per the PRD, we do not prompt users to install the extension. The app runs without a tray icon and relies on the global hotkey. The existing TrayManager code already handles this. No additional work expected, but worth verifying during manual testing.
- **AppImage electron-updater compatibility:** `latest-linux.yml` must be published to GitHub Releases for electron-updater to find it. electron-builder should handle this automatically when the `publish` config targets GitHub — but the filename format needs to match what electron-updater expects. Low risk but worth verifying.
- **`.desktop` file Exec path divergence:** AppImage users have the binary at an arbitrary path; .deb users have it at `/usr/bin/` or similar. The autostart `.desktop` file's `Exec` field must resolve correctly for both. Plan: detect the current executable path at runtime (`process.execPath`) and write that into the `.desktop` file.

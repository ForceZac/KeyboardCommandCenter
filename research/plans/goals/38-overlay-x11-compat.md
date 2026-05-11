# Plan: TASK-0038 — Overlay X11 Compatibility — Transparency & Click-Through

**Branch:** goals/38-overlay-x11-compat
**Task:** TASK-0038
**PRD:** research/agents/prds/goal-10-linux-support.md (Flows 5 and 6)

---

## What we're building

Extending the overlay feature to work on Linux. X11 gets full overlay support (transparency + click-through). Wayland gets a degraded experience (always-on-top without click-through, auto-dismiss, "experimental" label). Tray icon absence on minimal window managers is handled gracefully.

## Dependency note

This branch targets `main`. The build phase should begin after TASK-0036 (PR #31) is merged so that `linux.rs` detection infrastructure is present. The overlay changes themselves don't call into the Rust native module, but the TypeScript detection service (`detection.ts`) that the overlay reacts to will need TASK-0036 to function on Linux. The TRD and plan may be reviewed independently.

---

## Work breakdown

### Phase 1 — Linux session detection (TypeScript)
- New `packages/desktop/src/platform/linux-session.ts`
  - `detectLinuxSession(): 'x11' | 'wayland' | 'unknown'`
  - Reads `WAYLAND_DISPLAY` and `XDG_SESSION_TYPE` env vars
  - Cached at module load time (one call)
  - `isWaylandSession()` convenience export
- Tests: Vitest unit tests (env var combinations, cache, edge cases)

### Phase 2 — Settings: add Wayland dismiss timeout
- `packages/desktop/src/settings.ts`
  - Add `waylandDismissTimeoutMs: number` to `OverlayPrefs` interface (default: 8000)
  - Add getter `getOverlayWaylandDismissTimeoutMs()` and setter `setOverlayWaylandDismissTimeoutMs(ms: number)`

### Phase 3 — Overlay window X11 + Wayland split
- `packages/desktop/src/overlay-window.ts`
  - `getOrCreateWindow()`: on Linux X11, add `type: 'panel'` BrowserWindow option (sets `_NET_WM_WINDOW_TYPE_DOCK` hint — keeps overlay above other windows and click-through works)
  - On Wayland: skip `setIgnoreMouseEvents` (no-op or harmful on Wayland), use `setAlwaysOnTop(true, 'pop-up-menu')` only
  - Add `maybeScheduleDismiss()` — on Wayland, if `waylandDismissTimeoutMs > 0` schedules `hide()` after the timeout; clears the timer on `hide()` / `destroy()`
  - `sendToRenderer(channel, payload)`: on `detection:app-changed` on Wayland, reset the dismiss timer
  - Tests: Vitest for dismiss-timer logic, X11 branch vs Wayland branch construction options

### Phase 4 — Main process IPC changes
- `packages/desktop/src/main.ts`
  - `overlay:is-supported` → return `true` on Linux (overlay now supported, just degraded on Wayland)
  - New `overlay:is-degraded` → return `isWaylandSession()` (boolean — true if Wayland, false otherwise)
  - New `overlay:set-wayland-dismiss-timeout` handler — calls `setOverlayWaylandDismissTimeoutMs(ms)` and forwards to `overlayManager.setWaylandDismissTimeout(ms)` if manager implements it

### Phase 5 — Tray graceful failure
- `packages/desktop/src/tray.ts`
  - Wrap `new Tray(icon)` in try-catch
  - On error: `console.log('[kcc] No system tray detected — use [hotkey] to open the shortcut panel.')`, set `this.tray = null`
  - Guard all `this.tray?.` calls against null
  - Tests: Vitest — mock Tray constructor to throw; assert log is emitted and no crash

### Phase 6 — Settings UI — experimental label + dismiss timeout
- `packages/desktop/src/renderer/settings.html`
  - Add `<span id="overlay-experimental-badge" class="hidden">Experimental</span>` near overlay section legend
  - Add a new `overlay-row` for dismiss timeout: `<input type="number" id="overlay-wayland-dismiss" min="0" max="60" />` (0 = never auto-dismiss)
- `packages/desktop/src/renderer/settings.ts`
  - After loading overlay prefs: call `window.kccSettings.overlay.isDegraded()` — if true, unhide the badge, show dismiss timeout row
  - Wire dismiss timeout input: on change, call `window.kccSettings.overlay.setWaylandDismissTimeout(ms)`
- `packages/desktop/src/settings-preload.ts`
  - Expose `overlay.isDegraded()` and `overlay.setWaylandDismissTimeout(ms)` via contextBridge
- `packages/desktop/src/renderer/kccSettings.d.ts`
  - Add type declarations for the new overlay methods

### Phase 7 — Tests
- `overlay-window.test.ts` additions: Wayland dismiss timer, X11 window type hint path
- `overlay-preload.test.ts` additions: isDegraded, setWaylandDismissTimeout surface exposed
- `tray.test.ts` additions: graceful tray failure path
- `linux-session.test.ts`: new file for session detection

### Phase 8 — Acceptance validation
Run: `npm run test -w packages/desktop` — all green
TypeScript: `tsc --noEmit` via all three tsconfigs — clean
Lint: `npm run lint` — clean

---

## File change summary

| File | Change |
|------|--------|
| `packages/desktop/src/platform/linux-session.ts` | NEW |
| `packages/desktop/src/__tests__/linux-session.test.ts` | NEW |
| `packages/desktop/src/settings.ts` | ADD waylandDismissTimeoutMs to OverlayPrefs |
| `packages/desktop/src/overlay-window.ts` | X11 window type hint, Wayland no-click-through, dismiss timer |
| `packages/desktop/src/main.ts` | overlay:is-supported → true, add overlay:is-degraded, set-wayland-dismiss-timeout |
| `packages/desktop/src/tray.ts` | Graceful Tray constructor failure |
| `packages/desktop/src/renderer/settings.html` | Experimental badge, dismiss timeout row |
| `packages/desktop/src/renderer/settings.ts` | Show badge on Wayland, wire dismiss timeout |
| `packages/desktop/src/settings-preload.ts` | Expose isDegraded, setWaylandDismissTimeout |
| `packages/desktop/src/renderer/kccSettings.d.ts` | Type declarations for new overlay methods |
| `packages/desktop/src/__tests__/overlay-window.test.ts` | Wayland/X11 branch tests |
| `packages/desktop/src/__tests__/overlay-preload.test.ts` | New surface tests |
| `packages/desktop/src/__tests__/tray.test.ts` | Graceful failure tests |

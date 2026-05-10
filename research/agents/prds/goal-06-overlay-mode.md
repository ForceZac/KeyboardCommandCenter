# PRD: Goal 06 — Overlay Mode

**Status:** draft
**Author:** Product Manager
**Date:** 2026-05-10
**Roadmap section:** Goal 6: Overlay Mode

---

## Problem statement

The shortcut panel (Goal 5) requires the user to invoke a hotkey, read the shortcut, dismiss the panel, then execute the shortcut — a context switch. For users learning a new app or working through unfamiliar workflows, they want a persistent on-screen reference that stays visible while they work. Overlay mode renders a semi-transparent shortcut cheat sheet directly on top of the active application, visible at a glance without any interaction. The user never leaves their app, never presses a hotkey to look something up — the reference is just there.

This is the experience that separates a shortcut lookup tool from a shortcut learning tool. Power users toggle it on when learning a new app, then toggle it off once the shortcuts are in muscle memory.

## User stories

- As a user learning a new application, I want a semi-transparent shortcut overlay visible on screen while I work, so I can glance at shortcuts without switching context.
- As a user, I want to toggle the overlay on and off with a single hotkey, so I can show it only when I need it.
- As a user, I want to adjust the overlay's opacity so it doesn't obstruct my work but remains readable.
- As a user, I want to reposition and resize the overlay so it fits alongside the content I'm working on.
- As a user, I want the overlay to be click-through so it never interferes with my mouse input in the active app.
- As a user, I want the overlay to automatically show shortcuts for whichever app I'm currently using, just like the panel does.

## Success metrics

- Overlay renders within 200ms of toggle hotkey press.
- Overlay is fully click-through — mouse events pass through to the underlying application on both Windows and macOS.
- Overlay updates to show the correct app's shortcuts when the user switches applications (within the detection polling interval, ~1.5s).
- Overlay opacity, position, and size preferences persist across app restarts.
- Overlay does not increase idle memory by more than 20MB beyond the baseline (panel window + detection service).
- Users can toggle overlay on/off without affecting the panel hotkey behavior — both features work independently.

## UX flows

**Flow 1: Enabling overlay mode**
1. User opens Settings (from tray context menu).
2. Settings window shows an "Overlay" section with:
   - Toggle: "Enable overlay mode" (off by default).
   - Hotkey: configurable overlay toggle hotkey (default: Ctrl+Shift+O / Cmd+Shift+O).
   - Opacity slider: 20%–80%, default 40%.
   - Position: dropdown with presets — "Top Right", "Top Left", "Bottom Right", "Bottom Left", "Center Right", "Center Left".
   - Size: "Compact" or "Standard" (controls how many shortcuts are shown).
3. User enables the toggle and closes Settings.

**Flow 2: Toggling the overlay**
1. User is working in Figma (or any recognized app).
2. User presses overlay hotkey (Ctrl+Shift+O / Cmd+Shift+O).
3. A semi-transparent window appears at the configured position showing shortcuts for Figma.
4. The overlay shows:
   - App name at the top (small, muted text).
   - Shortcuts listed in a compact format: command name on the left, key combo on the right.
   - Grouped by the most relevant contexts (e.g. "Tools", "View", "Edit") — limited to the top 3-4 groups to keep the overlay compact.
   - If the app has more shortcuts than fit, the overlay shows the most common/essential ones with a count of additional shortcuts available ("+ 47 more in panel").
5. The overlay is click-through — the user clicks, types, and interacts with Figma normally through the overlay.
6. User presses the overlay hotkey again — overlay disappears.

**Flow 3: App switching with overlay active**
1. Overlay is visible showing Figma shortcuts.
2. User switches to VS Code (Alt+Tab or clicking).
3. Detection service identifies VS Code as the new active app.
4. Overlay content updates to show VS Code shortcuts (within 1.5s of the switch).
5. Overlay position and opacity remain the same — only the content changes.

**Flow 4: Adjusting overlay position and opacity**
1. Overlay is visible.
2. User opens Settings and adjusts the opacity slider.
3. Overlay opacity updates in real time as the slider moves (live preview).
4. User selects a different position preset (e.g. "Bottom Right").
5. Overlay smoothly moves to the new position.
6. User closes Settings — preferences are saved and persist across restarts.

**Flow 5: Overlay with unrecognized app**
1. Overlay is enabled and active.
2. User switches to an app not in the database.
3. Overlay shows a muted message: "No shortcuts for [Process Name]" in place of shortcuts.
4. Overlay remains visible but unobtrusive — it doesn't disappear or flash.

**Flow 6: Overlay and panel coexistence**
1. Overlay is active showing shortcuts for the current app.
2. User presses the panel hotkey (Ctrl+Shift+Space).
3. Panel opens normally on top of the overlay — panel has higher z-order.
4. User dismisses the panel — overlay is still visible underneath, unchanged.
5. Both features operate independently with separate hotkeys.

## Scope boundaries

**In scope:**
- Overlay window: new Electron `BrowserWindow` configured as frameless, always-on-top (higher level than normal windows), transparent background, click-through via `setIgnoreMouseEvents(true, { forward: true })`
- Overlay renderer: compact shortcut display optimized for at-a-glance reading — app name, grouped shortcuts, key caps
- Overlay toggle: secondary configurable hotkey (separate from the panel hotkey), registered via `globalShortcut`
- Settings integration: overlay section in the existing Settings window with enable toggle, hotkey config, opacity slider, position presets, size toggle
- Detection integration: overlay listens to the same `detection:app-changed` IPC channel as the panel and updates content accordingly
- Persistence: overlay preferences (enabled, hotkey, opacity, position, size) stored via `electron-store`
- Compact content strategy: show top 3-4 context groups with most essential shortcuts; indicate count of remaining shortcuts available in the panel
- Windows and macOS support

**Out of scope:**
- Drag-to-reposition (use preset positions for v1 — free-form dragging adds complexity and edge cases with multi-monitor setups)
- Free-form resizing (use Compact/Standard size presets)
- Custom shortcut selection (user choosing which specific shortcuts appear in the overlay)
- Pinning the overlay to a specific app (overlay always follows the detected active app)
- Multiple simultaneous overlays
- Overlay for the web interface (desktop-only feature)
- Linux/Wayland overlay support (Goal 10)
- Overlay transparency on Wayland (X11 only for now)
- Keyboard navigation within the overlay (it's click-through and view-only)
- Animations or transitions beyond basic fade in/out

## Constraints and requirements

- **Click-through:** Electron's `setIgnoreMouseEvents(true, { forward: true })` makes the window pass all mouse events to the window beneath it. The `forward: true` option is needed on macOS to properly forward events. This is a hard requirement — the overlay must never capture mouse input.
- **Always-on-top level:** The overlay window must use `alwaysOnTop: true` with level `'floating'` (or `'screen-saver'` if `'floating'` doesn't stay above fullscreen apps). The panel window should have a higher z-level than the overlay so it renders on top when both are visible.
- **Transparency:** Use `transparent: true` and `backgroundColor: '#00000000'` on the BrowserWindow. The renderer applies the user's configured opacity to the content container, not the window itself, to allow per-element opacity control.
- **Performance:** Overlay content updates should complete within 200ms. Since the overlay shows a subset of shortcuts (compact view), data volume is small. Pre-fetched data from the detection service (same data the panel uses) avoids duplicate database queries.
- **Memory:** The overlay window adds a second renderer process. Target: <20MB additional memory for the overlay window. Minimize DOM nodes by limiting displayed shortcuts.
- **Security:** Same security model as panel and settings windows — `contextIsolation: true`, preload script, no `nodeIntegration`.
- **Multi-monitor:** Overlay should appear on the same monitor as the active application window. Use Electron's `screen` API to determine which display contains the active window and position the overlay accordingly.
- **Hotkey independence:** The overlay hotkey and panel hotkey must not conflict. Settings validation should prevent the user from assigning the same key combo to both. If the user tries to assign a conflicting binding, show an error.

## Open questions

- **Content curation:** Should the overlay show all shortcuts (with scrolling) or only a curated "most used" subset per context group? **Recommendation:** Show a curated compact view — top 8-12 shortcuts per visible group, up to 3-4 groups. The overlay is for glancing, not scrolling. Users who need the full list can open the panel. The exact number should be tuned based on the Standard/Compact size presets.
- **Overlay package:** The monorepo has a `packages/overlay` placeholder configured with React and Vite. Should the overlay renderer use this package (React) or stay consistent with the panel renderer (vanilla HTML/CSS)? **Recommendation:** Use the overlay package with React — the overlay has more dynamic state (opacity changes, content transitions, responsive sizing) that benefits from a component framework. The panel may migrate to React later, but the overlay can start there since it's a new surface.
- **Opacity control model:** Should the opacity apply uniformly to the entire overlay, or should text remain at full opacity while only the background is semi-transparent? **Recommendation:** Semi-transparent background with higher-opacity text. Pure uniform opacity makes text hard to read at low values. Use `background: rgba(0,0,0,0.4)` with `color: rgba(255,255,255,0.95)` rather than CSS `opacity` on the container.
- **Fullscreen apps:** Should the overlay appear over fullscreen applications (games, presentations)? **Recommendation:** No — default to hiding the overlay when the active window is fullscreen. Detection can check window state. Users rarely need shortcut reference in fullscreen contexts, and overlay rendering over exclusive fullscreen (games) is unreliable on both platforms.

## Dependencies

- **Goal 3** — Desktop App Shell (shipped — provides tray, settings, electron-store)
- **Goal 4** — Active Window Process Detection (in progress — provides detection service)
- **Goal 5** — Shortcut Panel UI (provides the data fetching layer and shortcut rendering patterns the overlay reuses)

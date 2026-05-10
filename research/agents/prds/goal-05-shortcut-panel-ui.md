# PRD: Goal 05 — Shortcut Panel UI (Desktop)

**Status:** draft
**Author:** Product Manager
**Date:** 2026-05-10
**Roadmap section:** Goal 5: Shortcut Panel UI (Desktop)

---

## Problem statement

The desktop app shell (Goal 3) and process detection (Goal 4) are in place, but the panel window is a placeholder — a search input with hint text and no shortcut data. When a user invokes the global hotkey, they see an empty shell. The panel needs to display the actual shortcut data for the detected active application, making lookup instant and zero-friction. Without this, the desktop app delivers no value over the web interface.

## User stories

- As a power user, I want to press my global hotkey and immediately see shortcuts for the app I'm currently using, so I don't have to manually search or select an app.
- As a user, I want to search/filter shortcuts within the panel, so I can quickly find the specific command I need without scrolling.
- As a user, I want shortcuts displayed with the correct modifier keys for my OS (Cmd on Mac, Ctrl on Windows), so I don't have to mentally translate key combos.
- As a user, I want to see shortcuts grouped by context (e.g. "Editor", "Terminal", "Navigation"), so I can scan by area of the app rather than an unsorted list.
- As a user, I want a clear indication when my current app isn't recognized or has no shortcuts in the database, so I understand why the panel is empty.

## Success metrics

- Panel displays shortcuts for the detected active app within 100ms of hotkey invocation (measured from window show to content paint).
- Search/filter narrows the displayed shortcuts in real time (<50ms per keystroke on a list of 200+ shortcuts).
- Platform-appropriate modifier keys are displayed correctly on both Windows and macOS.
- Panel correctly handles all fallback states: no app detected, unrecognized app, recognized app with no shortcuts.
- At least 30 of the top 50 seeded apps render their shortcuts correctly when detected.
- Panel idle memory stays under 60MB (panel window + shortcut data in memory).

## UX flows

**Flow 1: Hotkey invocation with detected app**
1. User is working in VS Code (or any recognized app).
2. Detection service identifies the active app and resolves it to a database slug (e.g. "vs-code").
3. User presses global hotkey (Ctrl+Shift+Space / Cmd+Shift+Space).
4. Panel window appears (680x420px, centered top-third of screen, frameless, always-on-top).
5. Panel header shows the detected app name and icon (e.g. "VS Code").
6. Below the header, a search input is focused and ready for typing.
7. Below the search input, shortcuts are listed grouped by context/scope (e.g. "General", "Editor", "Terminal", "Debug").
8. Each shortcut row shows: command description on the left, key combination rendered as visual key caps on the right.
9. Key caps show platform-appropriate modifiers (Cmd on Mac, Ctrl on Windows).
10. User scrolls or searches to find their shortcut, reads it, presses Escape or clicks outside to dismiss.

**Flow 2: Search/filter within panel**
1. Panel is open showing shortcuts for the detected app.
2. User starts typing in the search input (e.g. "find").
3. Shortcut list filters in real time — only shortcuts whose command description or key combo matches the query are shown.
4. Context group headings that have no matching shortcuts are hidden.
5. If no shortcuts match, a "No matching shortcuts" message is shown.
6. User clears the search input — full shortcut list is restored.

**Flow 3: No app detected**
1. User presses global hotkey while no app is detected (e.g. on the desktop, or detection is disabled).
2. Panel opens showing a neutral state: "No app detected" with a brief explanation.
3. Below the message, a "Browse all apps" link or list of recent apps (from detection history) is shown so the user can manually select.
4. User clicks a recent app — panel loads that app's shortcuts.

**Flow 4: Unrecognized app**
1. User presses global hotkey while using an app not in the database (e.g. a niche tool).
2. Panel opens showing: "Shortcuts not available for [Process Name]".
3. Below, the panel shows recent apps the user can switch to, same as Flow 3.

**Flow 5: App changes while panel is open**
1. Panel is open showing shortcuts for App A.
2. User switches focus to App B (e.g. Alt+Tab).
3. Panel dismisses on focus loss (existing behavior from Goal 3).
4. Next time user invokes hotkey, panel shows shortcuts for App B.

## Scope boundaries

**In scope:**
- Panel content renderer: display shortcut data for the detected app, grouped by context/scope
- Shortcut row component: command description + visual key cap rendering (port the web app's KeyCap/KeyCombo/ShortcutRow pattern to the desktop renderer)
- Context group component: collapsible groups with headers
- Search/filter: real-time client-side filtering of shortcuts by command name or key combo
- Platform toggle: detect user's OS and display appropriate modifier keys (no manual toggle needed on desktop — unlike web, the OS is known)
- App header: show detected app name at top of panel
- Data fetching: IPC channel from renderer to main process to fetch shortcuts for a given app slug
- Main process data layer: query the database (via Prisma) for shortcuts by app slug and return to renderer via IPC
- Fallback states: no detection, unrecognized app, no shortcuts for recognized app
- Recent apps fallback: show recent apps list (from detection service) when no shortcuts are available
- Keyboard navigation: arrow keys to scroll through shortcuts, Escape to dismiss

**Out of scope:**
- Overlay mode (Goal 6)
- User accounts, favorites, or collections (Goal 7)
- Community submissions (Goal 8)
- Shortcut editing or submission from the panel
- App icon fetching or display (use text-only app name for now; icons can be added later)
- Custom shortcut sets or user-defined shortcuts
- Offline data caching strategy (the desktop app connects to the local database; offline support for a deployed version is a future concern)
- Analytics or usage tracking
- Theming or dark/light mode toggle (inherit system theme or use a single dark theme for v1)
- Linux support (Goal 10)

## Constraints and requirements

- **Performance:** Panel must render shortcut content within 100ms. Use lazy rendering or virtualized list if an app has 200+ shortcuts to avoid scroll jank.
- **Data source:** Main process queries PostgreSQL via Prisma (same database as the web app). Shortcuts are fetched by app slug returned from the detection service. IPC channel: a new `'shortcuts:get-by-app'` handler in the main process that accepts an app slug and returns grouped shortcut data.
- **Component consistency:** Visual key cap rendering should match the web app's KeyCap/KeyCombo component style (gray bordered `<kbd>` elements, monospace font, visual separators for chord sequences). Consider extracting shared rendering logic to `packages/core` or duplicating the simple CSS pattern in the desktop renderer.
- **Security:** Renderer uses `contextBridge` and preload script for IPC (consistent with existing panel/settings windows). No `nodeIntegration`, no `remote` module.
- **Window behavior:** Panel window configuration is already set (680x420px, frameless, always-on-top, dismiss on blur). No changes to window management needed — only the content inside the panel changes.
- **IPC integration:** The preload already exposes `onAppChanged(callback)` which receives the detected app slug. The renderer should listen for app changes and pre-fetch shortcut data so it's ready when the panel is shown.

## Open questions

- **Data prefetching strategy:** Should the main process fetch and cache shortcut data for the detected app as soon as detection fires (before the user opens the panel), or fetch on-demand when the panel opens? **Recommendation:** Prefetch on detection change — the data is small (typically <500 rows per app) and prefetching ensures the 100ms render target is met without waiting for a database round-trip when the panel opens.
- **Virtualized list vs. simple DOM:** For apps with very large shortcut sets (e.g. Photoshop with 300+ shortcuts), should we use a virtualized list component (e.g. react-window) or render all rows? **Recommendation:** Start with simple DOM rendering. Most apps have 50-150 shortcuts which render fine. Add virtualization only if profiling shows jank on large sets.
- **Shared component extraction:** Should KeyCap/KeyCombo components be extracted to `packages/core` for reuse between web and desktop, or duplicated? **Recommendation:** Duplicate for now — the desktop renderer uses vanilla HTML/CSS (not React/Tailwind like the web app), so extraction would require an abstraction layer. Revisit when/if the desktop panel moves to React.

## Dependencies

- **Goal 1** — Shortcut Data Schema & Seed Database (shipped)
- **Goal 2** — Web Search & Browse Interface (shipped — provides component patterns to port)
- **Goal 3** — Desktop App Shell (shipped — provides panel window, tray, hotkey)
- **Goal 4** — Active Window Process Detection (in progress — provides detection service and process mapping)

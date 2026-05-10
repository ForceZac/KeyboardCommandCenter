# Plan: Panel Content Renderer & Shortcut Key Caps — TASK-0013

**Branch:** goals/13-panel-content-renderer
**TRD:** research/plans/goals/13-panel-content-renderer-trd.md

---

## Work breakdown

### Slice 1 — Replace panel stub HTML with content structure
- Remove the `#search-stub` input and hint text from `index.html`
- Add the full panel DOM skeleton:
  - `#app-header` — app name display at top
  - `#shortcuts-container` — scrollable area for context groups
- Update `app.css` with layout rules for the header, scroll container, and shortcut rows (grid/flexbox)

### Slice 2 — Platform detection utility
- Add `getPlatform(): 'macos' | 'windows'` to `renderer/platform.ts`
  - Uses `navigator.platform` (contains "Mac" on macOS, "Win" on Windows)
  - Returns `'macos'` on Mac, `'windows'` on Windows
- Add `getPlatformSlug(): string` that maps to the `PlatformSlug` values from `@kcc/core` (`'macos'` / `'windows'`)
- This is a pure utility with no side effects — no IPC needed; platform is known in-renderer

### Slice 3 — Key cap rendering (port from web KeyCap/KeyCombo)
- Add `renderer/keycap.ts` with two functions:
  - `renderKeyCapHTML(label: string): string` — returns `<kbd>` HTML string styled to match web app's KeyCap component
  - `renderKeyComboHTML(combo: string): string` — splits combo by `→` for chord steps and `+` for modifiers, renders each key via `renderKeyCapHTML`, joins with styled separators
- Update `app.css` with `kbd` element styles matching the web pattern: gray border, border-bottom-2 for 3D effect, monospace font, small padding
- Test manually: verify `Ctrl+Shift+P` renders 3 key caps with `+` separators; `Ctrl+K → Ctrl+C` renders two chord steps with `→` separator

### Slice 4 — Shortcut list renderer (context groups + rows)
- Add `renderer/shortcut-list.ts` with:
  - `renderShortcutRow(shortcut: ShortcutEntry, platformSlug: string): string` — builds one row: description left, key combo right; picks the correct platform binding (falls back to first available if platform not found)
  - `renderContextGroup(contextName: string, shortcuts: ShortcutEntry[], platformSlug: string): string` — wraps rows in a collapsible `<details>/<summary>` group with the context heading
  - `renderShortcutList(appDetail: AppDetail, platformSlug: string): string` — iterates `appDetail.contexts`, calls `renderContextGroup` for each, returns full HTML string
- Context groups use native `<details open>` so they are collapsible out of the box without JS state
- Groups are rendered in the order returned from the API (already sorted alphabetically by the ShortcutService)

### Slice 5 — App header renderer
- Add `renderer/app-header.ts` with:
  - `renderAppHeader(appName: string): string` — returns the `#app-header` inner HTML (app name text)
  - `clearAppHeader(): void` — resets header to empty/loading state
- Header shows plain text app name (no icon — text-only per scope)

### Slice 6 — IPC integration and app-changed listener
- Update `renderer/app.ts` (currently `index.ts`) to:
  - Import platform, app-header, shortcut-list utilities
  - On `DOMContentLoaded`, call `window.kcc.onAppChanged(handleAppChanged)`
  - `handleAppChanged(payload)`:
    - If `payload.appSlug` is null, render empty header, clear shortcuts container (out-of-scope fallback state — just leave empty for now per task scope)
    - Call `window.kcc.getShortcutsForApp(payload.appSlug)` — data is prefetched by main process so this resolves from cache immediately
    - Call `renderAppHeader(appDetail.name)` and `renderShortcutList(appDetail, platformSlug)` and inject HTML into the DOM
    - Catch any errors and log to console without crashing the renderer
  - On panel show (Electron fires `BrowserWindow.show` event — listen via existing `onAppChanged` or track last known slug): re-render with cached data if available

### Slice 7 — Performance gate & scroll behavior
- Ensure `#shortcuts-container` has `overflow-y: auto` and a `max-height` that keeps it within the 420px panel (minus header height)
- Verify with VS Code's shortcut set (100+ shortcuts): confirm no visible jank
- Add `will-change: transform` to scroll container as a low-cost paint hint
- No virtualization needed for v1 (per PRD recommendation — revisit if profiling shows jank on 300+ shortcut apps)

### Slice 8 — Error guard & empty data handling
- Wrap all DOM mutations in try/catch; log errors with `console.error`
- If `getShortcutsForApp` returns `null` (unknown slug or DB error): render empty shortcuts container without throwing
- If a `PlatformBinding` is missing for the current OS: fall back to first available binding (same as web's ShortcutRow fallback behavior)

### Slice 9 — TypeScript typecheck + Vitest unit tests
- Add `__tests__/keycap.test.ts` — unit tests for `renderKeyCapHTML` and `renderKeyComboHTML`:
  - Single key
  - Multi-modifier combo (`Ctrl+Shift+P`)
  - Chord sequence (`Ctrl+K → Ctrl+C`)
  - Empty string guard
- Add `__tests__/shortcut-list.test.ts` — unit tests for `renderShortcutRow` and `renderContextGroup`:
  - Row renders correct description and key combo
  - Platform fallback (request `macos`, binding only exists for `windows` → uses windows)
  - Context group renders `<details>/<summary>` with correct heading
- Run `npm run test -w packages/desktop` and `npm run typecheck` — confirm green

### Slice 10 — Mark PR ready
- Run full test suite; confirm green
- Run TypeScript check; confirm clean
- Mark PR ready, strip WIP prefix, move task to In Review

---

## Order

Slices run 1→2→3→4→5→6→7→8→9→10. Slices 3 and 4 are independent of each other and can be committed separately. Slice 6 requires slices 2–5. Slice 9 can be written alongside slices 3–4.

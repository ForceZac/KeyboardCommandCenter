# TRD: Panel Content Renderer & Shortcut Key Caps

**Task:** TASK-0013
**Branch:** goals/13-panel-content-renderer
**PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md
**Date:** 2026-05-10

---

## What we're building

The panel window currently shows a placeholder stub (a text input and hint message). This task replaces that stub with a real shortcut display: an app header showing the detected app's name, followed by shortcuts grouped by context/scope, each row showing the command description and a visual key cap rendering. The data layer (IPC handler, cache, preload API) was completed in TASK-0012; this task is the visual rendering layer that consumes that data. All rendering runs in the Electron renderer process using vanilla TypeScript, HTML, and CSS — no React, no Tailwind.

---

## Technical components needed

**New renderer modules (packages/desktop/src/renderer/):**
- `platform.ts` — detects current OS at runtime using `navigator.platform`; returns a typed platform slug (`'macos'` | `'windows'`). Needed to select the correct key binding for display.
- `keycap.ts` — renders a single key label as a styled `<kbd>` HTML string, and a full key combo string as a sequence of key caps with separators. Needed to display shortcuts as visual key caps, matching the web app's KeyCap/KeyCombo component pattern.
- `shortcut-list.ts` — renders `ShortcutEntry[]` data (grouped by context from `AppDetail.contexts`) as a structured HTML string. Needed to turn the structured API response from TASK-0012 into displayable shortcut rows and collapsible context groups.
- `app-header.ts` — renders the app name into the panel header DOM element. Needed to show which app the shortcuts belong to.

**Modified renderer files:**
- `index.html` — replace stub DOM with the real panel structure: an `#app-header` element and a `#shortcuts-container` scroll area.
- `app.css` — add styles for the panel layout (header, scroll container, shortcut rows, key cap elements, context group headings).
- `index.ts` — wire the `onAppChanged` IPC listener; on app change, fetch shortcuts via `getShortcutsForApp`, render into the DOM.

**New type references (no new types needed):**
- Renderer imports `AppDetail` and `ShortcutEntry` from `@kcc/core` (already a dependency via tsconfig `paths`). No new types defined.

**Schema changes:** No schema changes.

**API changes:** No new endpoints or IPC channels. This task consumes the existing `getShortcutsForApp(slug)` preload API and `onAppChanged(callback)` event from TASK-0012.

---

## Key architectural decisions

**Vanilla HTML strings over DOM builder pattern** — shortcut lists will be built as HTML strings and injected via `innerHTML` rather than building DOM nodes imperatively. The shortcut list is read-only and re-rendered wholesale on app change; string concatenation is simpler and fast enough for lists of <300 rows.

**Native `<details>/<summary>` for collapsible groups** — uses the browser's built-in disclosure widget rather than custom JS toggle logic. Zero JS state needed; groups default open. This matches the PRD requirement for collapsible headings without adding implementation complexity.

**Platform detection via `navigator.platform`** — avoids adding a new IPC channel just to expose `process.platform`. `navigator.platform` is synchronous, already available in the renderer context, and sufficient for the Mac/Windows distinction needed here. (Linux is out of scope per PRD.)

**HTML string injection (`innerHTML`) is acceptable here** — the shortcut data comes from the app's own PostgreSQL database via the trusted IPC layer (not from user input or remote URLs), so XSS risk from this data source is low. All values are sanitized defensively with `textContent`-style escaping before injection.

**Duplicate CSS pattern from web, do not extract to `packages/core`** — the desktop renderer uses vanilla CSS; the web app uses Tailwind. Extracting shared rendering to `packages/core` would require an abstraction layer incompatible with both. Duplication is the correct call here (per PRD open question resolution).

**Re-render on every app-changed event** — no diffing or partial update. The entire shortcut list and header are re-rendered when the detected app changes. The list is typically 50–150 rows; a full DOM replacement is imperceptible at this size.

---

## Test coverage plan

**Unit tests (Vitest, packages/desktop):**
- `__tests__/keycap.test.ts`:
  - `renderKeyCapHTML`: single key, multi-char label, HTML character escaping
  - `renderKeyComboHTML`: single key, multi-modifier (`Ctrl+Shift+P`), chord sequence (`Ctrl+K → Ctrl+C`), empty input guard
- `__tests__/shortcut-list.test.ts`:
  - `renderShortcutRow`: correct description text, correct platform binding selected, fallback to first binding when platform not present
  - `renderContextGroup`: renders `<details>`/`<summary>` wrapper, correct heading text, contains expected shortcut rows
  - `renderShortcutList`: handles empty context map, renders multiple groups

**E2E / integration tests (Playwright Electron — if Electron infra is available):**
- Electron E2E is not yet set up in CI (TRD-approved exception used in prior tasks). If Playwright Electron support is available, add a spec that:
  - Opens the panel, simulates an `onAppChanged` event, and asserts that the shortcut list renders.
  - Otherwise, this is skipped with the same approved exception as prior tasks and noted in the PR.

---

## Out of scope (technical)

- Search/filter input and filtering logic (TASK-0015)
- Fallback states: "No app detected", "Unrecognized app", "No shortcuts for recognized app" (separate task per PRD scope)
- Recent apps fallback list (separate task)
- Keyboard navigation within the shortcut list beyond Escape to dismiss (existing behavior, not changed here)
- App icon display (text-only for v1)
- Dark/light mode toggle (single dark theme inherited from existing `app.css`)
- Linux support (out of scope per PRD)
- Overlay mode (Goal 6)
- Virtualized list rendering (PRD recommends starting without it; add if profiling shows jank on 300+ rows)

---

## Risks and open questions

**`@kcc/core` imports in the renderer** — `AppDetail` and `ShortcutEntry` types are imported from `@kcc/core`. The renderer's `tsconfig.renderer.json` includes `paths` aliasing for `@kcc/core`. Webpack's `resolve.alias` must also map this for the bundled renderer JS. Need to verify the webpack config handles this — if not, types can be re-declared locally in `kcc.d.ts` as a fallback (pure type-level, no runtime cost).

**`navigator.platform` deprecation** — `navigator.platform` is deprecated in modern web specs but remains fully functional in Electron's Chromium renderer and is not removed. It is the right tool here given the controlled runtime environment (Electron, not arbitrary browser). Using `userAgent` string parsing is the alternative but more fragile.

**Chord separator character** — the `ShortcutService` (TASK-0012) joins multi-step chord combos with ` → ` (space + rightarrow + space). The renderer's `renderKeyComboHTML` must split on this exact delimiter. Confirm the exact string by reading `shortcut-service.ts` before implementing (minor risk — well-documented in the TASK-0012 code).

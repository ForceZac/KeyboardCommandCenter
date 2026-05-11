# TRD: Landing Page — `/download` Route with OS Detection

**Task:** TASK-0034
**Branch:** goals/34-landing-page-download
**PRD:** research/agents/prds/goal-09-auto-update-distribution.md
**Date:** 2026-05-11

---

## What we're building

A new `/download` page in `packages/web` (Next.js App Router) that serves as the first-time install landing for new users. The page detects the visitor's OS from the HTTP `User-Agent` header at the server-render level, pre-renders the correct primary download button for macOS or Windows, and shows secondary links for all supported platforms. All download links point to GitHub Release assets via the stable `/releases/latest/download/{asset}` URL pattern — no GitHub API call required at request time. This maps directly to PRD Flow 3.

---

## Technical components needed

**New frontend components:**

- `packages/web/app/download/page.tsx` — Next.js server component (RSC). Reads the `User-Agent` header via `next/headers`. Runs the OS-detection helper to determine `detectedOS`. Passes result as a prop to `DownloadPageClient`. Exports `metadata` for SEO (`title`, `description`, `og:*`).
- `packages/web/app/download/DownloadPageClient.tsx` — Client component (`"use client"`). Accepts `serverDetectedOS: 'macos' | 'windows' | 'unknown'`. On mount, runs a JS-side `navigator.userAgent` check and resolves the final OS if the server hint was `'unknown'`. Renders the primary download button (highlighted, large) for the detected platform, secondary links for the other platforms, a brief product description, and system requirements. No external API calls.
- `packages/web/lib/detectOs.ts` — Pure utility that maps a User-Agent string to `'macos' | 'windows' | 'unknown'`. Shared by server component and unit tests. No side effects.

**New backend components:**
- None. The `/download` route is purely server-rendered HTML + client JS. No new API routes or Prisma queries.

**Schema changes:**
- No schema changes.

**API changes:**
- No new endpoints.

---

## Key architectural decisions

- **Server-side OS detection via `headers()`** — eliminates hydration flash on the primary button. The server reads `User-Agent` before first paint; the client component confirms or refines on hydration. This keeps the page fast and avoids layout shift.
- **Static asset URLs, no GitHub API call** — GitHub provides a stable redirect: `https://github.com/ForceZac/KeyboardCommandCenter/releases/latest/download/{asset}`. These URLs resolve to the current latest release without a runtime API call. This keeps page load well under the 2-second target.
- **Asset naming convention** — the download page defines the canonical asset filenames that TASK-0035 (CI release workflow) must produce. See Out of Scope for the coordination note.
  - macOS universal DMG: `KeyboardCommandCenter.dmg`
  - Windows x64 NSIS: `KeyboardCommandCenter-Setup.exe`
  - Windows arm64 NSIS: `KeyboardCommandCenter-Setup-arm64.exe`
- **No dependency on TASK-0033 or TASK-0035** — the page renders and links correctly even before any real releases exist. Links 404 gracefully until CI publishes the first release.
- **Purely web-package addition** — zero changes to `packages/desktop`, `packages/core`, or any other package. Satisfies separation-of-concerns constraint.

---

## Test coverage plan

- **E2E (Playwright):** `packages/web/e2e/download.spec.ts`
  - Page renders at `/download` (heading visible)
  - Primary download button is present and has a valid `href`
  - All platform links (macOS, Windows) are present
  - No horizontal overflow at 320px viewport width
  - Navigation back to home works (regression check)
- **Unit (Vitest):** `packages/web/__tests__/lib/detectOs.test.ts`
  - macOS Chrome UA → `'macos'`
  - Windows Chrome UA → `'windows'`
  - Linux Chrome UA → `'unknown'`
  - iOS Safari UA → `'unknown'` (mobile — out of scope)
  - Empty/null string → `'unknown'`

---

## Out of scope (technical)

- Linux download button (Goal 10)
- Fetching GitHub API at request time to resolve actual latest version number (nice-to-have, but adds latency and rate-limit risk — `/releases/latest/download/` redirect is sufficient)
- In-page version display (would require GitHub API)
- Analytics events on download button click (PostHog is available but tracking download clicks is not in the PRD acceptance criteria)
- Onboarding flow or "getting started" content beyond a brief description and requirements
- Auto-updater integration (TASK-0033)
- CI release workflow (TASK-0035)

---

## Risks and open questions

- **Asset naming coordination with TASK-0035** — the download links use hardcoded filenames (`KeyboardCommandCenter.dmg`, `KeyboardCommandCenter-Setup.exe`, `KeyboardCommandCenter-Setup-arm64.exe`). TASK-0035 must configure electron-builder's `productName` and artifact names to match. This needs a note in TASK-0035's TRD. Low risk — both tasks are in Ready and can align during TRD review.
- **`headers()` API in Next.js App Router** — `headers()` is only available in RSC (server components), which is the pattern we're using. However, it opts the entire page into dynamic rendering (no static optimization). This is acceptable given the page needs per-request OS detection and is not a high-traffic page that benefits from static caching.
- **No real releases exist yet** — download links will 404 until TASK-0035 ships and a tag is pushed. This is expected and acceptable; the acceptance criteria don't require live downloads, only that the links point to the right URL pattern.

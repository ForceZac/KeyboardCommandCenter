# Plan: TASK-0034 — Landing Page `/download` Route with OS Detection

**Branch:** goals/34-landing-page-download
**TRD:** research/plans/goals/34-landing-page-download-trd.md

---

## What we're building

A `/download` route in `packages/web` (Next.js App Router) that:
- Detects the visitor's OS from the HTTP User-Agent header (server-side) with a client-side JS fallback
- Shows a primary download button for the detected platform
- Shows secondary links for all supported platforms (macOS, Windows)
- Links directly to GitHub Release assets via `https://github.com/ForceZac/KeyboardCommandCenter/releases/latest/download/{asset}`
- Renders a brief product description and system requirements
- Is responsive and loads in <2 seconds

---

## Work breakdown

### Phase 1: Page scaffold
1. Create `packages/web/app/download/page.tsx` — server component
   - Reads `User-Agent` header via Next.js `headers()` API
   - Determines detected OS (`'macos' | 'windows' | 'unknown'`)
   - Renders static metadata and passes detectedOS to client component
2. Create `packages/web/app/download/DownloadPageClient.tsx` — client component
   - Accepts `serverDetectedOS` prop
   - On mount, runs client-side navigator.userAgent detection as fallback/confirmation
   - Renders primary download button + secondary platform links
   - Uses Tailwind + shadcn/ui styling consistent with rest of site

### Phase 2: Tests
3. Write `packages/web/e2e/download.spec.ts` — Playwright E2E
   - Page renders at `/download`
   - Primary download button is visible
   - Both macOS and Windows links are present
   - No horizontal overflow at 320px
   - No regressions check (home page still renders)
4. Write `packages/web/__tests__/components/download.test.tsx` — Vitest unit
   - OS detection helper returns correct platform for common user agents

### Phase 3: Polish + type-check
5. Run `npm run typecheck` in packages/web
6. Run `npm run lint` in packages/web
7. Run Playwright E2E tests

---

## Asset URL convention

Download links use GitHub's stable latest-release redirect:
- macOS universal: `https://github.com/ForceZac/KeyboardCommandCenter/releases/latest/download/KeyboardCommandCenter.dmg`
- Windows x64: `https://github.com/ForceZac/KeyboardCommandCenter/releases/latest/download/KeyboardCommandCenter-Setup.exe`
- Windows arm64: `https://github.com/ForceZac/KeyboardCommandCenter/releases/latest/download/KeyboardCommandCenter-Setup-arm64.exe`

These names must be coordinated with TASK-0035 (CI release workflow) when electron-builder is configured.

---

## Key decision

**Server-first OS detection** — read `User-Agent` in the RSC via `headers()` so the correct primary button is rendered on first paint (no hydration flash). Client component provides JS-based confirmation after hydration.

No GitHub API call at request time — static asset URLs are always predictable via the `/releases/latest/download/` pattern. This keeps page load < 2s even in cold-start scenarios.

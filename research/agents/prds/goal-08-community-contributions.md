# PRD: Goal 08 — Community Contributions & Shortcut Submissions

**Status:** draft
**Author:** Product Manager
**Date:** 2026-05-10
**Roadmap section:** Goal 8: Community Contributions & Shortcut Submissions

---

## Problem statement

The shortcut database was seeded with 50+ apps, but the long tail of applications, niche shortcuts, and platform-specific bindings is vast — far more than one person can maintain. Users who notice a missing shortcut, an outdated key binding, or an app that isn't in the database have no way to contribute that knowledge. Meanwhile, shortcuts change with every app update, and stale data erodes trust.

Community contributions solve both problems: they scale the database beyond what a solo maintainer can curate, and they keep existing data fresh through corrections. Contributors who see their submissions go live become invested in the product — they're not just users, they're co-builders.

## User stories

- As a logged-in user, I want to submit a new shortcut for an app that's already in the database so the database becomes more complete over time.
- As a logged-in user, I want to submit a correction for an existing shortcut (e.g. the key combo changed in a recent update) so the data stays accurate.
- As a logged-in user, I want to request a new app be added to the database so I can eventually look up its shortcuts.
- As a contributor, I want to see my accepted submissions on my profile so I get credit for my contributions.
- As the site owner, I want all submissions to go through a review queue before going live so I can maintain data quality.

## Success metrics

- Submissions complete in under 30 seconds (from clicking "Submit" to confirmation).
- Duplicate detection catches exact-match duplicates before the user submits (client-side check).
- Review queue shows all pending submissions in a single admin view with approve/reject/edit actions.
- Approved submissions go live within 5 minutes of approval (no manual deploy needed).
- Contributor profile shows accepted contribution count and history.
- Spam rate: fewer than 5% of submissions are spam or nonsense (measured over rolling 30-day window).

## UX flows

**Flow 1: Submitting a new shortcut**
1. User is viewing an app's shortcut page (e.g. Blender).
2. User clicks a "Submit a shortcut" button near the top of the shortcut list.
3. A form appears (modal or inline) with fields:
   - Command name (required, text input, max 100 chars)
   - Key combination (required, captured via a key recorder input — user presses the actual keys)
   - Platform (required, dropdown: Windows / macOS / Linux / All)
   - Context/scope (optional, text input — e.g. "Edit Mode", "Timeline", "Global")
   - Notes (optional, text area — e.g. "Added in Blender 4.1")
4. As the user fills in the key combination, a client-side check runs against existing shortcuts for this app + platform. If an exact match exists, a warning appears: "This shortcut already exists — did you mean to submit a correction?"
5. User clicks "Submit". The form validates, creates a pending submission, and shows a confirmation: "Thanks! Your submission is in the review queue."
6. The shortcut does NOT appear in the database until approved.

**Flow 2: Submitting a correction**
1. User is viewing an app's shortcut page and notices an incorrect shortcut.
2. User clicks a small "Suggest edit" icon next to the shortcut.
3. A form appears pre-filled with the current shortcut data.
4. User edits the fields that need correction (e.g. updates the key combo, fixes the command name).
5. User adds an optional note explaining the correction (e.g. "Changed in VS Code 1.96").
6. User clicks "Submit correction". Confirmation shown. The original shortcut remains unchanged until the correction is reviewed and approved.

**Flow 3: Requesting a new app**
1. User searches for an app that isn't in the database.
2. The "no results" page shows a "Request this app" button.
3. User clicks it and fills out a minimal form:
   - App name (required)
   - App website URL (optional)
   - Category (optional, dropdown matching existing categories)
   - Platform(s) (checkbox: Windows / macOS / Linux)
4. Submission enters the review queue as an "app request" type.
5. If approved, the app is added to the database (with no shortcuts initially) and the user is notified.

**Flow 4: Admin review queue**
1. Site owner navigates to `/admin/review` (protected route, owner-only).
2. Page shows a list of pending submissions, sorted by submission date (oldest first).
3. Each submission shows:
   - Type badge: "New shortcut", "Correction", or "App request"
   - Submitter display name
   - App name and the submitted data
   - If correction: a diff view showing original vs. proposed values
   - If duplicate detected: a warning badge linking to the existing entry
4. Owner can:
   - **Approve** — submission is applied to the database immediately (new shortcut created, or existing shortcut updated, or new app added).
   - **Edit & approve** — owner modifies the submission before applying (e.g. fixing a typo in the command name).
   - **Reject** — submission is discarded with an optional reason.
5. Approved submissions increment the contributor's accepted count.

**Flow 5: Contributor profile**
1. User navigates to their profile (linked from the nav avatar dropdown).
2. Profile shows:
   - Display name and avatar (from OAuth provider)
   - "Member since" date
   - Contribution stats: total submitted, total accepted, acceptance rate
   - List of accepted contributions (shortcut name, app, date accepted)
3. Profiles are public — other users can view a contributor's profile to see their contributions.

**Flow 6: Duplicate detection (client-side)**
1. User is filling out the new shortcut submission form.
2. As they enter the key combination, a debounced API call checks for existing shortcuts matching the same app + platform + key combo.
3. If an exact match is found: the form shows an inline warning with the existing shortcut's command name. "This key combination is already mapped to [Command Name]. Did you mean to submit a correction instead?" with a link to switch to the correction flow.
4. If a fuzzy match is found (same keys, different modifier order, or same command name): a softer hint appears. "Similar shortcut found: [existing shortcut]. Please check before submitting."
5. Neither warning blocks submission — the user can proceed if they believe the submission is correct.

## Scope boundaries

**In scope:**
- Submission types: new shortcut, correction to existing shortcut, new app request
- Prisma schema additions: Submission model (type, status, submitter, app, shortcut data, timestamps, reviewer notes)
- Submission form with key recorder input (captures actual keystrokes for the combo field)
- Client-side duplicate detection: exact match on app + platform + key combo; fuzzy match on command name similarity
- Server-side duplicate detection: re-check on submission create to prevent race conditions
- Pre-moderation: all submissions reviewed before going live
- Admin review queue at `/admin/review` — protected route, accessible only to the site owner
- Approve, edit-and-approve, and reject actions in the review queue
- Approved submissions directly modify the shortcuts table (new row or update existing)
- Contributor credit: accepted count on user profile, list of accepted contributions
- Public contributor profiles
- Notification to contributor on approval or rejection (in-app notification, not email)
- Rate limiting: max 20 submissions per user per day to prevent spam

**Out of scope:**
- Voting or community review (owner-only review for v1 — solo dev can't moderate moderators)
- Bulk submission (importing shortcut lists via CSV or JSON)
- Submission discussion or comments (reviewer approves/rejects with optional reason, no back-and-forth)
- Email notifications (in-app only for v1)
- Auto-approval for trusted contributors (all submissions go through the queue regardless of contributor reputation)
- Shortcut verification (testing that the submitted shortcut actually works in the app)
- AI-powered review assistance (auto-categorizing submissions, auto-detecting quality)
- Gamification (badges, leaderboards, reputation tiers)
- API for programmatic submissions
- Mobile-optimized submission form (web responsive is sufficient, but key recorder requires a keyboard)

## Constraints and requirements

- **Depends on Goal 7:** Submissions require a signed-in user. The User model and auth infrastructure from Goal 7 must be in place.
- **Solo reviewer:** The review queue is designed for a single reviewer (the site owner). The UI should optimize for speed: keyboard shortcuts for approve/reject, batch actions for obvious spam, and clear diff views for corrections.
- **Data integrity:** Approved submissions modify the live shortcuts table directly. Corrections update the existing row (with a history trail in the Submission record). New shortcuts create a new row. The original data is preserved in the Submission record for audit purposes.
- **Key recorder input:** The key combination field must capture actual keystrokes (e.g., the user presses Ctrl+Shift+P and the field displays "Ctrl+Shift+P"). This prevents formatting inconsistencies (e.g., "control-shift-p" vs "Ctrl+Shift+P"). The recorder should normalize key names to match the existing database convention.
- **Rate limiting:** 20 submissions per user per day, enforced server-side. This is generous enough for legitimate power contributors but limits spam potential. No CAPTCHA for v1 — rate limits + auth should be sufficient.
- **Performance:** Duplicate detection API call must respond in <200ms to feel instant during form entry. Review queue page must load all pending submissions in <500ms (acceptable to paginate if volume exceeds 100 pending).
- **Security:** All submission data is sanitized before storage (prevent XSS in command names and notes). Admin routes are protected by role check on the User model. CSRF protection via Auth.js.

## Open questions

- **Key recorder implementation:** Should the key recorder use a third-party library or be custom-built? **Recommendation:** Custom-built using `keydown` event listeners — the logic is straightforward (capture modifier keys + primary key, format as string), and third-party libraries for this are either React-specific or unmaintained. Reuse the same recorder component for both web submissions and potential future desktop shortcut customization.
- **Correction granularity:** Should corrections replace the entire shortcut record or allow field-level edits? **Recommendation:** Field-level edits. The correction form pre-fills all fields but the reviewer sees a diff of only the changed fields. This makes review faster and preserves the original data for unchanged fields.
- **App request workflow:** When an app request is approved, should the owner be prompted to add seed shortcuts immediately, or just create the empty app entry? **Recommendation:** Create the empty app entry. The owner (or community) can add shortcuts later via the normal submission flow. This keeps the approval action fast.
- **Notification system:** Should in-app notifications be a simple badge count + dropdown, or a full notification center? **Recommendation:** Simple badge count on the nav avatar + dropdown showing recent notifications. No notification center for v1 — overkill for the volume of notifications a contributor will receive.
- **Admin role:** Should the admin role be a boolean flag on the User model or a separate Role/Permission system? **Recommendation:** Boolean `isAdmin` flag on the User model. Role-based access control is premature for a solo-dev project. The site owner is the only admin. If collaborators are added later, upgrade to a roles table.

## Dependencies

- **Goal 7** — User Accounts & Favorites Sync (provides auth infrastructure, User model, and signed-in state required for submissions and contributor profiles)
- **Goal 2** — Web Search & Browse Interface (shipped — provides the app/shortcut pages where submission buttons and correction icons will be added)

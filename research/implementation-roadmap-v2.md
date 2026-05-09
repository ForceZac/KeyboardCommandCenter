# Implementation Roadmap

> **This is the law.** The Project Manager treats this file as the single source of truth for what gets built. Every task in `backlog.md` must trace to a goal defined here. Off-roadmap ideas go to `proposals.md` — never directly into the backlog.

Keep goals in **dependency order**. The Project Manager walks this list top-down; the Product Manager writes PRDs for the next 2 upcoming goals that don't yet have one in `research/agents/prds/`.

---

## Goal 1: Shortcut Data Schema & Seed Database

**Why:** Everything depends on having a well-structured, queryable shortcut database. This is the foundation.

**Definition of done:**
- Prisma schema defined
- Seed script populates 50+ apps with verified shortcuts
- Data includes: app name, category, platform (Win/Mac/Linux), shortcut key combo, command description, context/scope

**Dependencies:** none

**PRD:** research/agents/prds/goal-01-shortcut-data-schema.md (to be written by Product Manager)

---

## Goal 2: Web Search & Browse Interface

**Why:** The web interface is the primary discovery surface and proves the data model works before building desktop.

**Definition of done:**
- Next.js app deployed to Vercel
- Users can browse apps by category, search shortcuts across all apps, view per-app shortcut pages with filtering by platform
- Full-text search returns results in <200ms
- Mobile-responsive

**Dependencies:** Goal 1

**PRD:** research/agents/prds/goal-02-web-search-browse.md

---

## Goal 3: Desktop App Shell (Electron + Tray)

**Why:** The background desktop app is the core differentiator. Need the shell running before adding detection/overlay.

**Definition of done:**
- Electron app starts on login, lives in system tray
- Tray menu shows "Open ShortcutVault" and "Quit"
- Global hotkey (configurable, default Ctrl+Shift+Space) opens the shortcut panel
- App uses <50MB RAM idle
- Builds for Windows and Mac via CI

**Dependencies:** Goal 1

**PRD:** research/agents/prds/goal-03-desktop-app-shell.md

---

## Goal 4: Active Window Process Detection

**Why:** Auto-detecting the user's current app is what makes this tool zero-friction — no manual selection needed.

**Definition of done:**
- Background polling (every 1-2s) detects active window process on Windows and Mac
- Process name mapped to app in database
- Tray shows list of recently-detected apps
- Correctly identifies 30+ of the top 50 apps in the database
- Platform adapters for Win32 API and macOS NSWorkspace

**Dependencies:** Goal 3

**PRD:** research/agents/prds/goal-04-process-detection.md

---

## Goal 5: Shortcut Panel UI (Desktop)

**Why:** Once we detect the app, users need a fast, beautiful panel to view shortcuts for it.

**Definition of done:**
- Invoking the global hotkey opens a floating panel showing shortcuts for the detected active app
- Panel supports search/filter within the app's shortcuts
- Panel dismisses on Escape or focus loss
- Renders in <100ms
- Shows platform-appropriate shortcuts (Cmd on Mac, Ctrl on Windows)

**Dependencies:** Goal 4

**PRD:** research/agents/prds/goal-05-shortcut-panel-ui.md

---

## Goal 6: Overlay Mode

**Why:** Overlay lets users see shortcuts without switching context — the fastest possible reference experience.

**Definition of done:**
- User can toggle overlay mode in settings
- Overlay renders a semi-transparent shortcut reference on top of the active app
- Configurable opacity, position, and size
- Does not capture mouse/keyboard input (click-through)
- Toggle on/off via secondary hotkey

**Dependencies:** Goal 5

**PRD:** research/agents/prds/goal-06-overlay-mode.md

---

## Goal 7: User Accounts & Favorites Sync

**Why:** Accounts enable cross-device sync of favorites and personalized shortcut lists — strong retention driver.

**Definition of done:**
- NextAuth integration
- Users can create account, mark shortcuts as favorites, organize into custom collections
- Favorites sync between web and desktop app
- Works offline (local cache, sync on reconnect)

**Dependencies:** Goal 2, Goal 5

**PRD:** research/agents/prds/goal-07-accounts-favorites.md

---

## Goal 8: Community Contributions & Shortcut Submissions

**Why:** Scales the database beyond what one person can maintain. Engages power users as contributors.

**Definition of done:**
- Logged-in users can submit new shortcuts or corrections
- Submissions enter a review queue
- Approved submissions go live
- Contributors get credit
- Duplicate detection prevents spam

**Dependencies:** Goal 7

**PRD:** research/agents/prds/goal-08-community-contributions.md

---

## Goal 9: Auto-Update & Distribution

**Why:** Desktop app needs seamless updates so users always have the latest shortcut data and features.

**Definition of done:**
- Electron auto-updater checks for updates on launch
- Updates download in background and apply on restart
- Distributed via GitHub Releases
- Code-signed for Windows (Authenticode) and Mac (notarization)
- Landing page with download buttons

**Dependencies:** Goal 6

**PRD:** research/agents/prds/goal-09-auto-update-distribution.md

---

## Goal 10: Linux Support

**Why:** Expands addressable market to developer-heavy Linux users who are prime shortcut power users.

**Definition of done:**
- Process detection works on X11 and Wayland (best-effort)
- Desktop app packaged as AppImage and .deb
- Overlay functional on X11
- Listed on Flathub or Snap Store

**Dependencies:** Goal 9

**PRD:** research/agents/prds/goal-10-linux-support.md

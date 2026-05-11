# Keyboard Command Center

A cross-platform keyboard shortcut reference tool — web app + desktop overlay. Look up shortcuts for 50+ apps instantly, with active window detection that pre-loads the right shortcuts automatically.

---

## What's included

- **Web app** (`packages/web`) — Next.js app with full shortcut database, search, per-app pages, favorites, and community submissions
- **Desktop app** (`packages/desktop`) — Electron tray app with global hotkey, shortcut panel, and always-on-top overlay that follows your active window
- **Overlay** (`packages/overlay`) — React/Vite app rendered inside the desktop overlay window
- **Core** (`packages/core`) — Shared TypeScript types
- **Database** (`database`) — Prisma schema + migrations for PostgreSQL

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Required |
| npm | 9+ | Comes with Node |
| Rust + Cargo | stable | For the native active-window module |
| PostgreSQL | 14+ | Local install or Docker |

Install Rust: https://rustup.rs

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/ForceZac/KeyboardCommandCenter.git
cd KeyboardCommandCenter
npm install
```

### 2. Set up the database

**Option A — Docker (easiest)**

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 with user `kcc`, password `kcc`, database `kcc`.

**Option B — Local PostgreSQL**

Create a database and user:

```sql
CREATE USER kcc WITH PASSWORD 'kcc';
CREATE DATABASE kcc OWNER kcc;
```

### 3. Configure environment variables

**Web app** — create `packages/web/.env.local`:

```env
DATABASE_URL="postgresql://kcc:kcc@localhost:5432/kcc"

# NextAuth — generate a secret with: openssl rand -base64 32
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# OAuth providers (optional for local dev — auth features will be disabled without these)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

**Desktop app** — create `packages/desktop/.env`:

```env
DATABASE_URL="postgresql://kcc:kcc@localhost:5432/kcc"
```

### 4. Run migrations and seed data

```bash
# Apply database schema
DATABASE_URL="postgresql://kcc:kcc@localhost:5432/kcc" npx prisma migrate deploy -w database

# Seed 50+ apps with shortcuts
DATABASE_URL="postgresql://kcc:kcc@localhost:5432/kcc" npx prisma db seed -w database
```

### 5. Build the native module (desktop only)

The active-window detection uses a Rust native module. Build it before running the desktop app:

```bash
npm run build:native -w @kcc/desktop
```

This compiles the Rust crate in `packages/desktop/native/` and outputs a `.node` binary.

### 6. Build the overlay renderer (desktop only)

```bash
npm run build:overlay
```

This builds the React overlay app into `packages/overlay/dist/`, which the desktop app bundles at runtime.

---

## Running locally

### Web app

```bash
npm run dev
```

Opens at http://localhost:3000.

### Desktop app

```bash
npm run dev -w @kcc/desktop
```

This starts the Electron app. Look for the tray icon — use the global hotkey (`Ctrl+Shift+Space` / `Cmd+Shift+Space`) to open the shortcut panel.

> **Note:** The desktop app connects to PostgreSQL via `DATABASE_URL`. Make sure the database is running before launching.

---

## Running tests

### Web + database tests

```bash
# Unit tests (no database needed)
npm run test -w @kcc/web

# Database integration tests (requires PostgreSQL)
DATABASE_URL="postgresql://kcc:kcc@localhost:5432/kcc_test" npm test -w database
```

### Desktop tests

```bash
npm run test -w @kcc/desktop
```

### Type checking

```bash
# Web
npx tsc --noEmit -p packages/web/tsconfig.json

# Desktop (3 tsconfigs)
npm run typecheck -w @kcc/desktop
```

---

## Project structure

```
KeyboardCommandCenter/
├── packages/
│   ├── web/          # Next.js web app
│   ├── desktop/      # Electron desktop app
│   │   └── native/   # Rust napi-rs native module (active window detection)
│   ├── overlay/      # React overlay renderer (built by Vite)
│   └── core/         # Shared TypeScript types
├── database/         # Prisma schema + migrations + seed script
├── docker-compose.yml
└── package.json      # npm workspaces root
```

---

## Common issues

**`npm run build:native` fails**
Make sure Rust is installed (`rustup show`) and you have the correct target. On macOS you may need Xcode Command Line Tools (`xcode-select --install`).

**Desktop app can't connect to the database**
Check that `DATABASE_URL` is set in `packages/desktop/.env` and PostgreSQL is running. The app uses Prisma which requires a live connection on startup.

**Overlay doesn't appear**
Run `npm run build:overlay` first. The overlay renderer must be built before the desktop app can load it.

**Port 5432 already in use**
Another PostgreSQL instance is running. Either stop it or change the port in `docker-compose.yml` and your `DATABASE_URL`.

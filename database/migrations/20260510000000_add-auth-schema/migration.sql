-- Auth.js v5 standard tables for KeyboardCommandCenter
-- Applies after: 20260509000001_add-fts-indexes
--
-- Adds the four models required by @auth/prisma-adapter:
--   users              — core user identity (OAuth-only; no password hash)
--   accounts           — links a user to one or more OAuth providers
--   sessions           — present for adapter compatibility; never written (JWT strategy)
--   verification_tokens — present for adapter compatibility; unused in this task
--
-- No existing tables are altered.

-- User: core identity record created on first OAuth sign-in
CREATE TABLE "users" (
  "id"            TEXT NOT NULL,
  "name"          TEXT,
  "email"         TEXT NOT NULL,
  "emailVerified" TIMESTAMP(3),
  "image"         TEXT,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Account: links a User to one or more OAuth provider records
CREATE TABLE "accounts" (
  "id"                TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "type"              TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token"     TEXT,
  "access_token"      TEXT,
  "expires_at"        INTEGER,
  "token_type"        TEXT,
  "scope"             TEXT,
  "id_token"          TEXT,
  "session_state"     TEXT,

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key"
  ON "accounts"("provider", "providerAccountId");

-- Session: schema-present for adapter parity; rows never written with JWT strategy
CREATE TABLE "sessions" (
  "id"           TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "expires"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- VerificationToken: schema-present for adapter parity; unused (no email/password flow)
CREATE TABLE "verification_tokens" (
  "identifier" TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "expires"    TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "verification_tokens_token_key"
  ON "verification_tokens"("token");

CREATE UNIQUE INDEX "verification_tokens_identifier_token_key"
  ON "verification_tokens"("identifier", "token");

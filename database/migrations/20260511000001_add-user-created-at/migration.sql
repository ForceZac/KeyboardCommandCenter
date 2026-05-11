-- Add createdAt to users table for "Member since" display on contributor profiles.
-- Existing rows are backfilled with NOW() (acceptable — all users are from current dev phase).

ALTER TABLE "users" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

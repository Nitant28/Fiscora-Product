-- Sprint 18.1.2: Track user login activity (identity layer).
-- Nullable: existing rows stay valid; populated on each successful login.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

-- Sprint 18B: Employee profile fields + reporting line + inviter.
-- All nullable / defaulted so existing users remain valid.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvalLimit" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "costCenter" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'en';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerId" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitedById" INTEGER;

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "User_managerId_idx" ON "User"("managerId");

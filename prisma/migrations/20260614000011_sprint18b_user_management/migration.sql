-- Sprint 18A.1: Enterprise Identity — account lifecycle + invitations + login history.
-- Scope is deliberately identity-only. Employee HR profile fields land in Sprint 18B.
-- passwordHash is intentionally LEFT REQUIRED to preserve a legacy-login rollback path.

-- 1. Enums --------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'LOCKED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. User: account lifecycle status only -------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");

-- 3. Invitation table --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Invitation" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "userId" INTEGER,
  "email" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "token" TEXT NOT NULL,
  "clerkInvitationId" TEXT,
  "invitedById" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "Invitation"("token");
CREATE INDEX IF NOT EXISTS "Invitation_tenantId_idx" ON "Invitation"("tenantId");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX IF NOT EXISTS "Invitation_status_idx" ON "Invitation"("status");

DO $$ BEGIN
  ALTER TABLE "Invitation"
    ADD CONSTRAINT "Invitation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Invitation"
    ADD CONSTRAINT "Invitation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. LoginHistory table ------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LoginHistory" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "country" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginHistory_userId_idx" ON "LoginHistory"("userId");
CREATE INDEX IF NOT EXISTS "LoginHistory_tenantId_idx" ON "LoginHistory"("tenantId");
CREATE INDEX IF NOT EXISTS "LoginHistory_createdAt_idx" ON "LoginHistory"("createdAt");

DO $$ BEGIN
  ALTER TABLE "LoginHistory"
    ADD CONSTRAINT "LoginHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

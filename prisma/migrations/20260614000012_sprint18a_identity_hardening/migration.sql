-- Sprint 18A hardening: brute-force lockout, session invalidation, tenant lifecycle.

-- 1. Tenant lifecycle --------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE';

-- 2. User: lockout + session invalidation ------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionsValidFrom" TIMESTAMP(3);

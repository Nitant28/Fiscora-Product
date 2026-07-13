-- Sprint 18.1.1: Clerk identity column.
-- Identity bridge only — Fiscora still owns tenant, role, department, and permissions.
-- Nullable + unique: existing rows stay valid (NULL), one Clerk account maps to one user.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clerkId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId");

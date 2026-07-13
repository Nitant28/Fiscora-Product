-- Sprint 8.4: Compliance investigations, vendor lifecycle, soft deletes, audit correlation
-- Note: enum values must be committed before use — data backfill runs in app seed.

ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'COMPLIANCE_REVIEW';
ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_requestId_idx" ON "AuditLog"("requestId");

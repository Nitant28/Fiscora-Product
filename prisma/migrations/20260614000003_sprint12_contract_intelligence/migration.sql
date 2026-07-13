-- Sprint 12: Contract intelligence metadata

ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "renewalNoticeDays" INTEGER DEFAULT 60;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "annualValue" DECIMAL(14,2);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "ownerDepartment" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "contractCategory" TEXT;

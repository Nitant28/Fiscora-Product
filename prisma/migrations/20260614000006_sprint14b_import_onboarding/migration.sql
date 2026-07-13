-- Sprint 14B/15: Import Center + Onboarding

ALTER TABLE "Tenant" ADD COLUMN "industry" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "currency" TEXT DEFAULT 'INR';
ALTER TABLE "Tenant" ADD COLUMN "timezone" TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE "Tenant" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Tenant" SET "onboardingComplete" = true WHERE "slug" = 'default';

CREATE TABLE "ImportJob" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportJob_tenantId_idx" ON "ImportJob"("tenantId");
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

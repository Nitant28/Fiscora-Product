-- Sprint 18C.1: Universal Notification Center

CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

ALTER TABLE "Notification" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "Notification" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Notification" ADD COLUMN "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO';
ALTER TABLE "Notification" ADD COLUMN "entityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN "entityId" INTEGER;
ALTER TABLE "Notification" ADD COLUMN "actionUrl" TEXT;
ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);

-- Backfill tenantId from the owning user
UPDATE "Notification" n
SET "tenantId" = u."tenantId"
FROM "User" u
WHERE n."userId" = u.id AND n."tenantId" IS NULL;

-- Backfill readAt for already-read notifications
UPDATE "Notification"
SET "readAt" = "createdAt"
WHERE "read" = true AND "readAt" IS NULL;

ALTER TABLE "Notification" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- Sprint 11.5: Backup & disaster recovery audit trail

CREATE TYPE "BackupRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

CREATE TABLE IF NOT EXISTS "BackupRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "sizeBytes" BIGINT,
    "status" "BackupRunStatus" NOT NULL DEFAULT 'RUNNING',
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "filePath" TEXT,
    "errorMessage" TEXT,
    "restoreVerified" BOOLEAN NOT NULL DEFAULT false,
    "triggeredBy" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BackupRun_startedAt_idx" ON "BackupRun"("startedAt");
CREATE INDEX IF NOT EXISTS "BackupRun_status_idx" ON "BackupRun"("status");

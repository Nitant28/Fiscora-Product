-- Sprint 8.5: Enterprise readiness — soft deletes + error tracking

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "userId" TEXT,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErrorLog_requestId_idx" ON "ErrorLog"("requestId");
CREATE INDEX "ErrorLog_userId_idx" ON "ErrorLog"("userId");
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

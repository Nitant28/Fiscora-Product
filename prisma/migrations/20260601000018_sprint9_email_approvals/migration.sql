-- Sprint 9: Email approvals

CREATE TABLE "ApprovalToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'PurchaseRequest',
    "action" TEXT NOT NULL,
    "recipientUserId" INTEGER,
    "recipientEmail" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApprovalToken_token_key" ON "ApprovalToken"("token");
CREATE INDEX "ApprovalToken_approvalId_idx" ON "ApprovalToken"("approvalId");

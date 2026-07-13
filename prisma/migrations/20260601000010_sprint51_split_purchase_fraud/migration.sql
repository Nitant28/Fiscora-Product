-- Sprint 5.1: Split purchase fraud flags

CREATE TABLE "PurchaseRequestFlag" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestFlag_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PurchaseRequestFlag" ADD CONSTRAINT "PurchaseRequestFlag_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PurchaseRequestFlag_requestId_idx" ON "PurchaseRequestFlag"("requestId");
CREATE INDEX "PurchaseRequestFlag_type_resolved_idx" ON "PurchaseRequestFlag"("type", "resolved");

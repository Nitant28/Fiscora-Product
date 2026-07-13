-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "ProcurementInsight" DROP CONSTRAINT IF EXISTS "ProcurementInsight_documentId_fkey";

-- DropTable
DROP TABLE IF EXISTS "ProcurementInsight";

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "poNumber" TEXT NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL,
    "maxAmount" DOUBLE PRECISION,
    "approver" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "purchaseOrderId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default approval rules
INSERT INTO "ApprovalRule" ("name", "minAmount", "maxAmount", "approver", "active")
SELECT 'Manager approval', 0, 10000, 'Manager', true
WHERE NOT EXISTS (SELECT 1 FROM "ApprovalRule" WHERE "name" = 'Manager approval');

INSERT INTO "ApprovalRule" ("name", "minAmount", "maxAmount", "approver", "active")
SELECT 'Director approval', 10000, 50000, 'Director', true
WHERE NOT EXISTS (SELECT 1 FROM "ApprovalRule" WHERE "name" = 'Director approval');

INSERT INTO "ApprovalRule" ("name", "minAmount", "maxAmount", "approver", "active")
SELECT 'CFO approval', 50000, NULL, 'CFO', true
WHERE NOT EXISTS (SELECT 1 FROM "ApprovalRule" WHERE "name" = 'CFO approval');

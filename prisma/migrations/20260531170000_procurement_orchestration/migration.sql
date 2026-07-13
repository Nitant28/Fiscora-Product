-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('MATCHED', 'PRICE_MISMATCH', 'QUANTITY_MISMATCH', 'NO_PO');

-- AlterEnum
BEGIN;
CREATE TYPE "PurchaseOrderStatus_new" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" TYPE "PurchaseOrderStatus_new" USING ("status"::text::"PurchaseOrderStatus_new");
ALTER TYPE "PurchaseOrderStatus" RENAME TO "PurchaseOrderStatus_old";
ALTER TYPE "PurchaseOrderStatus_new" RENAME TO "PurchaseOrderStatus";
DROP TYPE "PurchaseOrderStatus_old";
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_purchaseOrderId_fkey";
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_vendorId_fkey";

-- AlterTable PurchaseOrder
ALTER TABLE "PurchaseOrder" DROP COLUMN IF EXISTS "vendorId";
ALTER TABLE "PurchaseOrder" DROP COLUMN IF EXISTS "totalAmount";
ALTER TABLE "PurchaseOrder" DROP COLUMN IF EXISTS "createdBy";
ALTER TABLE "PurchaseOrder" DROP COLUMN IF EXISTS "approvedBy";
ALTER TABLE "PurchaseOrder" DROP COLUMN IF EXISTS "approvedAt";
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "vendorName" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "requestId" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION;

-- AlterTable Document
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "poMatchConfidence" DOUBLE PRECISION;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "matchedPoNumber" TEXT;

-- AlterTable Vendor
ALTER TABLE "Vendor" DROP COLUMN IF EXISTS "vendorScore";
ALTER TABLE "Vendor" DROP COLUMN IF EXISTS "pricingScore";
ALTER TABLE "Vendor" DROP COLUMN IF EXISTS "accuracyScore";
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "deliveryScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "priceCompetitivenessScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "invoiceAccuracyScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "responseTimeScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ThreeWayMatch" (
    "id" SERIAL NOT NULL,
    "poId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL,
    "variance" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThreeWayMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ThreeWayMatch_poId_invoiceId_key" ON "ThreeWayMatch"("poId", "invoiceId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThreeWayMatch" ADD CONSTRAINT "ThreeWayMatch_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThreeWayMatch" ADD CONSTRAINT "ThreeWayMatch_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

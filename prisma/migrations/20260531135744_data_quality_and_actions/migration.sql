-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoiceStatus" ADD VALUE 'in_review';
ALTER TYPE "InvoiceStatus" ADD VALUE 'escalated';
ALTER TYPE "InvoiceStatus" ADD VALUE 'clarification_requested';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "dataQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "financialConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lineItemConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "vendorConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InvoiceAction" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InvoiceAction" ADD CONSTRAINT "InvoiceAction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

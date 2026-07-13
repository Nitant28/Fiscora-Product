-- Sprint 4.0: Payment Intelligence Engine

CREATE TYPE "PaymentStatus" AS ENUM ('SCHEDULED', 'READY', 'PROCESSING', 'PAID', 'FAILED');

ALTER TABLE "Vendor" ADD COLUMN "paymentTermsDays" INTEGER;
ALTER TABLE "Vendor" ADD COLUMN "msmeRegistered" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_documentId_key" ON "Payment"("documentId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill payment terms days from existing string values
UPDATE "Vendor" SET "paymentTermsDays" = 30 WHERE "paymentTerms" ILIKE '%30%' AND "paymentTermsDays" IS NULL;
UPDATE "Vendor" SET "paymentTermsDays" = 45 WHERE "paymentTerms" ILIKE '%45%' AND "paymentTermsDays" IS NULL;
UPDATE "Vendor" SET "paymentTermsDays" = 60 WHERE "paymentTerms" ILIKE '%60%' AND "paymentTermsDays" IS NULL;
UPDATE "Vendor" SET "paymentTermsDays" = 90 WHERE "paymentTerms" ILIKE '%90%' AND "paymentTermsDays" IS NULL;
UPDATE "Vendor" SET "paymentTermsDays" = 15 WHERE "paymentTerms" ILIKE '%15%' AND "paymentTermsDays" IS NULL;

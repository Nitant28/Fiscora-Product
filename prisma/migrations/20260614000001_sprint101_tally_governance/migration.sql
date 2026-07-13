-- Sprint 10.1: Tally data governance — vendor master, GST breakdown, export audit

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "vendorCode" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "vendorType" TEXT NOT NULL DEFAULT 'SUPPLIER';
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'India';
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "isOcrGenerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "tallyReadinessScore" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_vendorCode_key" ON "Vendor"("vendorCode");

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "cgst" DOUBLE PRECISION;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sgst" DOUBLE PRECISION;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "igst" DOUBLE PRECISION;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "gstPercent" DOUBLE PRECISION;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "bankReference" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

CREATE TABLE IF NOT EXISTS "TallyExportAudit" (
    "id" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "filters" JSONB,
    "actorUserId" INTEGER,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TallyExportAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TallyExportAudit_exportType_idx" ON "TallyExportAudit"("exportType");
CREATE INDEX IF NOT EXISTS "TallyExportAudit_createdAt_idx" ON "TallyExportAudit"("createdAt");

-- Resolve duplicate invoice numbers before unique constraint
UPDATE "Document" d
SET "invoiceNumber" = 'DUP-' || d.id || '-' || COALESCE(d."invoiceNumber", 'DOC')
WHERE d."invoiceNumber" IS NOT NULL
  AND d.id NOT IN (
    SELECT MIN(id)
    FROM "Document"
    WHERE "invoiceNumber" IS NOT NULL
      AND "deletedAt" IS NULL
    GROUP BY "invoiceNumber"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "Document_invoiceNumber_key" ON "Document"("invoiceNumber");

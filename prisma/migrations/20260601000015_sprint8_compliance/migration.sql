-- Sprint 8: GST Intelligence + Compliance Documents

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "VendorDocType" ADD VALUE IF NOT EXISTS 'MSME';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "complianceRiskScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "VendorDocument" ADD COLUMN IF NOT EXISTS "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "VendorDocument" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);
ALTER TABLE "VendorDocument" ADD COLUMN IF NOT EXISTS "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "GstValidation" (
    "id" TEXT NOT NULL,
    "gstNumber" TEXT NOT NULL,
    "vendorId" INTEGER,
    "isValid" BOOLEAN NOT NULL,
    "stateCode" TEXT,
    "panDerived" TEXT,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GstValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GstValidation_gstNumber_idx" ON "GstValidation"("gstNumber");
CREATE INDEX "GstValidation_vendorId_idx" ON "GstValidation"("vendorId");

-- AddForeignKey
ALTER TABLE "GstValidation" ADD CONSTRAINT "GstValidation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill uploadedAt from createdAt
UPDATE "VendorDocument" SET "uploadedAt" = "createdAt" WHERE "uploadedAt" IS NULL;

-- CreateEnum
CREATE TYPE "FlagCategory" AS ENUM ('EXTRACTION', 'FINANCIAL', 'FRAUD', 'PROCUREMENT');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "extractionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "requiresReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ExtractionCorrection" ADD COLUMN     "documentId" INTEGER;

-- AlterTable
ALTER TABLE "InvoiceFlag" ADD COLUMN     "flagCategory" "FlagCategory" NOT NULL DEFAULT 'FINANCIAL';

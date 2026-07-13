-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "accuracyScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pricingScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reliabilityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vendorScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProcurementInsight" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "savingsAmount" DOUBLE PRECISION,
    "documentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcurementInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionCorrection" (
    "id" SERIAL NOT NULL,
    "field" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "correctedValue" TEXT NOT NULL,
    "vendorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionCorrection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProcurementInsight" ADD CONSTRAINT "ProcurementInsight_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionCorrection" ADD CONSTRAINT "ExtractionCorrection_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

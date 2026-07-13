-- Sprint 6.0: Contract lifecycle repository

CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');

ALTER TABLE "Contract" ADD COLUMN "contractNumber" TEXT;
ALTER TABLE "Contract" ADD COLUMN "title" TEXT;
ALTER TABLE "Contract" ADD COLUMN "renewalDate" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "documentUrl" TEXT;
ALTER TABLE "Contract" ADD COLUMN "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "Contract"
SET
  "contractNumber" = 'CTR-LEGACY-' || "id",
  "title" = 'Legacy Contract',
  "status" = CASE
    WHEN "endDate" < NOW() THEN 'EXPIRED'::"ContractStatus"
    ELSE 'ACTIVE'::"ContractStatus"
  END
WHERE "contractNumber" IS NULL;

ALTER TABLE "Contract" ALTER COLUMN "contractNumber" SET NOT NULL;
ALTER TABLE "Contract" ALTER COLUMN "title" SET NOT NULL;

ALTER TABLE "Contract" ALTER COLUMN "value" SET DATA TYPE DECIMAL(14,2) USING "value"::DECIMAL(14,2);

CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

ALTER TABLE "PurchaseOrder" ADD COLUMN "contractId" INTEGER;

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PurchaseOrder_contractId_idx" ON "PurchaseOrder"("contractId");

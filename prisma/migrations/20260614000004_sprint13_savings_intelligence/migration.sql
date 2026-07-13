-- Sprint 13: Savings Intelligence
CREATE TYPE "SavingsEventType" AS ENUM (
  'RFQ_SAVINGS',
  'NEGOTIATION_SAVINGS',
  'CONTRACT_SAVINGS',
  'BUDGET_AVOIDANCE',
  'FRAUD_PREVENTED',
  'VENDOR_CONSOLIDATION'
);

CREATE TABLE "SavingsEvent" (
  "id" SERIAL NOT NULL,
  "type" "SavingsEventType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "title" TEXT,
  "description" TEXT,
  "vendorId" INTEGER,
  "purchaseRequestId" INTEGER,
  "rfqId" INTEGER,
  "contractId" INTEGER,
  "departmentId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavingsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavingsEvent_type_idx" ON "SavingsEvent"("type");
CREATE INDEX "SavingsEvent_createdAt_idx" ON "SavingsEvent"("createdAt");

ALTER TABLE "SavingsEvent"
  ADD CONSTRAINT "SavingsEvent_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SavingsEvent"
  ADD CONSTRAINT "SavingsEvent_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

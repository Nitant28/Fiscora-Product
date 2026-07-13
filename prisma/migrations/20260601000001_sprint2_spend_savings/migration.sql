-- Sprint 2: Spend Categories, Savings, Vendor Procurement Score

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "procurementScore" DOUBLE PRECISION;

ALTER TABLE "PurchaseRequest" ADD COLUMN IF NOT EXISTS "categoryId" INTEGER;

CREATE TABLE IF NOT EXISTS "SpendCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpendCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SpendCategory_name_key" ON "SpendCategory"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "SpendCategory_code_key" ON "SpendCategory"("code");

CREATE TABLE IF NOT EXISTS "Savings" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "requestedPrice" DOUBLE PRECISION NOT NULL,
    "negotiatedPrice" DOUBLE PRECISION NOT NULL,
    "marketBenchmark" DOUBLE PRECISION,
    "savings" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Savings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Savings_purchaseOrderId_key" ON "Savings"("purchaseOrderId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequest_categoryId_fkey'
    ) THEN
        ALTER TABLE "PurchaseRequest"
        ADD CONSTRAINT "PurchaseRequest_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "SpendCategory"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Savings_purchaseOrderId_fkey'
    ) THEN
        ALTER TABLE "Savings"
        ADD CONSTRAINT "Savings_purchaseOrderId_fkey"
        FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Sprint 14A: Multi-tenant foundation

CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

INSERT INTO "Tenant" ("name", "slug") VALUES ('Default Company', 'default');

-- Drop global unique constraints before adding tenant-scoped columns
DROP INDEX IF EXISTS "Department_name_key";
DROP INDEX IF EXISTS "Vendor_name_key";
DROP INDEX IF EXISTS "Vendor_vendorCode_key";
DROP INDEX IF EXISTS "Vendor_portalEmail_key";
DROP INDEX IF EXISTS "PurchaseOrder_poNumber_key";
DROP INDEX IF EXISTS "Document_invoiceNumber_key";
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "Contract_contractNumber_key";
DROP INDEX IF EXISTS "Payment_paymentNumber_key";

ALTER TABLE "Department" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "Vendor" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "PurchaseRequest" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "Document" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "AuditLog" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "User" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "Contract" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "RFQ" ADD COLUMN "tenantId" INTEGER;

UPDATE "Department" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Vendor" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "PurchaseRequest" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "PurchaseOrder" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Document" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "AuditLog" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "User" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Contract" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "Payment" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "RFQ" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

ALTER TABLE "Department" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Vendor" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PurchaseRequest" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Contract" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "RFQ" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "Department"("tenantId", "name");
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

CREATE UNIQUE INDEX "Vendor_tenantId_name_key" ON "Vendor"("tenantId", "name");
CREATE UNIQUE INDEX "Vendor_tenantId_vendorCode_key" ON "Vendor"("tenantId", "vendorCode");
CREATE UNIQUE INDEX "Vendor_tenantId_portalEmail_key" ON "Vendor"("tenantId", "portalEmail");
CREATE INDEX "Vendor_tenantId_idx" ON "Vendor"("tenantId");

CREATE INDEX "PurchaseRequest_tenantId_idx" ON "PurchaseRequest"("tenantId");

CREATE UNIQUE INDEX "PurchaseOrder_tenantId_poNumber_key" ON "PurchaseOrder"("tenantId", "poNumber");
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");

CREATE UNIQUE INDEX "Document_tenantId_invoiceNumber_key" ON "Document"("tenantId", "invoiceNumber");
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

CREATE UNIQUE INDEX "Contract_tenantId_contractNumber_key" ON "Contract"("tenantId", "contractNumber");
CREATE INDEX "Contract_tenantId_idx" ON "Contract"("tenantId");

CREATE UNIQUE INDEX "Payment_tenantId_paymentNumber_key" ON "Payment"("tenantId", "paymentNumber");
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

CREATE INDEX "RFQ_tenantId_idx" ON "RFQ"("tenantId");

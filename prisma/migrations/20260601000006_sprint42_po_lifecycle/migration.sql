-- Sprint 4.2: PO lifecycle timestamps and RFQ bid terms on PO

ALTER TABLE "PurchaseOrder" ADD COLUMN "leadTimeDays" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "warrantyMonths" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "closedAt" TIMESTAMP(3);

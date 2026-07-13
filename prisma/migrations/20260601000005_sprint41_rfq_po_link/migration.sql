-- Sprint 4.1: RFQ Award → PO Generation link

ALTER TABLE "PurchaseOrder" ALTER COLUMN "requestId" DROP NOT NULL;

ALTER TABLE "RFQ" ADD COLUMN "purchaseOrderId" INTEGER;

CREATE UNIQUE INDEX "RFQ_purchaseOrderId_key" ON "RFQ"("purchaseOrderId");

ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

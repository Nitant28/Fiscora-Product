import prisma from "../../db";
import { recordAuditLog } from "../../lib/audit";
import { generatePoNumber } from "./purchase-order.service";

export async function generatePOFromRFQ(
  rfqId: number,
  actor: string
) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    include: {
      awardedVendor: true,
      purchaseOrder: true,
      savings: true,
    },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  if (rfq.status !== "AWARDED") {
    throw new Error(
      "RFQ must be AWARDED before generating a PO"
    );
  }

  if (!rfq.awardedVendorId || !rfq.awardedVendor) {
    throw new Error(
      "RFQ has no awarded vendor"
    );
  }

  if (rfq.purchaseOrder) {
    return rfq.purchaseOrder;
  }

  const winningBid =
    await prisma.vendorBid.findFirst({
      where: {
        rfqId,
        vendorId: rfq.awardedVendorId,
      },
      include: { vendor: true },
    });

  if (!winningBid) {
    throw new Error(
      "Winning bid not found for awarded vendor"
    );
  }

  const poNumber =
    await generatePoNumber();

  const po = await prisma.$transaction(
    async (tx) => {
      const created =
        await tx.purchaseOrder.create({
          data: {
            poNumber,
            vendorName:
              winningBid.vendor.name,
            amount:
              winningBid.quotedAmount,
            leadTimeDays:
              winningBid.leadTimeDays,
            warrantyMonths:
              winningBid.warrantyMonths,
            status: "DRAFT",
          },
        });

      await tx.rFQ.update({
        where: { id: rfqId },
        data: {
          purchaseOrderId: created.id,
        },
      });

      return created;
    }
  );

  await recordAuditLog(
    "RFQ",
    rfqId,
    "RFQ_PO_GENERATED",
    actor,
    {
      newValue: {
        rfqId,
        poId: po.id,
        poNumber: po.poNumber,
        vendorId: rfq.awardedVendorId,
        vendorName:
          rfq.awardedVendor.name,
        amount: po.amount,
        leadTimeDays:
          winningBid.leadTimeDays,
        warrantyMonths:
          winningBid.warrantyMonths,
      },
      metadata: {
        rfqTitle: rfq.title,
        rfqSavings:
          rfq.savings?.savings ?? null,
      },
    }
  );

  await recordAuditLog(
    "PurchaseOrder",
    po.id,
    "PO Generated From RFQ",
    actor,
    {
      newValue: {
        poNumber: po.poNumber,
        rfqId,
        vendorName: po.vendorName,
        amount: po.amount,
        status: "DRAFT",
      },
    }
  );

  return po;
}

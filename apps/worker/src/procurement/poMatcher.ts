import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function calculateVariance(
  poAmount: number,
  invoiceAmount: number
) {
  const variance =
    invoiceAmount - poAmount;
  const variancePercent =
    poAmount !== 0
      ? (variance / poAmount) * 100
      : 0;

  return {
    variance,
    withinTolerance:
      Math.abs(variancePercent) <= 5,
  };
}

export async function autoMatchInvoiceToPO(
  documentId: number
): Promise<{
  matched: boolean;
  poNumber?: string;
  confidence?: number;
}> {
  const document =
    await prisma.document.findUnique({
      where: { id: documentId },
    });

  if (!document) {
    return { matched: false };
  }

  const text = [
    document.rawText,
    document.invoiceNumber,
    JSON.stringify(
      document.extractedData ?? {}
    ),
  ]
    .filter(Boolean)
    .join(" ");

  const poNumberMatch = text.match(
    /PO-\d{4}-\d{4}/i
  );

  if (poNumberMatch) {
    const poNumber =
      poNumberMatch[0].toUpperCase();

    const po =
      await prisma.purchaseOrder.findUnique({
        where: { poNumber },
      });

    if (po) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          purchaseOrderId: po.id,
          matchedPoNumber: poNumber,
          poMatchConfidence: 98,
        },
      });

      await prisma.auditLog.create({
        data: {
          entityType: "Document",
          entityId: documentId,
          action: "Invoice Matched to PO",
          actor: "System",
          metadata: {
            poNumber,
            confidence: 98,
          },
        },
      });

      return {
        matched: true,
        poNumber,
        confidence: 98,
      };
    }
  }

  if (
    document.vendorName &&
    document.totalAmount != null
  ) {
    const candidates =
      await prisma.purchaseOrder.findMany({
        where: {
          vendorName: {
            contains:
              document.vendorName,
            mode: "insensitive",
          },
          status: {
            in: [
              "SENT",
              "ACCEPTED",
              "PARTIALLY_RECEIVED",
              "RECEIVED",
            ],
          },
        },
      });

    for (const po of candidates) {
      const { withinTolerance } =
        calculateVariance(
          po.amount,
          document.totalAmount
        );

      if (withinTolerance) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            purchaseOrderId: po.id,
            matchedPoNumber: po.poNumber,
            poMatchConfidence: 85,
          },
        });

        return {
          matched: true,
          poNumber: po.poNumber,
          confidence: 85,
        };
      }
    }
  }

  return { matched: false };
}

export async function runThreeWayMatchWorker(
  poId: number,
  invoiceId: number
) {
  const [po, invoice] =
    await Promise.all([
      prisma.purchaseOrder.findUnique({
        where: { id: poId },
      }),
      prisma.document.findUnique({
        where: { id: invoiceId },
      }),
    ]);

  if (!po || !invoice?.totalAmount) {
    return;
  }

  const { variance, withinTolerance } =
    calculateVariance(
      po.amount,
      invoice.totalAmount
    );

  let status:
    | "MATCHED"
    | "PRICE_MISMATCH"
    | "QUANTITY_MISMATCH" = "MATCHED";

  if (!withinTolerance) {
    status = "PRICE_MISMATCH";
  } else if (
    !["RECEIVED", "PARTIALLY_RECEIVED"].includes(
      po.status
    )
  ) {
    status = "QUANTITY_MISMATCH";
  }

  await prisma.threeWayMatch.upsert({
    where: {
      poId_invoiceId: { poId, invoiceId },
    },
    create: {
      poId,
      invoiceId,
      status,
      variance,
    },
    update: { status, variance },
  });
}

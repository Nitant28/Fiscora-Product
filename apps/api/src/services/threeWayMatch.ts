/**
 * Domain: Invoice matching — PO / receipt / invoice three-way match and payment eligibility.
 * Main exports: normalizeMatchStatus, isPaymentBlocked, performThreeWayMatch, getThreeWayMatchForInvoice, assertPaymentAllowed.
 * Called by: server.ts, purchase-order.service.ts, purchase-order.controller.ts, paymentEngine.ts.
 */
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";
import { getTotalReceivedQuantity } from "./goodsReceipt";
import { assertInvoiceNotBlocked } from "./fraudDetection";

export type ThreeWayMatchSummary = {
  status: string;
  variance: number | null;
  poAmount: number | null;
  invoiceAmount: number | null;
  poQuantity: number | null;
  receivedQuantity: number | null;
  invoicedQuantity: number | null;
  paymentBlocked: boolean;
};

function calculateAmountVariance(
  poAmount: number,
  invoiceAmount: number
) {
  const variance = invoiceAmount - poAmount;
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

function sumInvoiceQuantity(
  lineItems: { quantity: number | null }[]
): number {
  if (lineItems.length === 0) {
    return 0;
  }

  return lineItems.reduce(
    (sum, item) =>
      sum + (item.quantity ?? 0),
    0
  );
}

export function normalizeMatchStatus(
  status: string
): "PENDING" | "MATCHED" | "MISMATCH" {
  if (status === "MATCHED") {
    return "MATCHED";
  }

  if (status === "PENDING") {
    return "PENDING";
  }

  return "MISMATCH";
}

export function isPaymentBlocked(
  status: string
): boolean {
  return (
    normalizeMatchStatus(status) === "MISMATCH"
  );
}

/* --- MATCH EXECUTION --- */

export async function performThreeWayMatch(
  poId: number,
  invoiceId: number
): Promise<ThreeWayMatchSummary> {
  const [po, invoice, receivedQuantity] =
    await Promise.all([
      prisma.purchaseOrder.findUnique({
        where: { id: poId },
      }),
      prisma.document.findUnique({
        where: { id: invoiceId },
        include: { lineItems: true },
      }),
      getTotalReceivedQuantity(poId),
    ]);

  if (!po || !invoice) {
    const record =
      await prisma.threeWayMatch.upsert({
        where: {
          poId_invoiceId: { poId, invoiceId },
        },
        create: {
          poId,
          invoiceId,
          status: "PENDING",
        },
        update: { status: "PENDING" },
      });

    return {
      status: record.status,
      variance: record.variance,
      poAmount: null,
      invoiceAmount: null,
      poQuantity: null,
      receivedQuantity: null,
      invoicedQuantity: null,
      paymentBlocked: false,
    };
  }

  const poAmount = po.amount;
  const invoiceAmount =
    invoice.totalAmount ?? null;
  const poQuantity =
    po.orderedQuantity ?? null;
  const invoicedQuantity =
    sumInvoiceQuantity(invoice.lineItems);

  if (
    invoiceAmount == null ||
    poQuantity == null ||
    poQuantity <= 0
  ) {
    const record =
      await prisma.threeWayMatch.upsert({
        where: {
          poId_invoiceId: { poId, invoiceId },
        },
        create: {
          poId,
          invoiceId,
          status: "PENDING",
          poAmount,
          invoiceAmount,
          poQuantity,
          receivedQuantity,
          invoicedQuantity,
        },
        update: {
          status: "PENDING",
          poAmount,
          invoiceAmount,
          poQuantity,
          receivedQuantity,
          invoicedQuantity,
        },
      });

    return {
      status: record.status,
      variance: record.variance,
      poAmount,
      invoiceAmount,
      poQuantity,
      receivedQuantity,
      invoicedQuantity,
      paymentBlocked: false,
    };
  }

  const { variance, withinTolerance } =
    calculateAmountVariance(
      poAmount,
      invoiceAmount
    );

  const amountMatch = withinTolerance;
  const quantityMatch =
    invoicedQuantity <= poQuantity &&
    invoicedQuantity <= receivedQuantity &&
    receivedQuantity > 0;

  const status =
    amountMatch && quantityMatch
      ? "MATCHED"
      : "MISMATCH";

  const record =
    await prisma.threeWayMatch.upsert({
      where: {
        poId_invoiceId: { poId, invoiceId },
      },
      create: {
        poId,
        invoiceId,
        status,
        variance,
        poAmount,
        invoiceAmount,
        poQuantity,
        receivedQuantity,
        invoicedQuantity,
      },
      update: {
        status,
        variance,
        poAmount,
        invoiceAmount,
        poQuantity,
        receivedQuantity,
        invoicedQuantity,
      },
    });

  await recordAuditLog(
    "ThreeWayMatch",
    record.id,
    `THREE_WAY_MATCH_${status}`,
    "System",
    {
      newValue: {
        status,
        variance,
        poAmount,
        invoiceAmount,
        poQuantity,
        receivedQuantity,
        invoicedQuantity,
      },
      metadata: {
        poId,
        invoiceId,
        poNumber: po.poNumber,
        paymentBlocked:
          status === "MISMATCH",
      },
    }
  );

  return {
    status: record.status,
    variance: record.variance,
    poAmount,
    invoiceAmount,
    poQuantity,
    receivedQuantity,
    invoicedQuantity,
    paymentBlocked: status === "MISMATCH",
  };
}

export async function getThreeWayMatchForInvoice(
  invoiceId: number
) {
  return prisma.threeWayMatch.findFirst({
    where: { invoiceId },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          amount: true,
          status: true,
          orderedQuantity: true,
        },
      },
    },
  });
}

/* --- PAYMENT GUARDS --- */

export async function assertPaymentAllowed(
  documentId: number
) {
  await assertInvoiceNotBlocked(documentId);

  const match =
    await getThreeWayMatchForInvoice(
      documentId
    );

  if (!match) {
    throw new Error(
      "Payment blocked: no three-way match on file"
    );
  }

  if (
    isPaymentBlocked(match.status)
  ) {
    throw new Error(
      "Payment blocked: three-way match MISMATCH"
    );
  }

  if (
    normalizeMatchStatus(
      match.status
    ) !== "MATCHED"
  ) {
    throw new Error(
      "Payment blocked: three-way match not MATCHED"
    );
  }
}

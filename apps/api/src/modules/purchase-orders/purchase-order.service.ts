import prisma from "../../db";
import { notDeleted } from "../../lib/softDelete";
import {
  type AuditActorContext,
  recordAuditLog,
} from "../../lib/audit";
import { notifyPoSent } from "../../services/notificationService";
import { recordPOSavings } from "../../services/savingsEngine";
import {
  assertPOTransition,
  PO_AUDIT_ACTIONS,
} from "./poLifecycle";
import { performThreeWayMatch } from "../../services/threeWayMatch";
import { schedulePaymentIfMatched } from "../../services/paymentEngine";
import type {
  MatchInvoiceResult,
  PoMatchResult,
  ThreeWayMatchResult,
  VarianceResult,
} from "./purchase-order.types";

export function calculateVariance(
  poAmount: number,
  invoiceAmount: number
): VarianceResult {
  const variance =
    invoiceAmount - poAmount;

  const variancePercent =
    poAmount !== 0
      ? (variance / poAmount) * 100
      : 0;

  return {
    variance,
    variancePercent,
    withinTolerance:
      Math.abs(variancePercent) <= 5,
  };
}

function riskLevelFromVariance(
  variancePercent: number
): PoMatchResult["riskLevel"] {
  const abs = Math.abs(variancePercent);

  if (abs <= 5) {
    return "PASS";
  }

  if (abs <= 15) {
    return "REVIEW";
  }

  return "HIGH_RISK";
}

export async function generatePoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;

  const count =
    await prisma.purchaseOrder.count({
      where: {
        poNumber: { startsWith: prefix },
      },
    });

  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function generatePOFromRequest(
  requestId: number,
  actor: string
) {
  const request =
    await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      include: { spendCategory: true },
    });

  if (!request) {
    throw new Error("Request not found");
  }

  if (
    request.status !== "APPROVED" &&
    request.status !== "CONVERTED_TO_PO"
  ) {
    throw new Error(
      "Only approved requests can generate a PO"
    );
  }

  const existing =
    await prisma.purchaseOrder.findFirst({
      where: { requestId },
    });

  if (existing) {
    return existing;
  }

  const poNumber =
    await generatePoNumber();

  const po =
    await prisma.purchaseOrder.create({
      data: {
        poNumber,
        vendorName:
          request.vendorName ?? "Unknown",
        requestId,
        amount: request.estimatedAmount,
        status: "DRAFT",
      },
      include: { request: true },
    });

  await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: "CONVERTED_TO_PO" },
  });

  await recordAuditLog(
    "PurchaseOrder",
    po.id,
    "PO Generated",
    actor,
    {
      newValue: {
        poNumber: po.poNumber,
        requestId,
      },
    }
  );

  await recordPOSavings(
    po.id,
    request.estimatedAmount,
    po.amount,
    request.title,
    request.spendCategory?.name ??
      request.category
  );

  return po;
}

export async function listPOs() {
  return prisma.purchaseOrder.findMany({
    where: notDeleted,
    orderBy: { createdAt: "desc" },
    include: {
      request: {
        select: { id: true, title: true },
      },
      rfq: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });
}

export async function getPO(id: number) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      request: true,
      rfq: {
        select: {
          id: true,
          title: true,
          status: true,
          savings: {
            select: {
              savings: true,
            },
          },
        },
      },
      goodsReceipts: {
        orderBy: { receivedDate: "desc" },
        include: {
          receiver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          status: true,
        },
      },
    },
  });
}

async function updatePOStatus(
  poId: number,
  status:
    | "SENT"
    | "ACCEPTED"
    | "PARTIALLY_RECEIVED"
    | "RECEIVED"
    | "CLOSED",
  actor: string,
  actorContext?: AuditActorContext
) {
  const existing =
    await prisma.purchaseOrder.findUnique({
      where: { id: poId },
    });

  if (!existing) {
    throw new Error("Purchase order not found");
  }

  assertPOTransition(existing.status, status);

  const extra: {
    sentAt?: Date;
    acceptedAt?: Date;
    receivedAt?: Date;
    closedAt?: Date;
  } = {};

  const now = new Date();

  if (status === "SENT") {
    extra.sentAt = existing.sentAt ?? now;
  }

  if (status === "ACCEPTED") {
    extra.acceptedAt = existing.acceptedAt ?? now;
  }

  if (
    status === "RECEIVED" ||
    status === "PARTIALLY_RECEIVED"
  ) {
    if (status === "RECEIVED") {
      extra.receivedAt =
        existing.receivedAt ?? now;
    }
  }

  if (status === "CLOSED") {
    extra.closedAt = existing.closedAt ?? now;
  }

  const po =
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status, ...extra },
      include: {
        request: true,
        rfq: {
          select: { id: true, title: true },
        },
      },
    });

  const auditAction =
    PO_AUDIT_ACTIONS[status] ??
    `PO_${status}`;

  await recordAuditLog(
    "PurchaseOrder",
    po.id,
    auditAction,
    actor,
    {
      oldValue: {
        status: existing.status,
      },
      newValue: {
        status: po.status,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        amount: po.amount,
      },
      metadata: {
        vendorName: po.vendorName,
        poNumber: po.poNumber,
      },
      actorContext,
    }
  );

  if (status === "SENT") {
    void notifyPoSent(
      {
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        amount: po.amount,
      },
      actor
    ).catch(console.error);
  }

  return po;
}

export function sendPO(
  poId: number,
  actor: string,
  actorContext?: AuditActorContext
) {
  return updatePOStatus(
    poId,
    "SENT",
    actor,
    actorContext
  );
}

export function markAccepted(
  poId: number,
  actor: string
) {
  return updatePOStatus(
    poId,
    "ACCEPTED",
    actor
  );
}

export function markReceived(
  poId: number,
  actor: string
) {
  return updatePOStatus(
    poId,
    "RECEIVED",
    actor
  );
}

export function closePO(
  poId: number,
  actor: string
) {
  return updatePOStatus(
    poId,
    "CLOSED",
    actor
  );
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
      await linkInvoiceToPO(
        documentId,
        po.id,
        poNumber,
        98,
        "System"
      );

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
        await linkInvoiceToPO(
          documentId,
          po.id,
          po.poNumber,
          85,
          "System"
        );

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

async function linkInvoiceToPO(
  documentId: number,
  poId: number,
  poNumber: string,
  confidence: number,
  actor: string
) {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      purchaseOrderId: poId,
      matchedPoNumber: poNumber,
      poMatchConfidence: confidence,
    },
  });

  await recordAuditLog(
    "Document",
    documentId,
    "Invoice Matched to PO",
    actor,
    {
      newValue: { poId, poNumber, confidence },
    }
  );

  await performThreeWayMatch(poId, documentId);
  await schedulePaymentIfMatched(documentId);
}

export async function matchInvoice(
  documentId: number
): Promise<MatchInvoiceResult> {
  const document =
    await prisma.document.findUnique({
      where: { id: documentId },
      include: { purchaseOrder: true },
    });

  if (
    !document ||
    !document.purchaseOrder ||
    document.totalAmount == null
  ) {
    return {
      matched: false,
      poMatch: null,
    };
  }

  const po = document.purchaseOrder;
  const calc = calculateVariance(
    po.amount,
    document.totalAmount
  );

  const poMatch: PoMatchResult = {
    poNumber: po.poNumber,
    poAmount: po.amount,
    invoiceAmount: document.totalAmount,
    variance: calc.variance,
    variancePercent: calc.variancePercent,
    withinTolerance:
      calc.withinTolerance,
    riskLevel: riskLevelFromVariance(
      calc.variancePercent
    ),
    matchConfidence:
      document.poMatchConfidence ??
      undefined,
  };

  return {
    matched: true,
    poMatch,
  };
}

export {
  getThreeWayMatchForInvoice,
  performThreeWayMatch,
} from "../../services/threeWayMatch";

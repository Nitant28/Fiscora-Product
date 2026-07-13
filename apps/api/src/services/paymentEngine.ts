/**
 * Domain: Accounts payable — payment scheduling, lifecycle (scheduled→paid), MSME caps, and treasury metrics.
 * Main exports: parseInvoiceDate, computePaymentDueDate, createScheduledPayment, schedulePaymentIfMatched,
 *   getPaymentById, markPaymentReady, startPaymentProcessing, markPaymentPaid, listPayments,
 *   getCashFlowForecast, getVendorPaymentPerformance, getMsmePaymentAlerts, getPaymentsCompletedThisMonth
 *   (plus paymentTerms re-exports).
 * Called by: server.ts, purchase-order.service.ts, purchase-order.controller.ts, payment.controller.ts, controlTower.ts.
 */
import prisma from "../db";
import { notDeleted } from "../lib/softDelete";
import {
  type AuditActorContext,
  recordAuditLog,
} from "../lib/audit";
import { recordBudgetSpend } from "./budgetEngine";
import {
  assertPaymentAllowed,
  getThreeWayMatchForInvoice,
  normalizeMatchStatus,
} from "./threeWayMatch";
import type { Document, Payment, Vendor } from "@prisma/client";
import {
  DEFAULT_PAYMENT_TERMS_DAYS,
  PAYMENT_TERM_OPTIONS,
  calculateDueDate,
  formatPaymentTermsLabel,
  isValidPaymentTermsDays,
  resolvePaymentTermsDays,
} from "./paymentTerms";
import {
  notifyPaymentCompleted,
  notifyPaymentDue,
} from "./notificationService";
import { getCashForecast } from "./cfoDashboard";
import { generatePaymentNumber } from "../integrations/tally/tallyDataCleanup";

const MSME_PAYMENT_DEADLINE_DAYS = 45;

export {
  DEFAULT_PAYMENT_TERMS_DAYS,
  PAYMENT_TERM_OPTIONS,
  calculateDueDate,
  formatPaymentTermsLabel,
  isValidPaymentTermsDays,
  resolvePaymentTermsDays,
} from "./paymentTerms";

/* --- DUE DATE --- */

export function parseInvoiceDate(
  document: Pick<Document, "invoiceDate" | "createdAt">
): Date {
  const fallback = document.createdAt;

  if (document.invoiceDate) {
    const parsed = new Date(document.invoiceDate);
    if (!Number.isNaN(parsed.getTime())) {
      const minValid = new Date("2020-01-01T00:00:00.000Z");
      const maxPastMs = 30 * 24 * 60 * 60 * 1000;
      const tooOld =
        parsed.getTime() < fallback.getTime() - maxPastMs ||
        parsed.getTime() < minValid.getTime();

      if (!tooOld) {
        return parsed;
      }
    }
  }

  return fallback;
}

export function computePaymentDueDate(
  vendor: Pick<
    Vendor,
    | "paymentTermsDays"
    | "paymentTerms"
    | "msmeRegistered"
  >,
  document: Pick<
    Document,
    "invoiceDate" | "createdAt"
  >,
  approvalDate?: Date | null
) {
  const termsDays =
    resolvePaymentTermsDays(vendor);
  const invoiceDate =
    parseInvoiceDate(document);
  let dueDate = calculateDueDate(
    invoiceDate,
    termsDays
  );
  let msmeCapped = false;

  if (
    vendor.msmeRegistered &&
    approvalDate
  ) {
    const msmeDeadline = new Date(
      approvalDate
    );
    msmeDeadline.setDate(
      msmeDeadline.getDate() +
        MSME_PAYMENT_DEADLINE_DAYS
    );

    if (
      dueDate.getTime() >
      msmeDeadline.getTime()
    ) {
      dueDate = msmeDeadline;
      msmeCapped = true;
    }
  }

  const termsLabel =
    vendor.paymentTerms ??
    formatPaymentTermsLabel(termsDays);

  return {
    dueDate,
    termsDays,
    termsLabel,
    msmeCapped,
    invoiceDate,
  };
}

export async function getInvoiceApprovalDate(
  documentId: number
): Promise<Date | null> {
  const approval = await prisma.approvalHistory.findFirst({
    where: {
      documentId,
      action: "APPROVE",
    },
    orderBy: { createdAt: "asc" },
  });

  return approval?.createdAt ?? null;
}

/* --- SCHEDULING --- */

export async function createScheduledPayment(
  documentId: number,
  actor = "System"
): Promise<Payment> {
  const existing = await prisma.payment.findUnique({
    where: { documentId },
  });

  if (existing) {
    return existing;
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      vendor: true,
      purchaseOrder: {
        include: {
          request: {
            select: { id: true, departmentId: true },
          },
        },
      },
    },
  });

  if (!document) {
    throw new Error("Invoice not found");
  }

  if (document.status !== "approved") {
    throw new Error(
      "Payment can only be scheduled for approved invoices"
    );
  }

  await assertPaymentAllowed(documentId);

  let vendorId = document.vendorId;
  let vendor = document.vendor;

  if (!vendorId && document.vendorName) {
    const matched = await prisma.vendor.findFirst({
      where: {
        name: {
          equals: document.vendorName,
          mode: "insensitive",
        },
      },
    });

    if (matched) {
      vendorId = matched.id;
      vendor = matched;
    }
  }

  if (!vendorId || !vendor) {
    throw new Error(
      "Invoice must be linked to a vendor before scheduling payment"
    );
  }

  const amount = document.totalAmount ?? 0;

  if (amount <= 0) {
    throw new Error(
      "Invoice amount is required to schedule payment"
    );
  }

  const termsDays = resolvePaymentTermsDays(vendor);
  const approvalDate =
    await getInvoiceApprovalDate(documentId);
  const { dueDate, msmeCapped } =
    computePaymentDueDate(
      vendor,
      document,
      approvalDate
    );

  const payment = await prisma.payment.create({
    data: {
      vendorId,
      documentId,
      amount,
      dueDate,
      status: "SCHEDULED",
    },
    include: {
      vendor: true,
      document: {
        select: {
          id: true,
          invoiceNumber: true,
          vendorName: true,
          status: true,
        },
      },
    },
  });

  const paymentNumber = await generatePaymentNumber(payment.id);

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentNumber,
      currency: "INR",
      approvalStatus: "PENDING",
    } as Parameters<typeof prisma.payment.update>[0]["data"],
  });

  await recordAuditLog(
    "Payment",
    payment.id,
    "PAYMENT_SCHEDULED",
    actor,
    {
      newValue: {
        documentId,
        amount,
        dueDate: dueDate.toISOString(),
        paymentTermsDays: termsDays,
        msmeCapped,
        status: "SCHEDULED",
      },
      metadata: {
        vendorId,
        vendorName: vendor.name,
      },
    }
  );

  void notifyPaymentDue({
    id: payment.id,
    amount: payment.amount,
    dueDate: payment.dueDate,
    vendorName: vendor.name,
    invoiceNumber:
      document.invoiceNumber ?? `INV-${document.id}`,
  }).catch(console.error);

  return payment;
}

export async function schedulePaymentIfMatched(
  documentId: number,
  actor = "System"
) {
  const match =
    await getThreeWayMatchForInvoice(
      documentId
    );

  if (
    !match ||
    normalizeMatchStatus(
      match.status
    ) !== "MATCHED"
  ) {
    return null;
  }

  try {
    return await createScheduledPayment(
      documentId,
      actor
    );
  } catch (paymentError) {
    const message =
      paymentError instanceof Error
        ? paymentError.message
        : "Payment scheduling failed";

    if (
      message.includes(
        "approved invoices"
      )
    ) {
      return null;
    }

    throw paymentError;
  }
}

export async function getPaymentById(
  paymentId: number
) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          paymentTermsDays: true,
          paymentTerms: true,
          msmeRegistered: true,
        },
      },
      document: {
        select: {
          id: true,
          invoiceNumber: true,
          vendorName: true,
          invoiceDate: true,
          totalAmount: true,
          status: true,
          purchaseOrderId: true,
        },
      },
    },
  });
}

/* --- PAYMENT LIFECYCLE --- */

export async function markPaymentReady(
  paymentId: number,
  actor = "System"
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.status !== "SCHEDULED") {
    throw new Error(
      `Cannot mark ready: payment is ${payment.status}`
    );
  }

  await assertPaymentAllowed(
    payment.documentId
  );

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "READY" },
    include: {
      vendor: true,
      document: {
        select: {
          id: true,
          invoiceNumber: true,
          vendorName: true,
          status: true,
        },
      },
    },
  });

  await recordAuditLog(
    "Payment",
    paymentId,
    "PAYMENT_READY",
    actor,
    {
      newValue: { status: "READY" },
      metadata: {
        documentId: payment.documentId,
      },
    }
  );

  return updated;
}

export async function startPaymentProcessing(
  paymentId: number,
  actor = "System"
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.status !== "READY") {
    throw new Error(
      `Cannot start processing: payment is ${payment.status}`
    );
  }

  await assertPaymentAllowed(
    payment.documentId
  );

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "PROCESSING" },
    include: {
      vendor: true,
      document: {
        select: {
          id: true,
          invoiceNumber: true,
          vendorName: true,
          status: true,
        },
      },
    },
  });

  await recordAuditLog(
    "Payment",
    paymentId,
    "PAYMENT_PROCESSING",
    actor,
    {
      newValue: { status: "PROCESSING" },
      metadata: {
        documentId: payment.documentId,
      },
    }
  );

  return updated;
}

export async function markPaymentPaid(
  paymentId: number,
  actor = "System",
  actorContext?: AuditActorContext
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      document: {
        include: {
          purchaseOrder: {
            include: {
              request: {
                select: {
                  id: true,
                  departmentId: true,
                  estimatedAmount: true,
                },
              },
            },
          },
        },
      },
      vendor: true,
    },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.status === "PAID") {
    return payment;
  }

  if (payment.status !== "PROCESSING") {
    throw new Error(
      `Cannot mark paid: payment is ${payment.status}. Must be PROCESSING first.`
    );
  }

  await assertPaymentAllowed(
    payment.documentId
  );

  const paidDate = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const paid = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        paidDate,
      },
      include: {
        vendor: true,
        document: {
          select: {
            id: true,
            invoiceNumber: true,
            vendorName: true,
            status: true,
          },
        },
      },
    });

    if (payment.document.status !== "paid") {
      await tx.document.update({
        where: { id: payment.documentId },
        data: { status: "paid" },
      });

      await tx.invoiceAction.create({
        data: {
          documentId: payment.documentId,
          action: "MARK_PAID",
          actorName: actor,
        },
      });

      await tx.approvalHistory.create({
        data: {
          documentId: payment.documentId,
          action: "MARK_PAID",
          user: actor,
        },
      });
    }

    return paid;
  });

  const deptId =
    payment.document.purchaseOrder?.request
      ?.departmentId;

  if (deptId && payment.amount > 0) {
    await recordBudgetSpend(
      deptId,
      payment.amount,
      actor,
      {
        invoiceId: payment.documentId,
        paymentId,
        requestId:
          payment.document.purchaseOrder?.request
            ?.id,
      }
    );
  }

  await recordAuditLog(
    "Payment",
    paymentId,
    "PAYMENT_COMPLETED",
    actor,
    {
      newValue: {
        status: "PAID",
        paidDate: paidDate.toISOString(),
      },
      metadata: {
        documentId: payment.documentId,
        vendorName: payment.vendor.name,
        amount: payment.amount,
      },
      actorContext,
    }
  );

  void notifyPaymentCompleted(
    {
      id: updated.id,
      amount: updated.amount,
      vendorName: updated.vendor.name,
      invoiceNumber:
        updated.document.invoiceNumber ??
        `INV-${updated.document.id}`,
    },
    actor
  ).catch(console.error);

  return updated;
}

/* --- QUERIES & METRICS --- */

export async function listPayments(filters?: {
  status?: string;
  vendorId?: number;
}) {
  return prisma.payment.findMany({
    where: {
      ...notDeleted,
      ...(filters?.status
        ? { status: filters.status as any }
        : {}),
      ...(filters?.vendorId
        ? { vendorId: filters.vendorId }
        : {}),
    },
    orderBy: { dueDate: "asc" },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          paymentTermsDays: true,
          msmeRegistered: true,
        },
      },
      document: {
        select: {
          id: true,
          invoiceNumber: true,
          vendorName: true,
          invoiceDate: true,
          status: true,
        },
      },
    },
  });
}

export async function getCashFlowForecast() {
  const forecast = await getCashForecast();

  return {
    next7Days: forecast.sevenDayOutflow,
    next30Days: forecast.thirtyDayOutflow,
    next90Days: forecast.ninetyDayOutflow,
    asOf: forecast.asOf,
  };
}

export async function getVendorPaymentPerformance(
  vendorId?: number
) {
  const payments = await prisma.payment.findMany({
    where: {
      status: "PAID",
      paidDate: { not: null },
      ...(vendorId ? { vendorId } : {}),
    },
    include: {
      vendor: {
        select: { id: true, name: true },
      },
    },
  });

  const byVendor = new Map<
    number,
    {
      vendorId: number;
      vendorName: string;
      totalPaid: number;
      paymentCount: number;
      totalDaysToPay: number;
    }
  >();

  for (const payment of payments) {
    if (!payment.paidDate) continue;

    const approvalDate =
      await getInvoiceApprovalDate(
        payment.documentId
      );

    if (!approvalDate) continue;

    const daysToPay = Math.max(
      0,
      Math.round(
        (payment.paidDate.getTime() -
          approvalDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    const entry =
      byVendor.get(payment.vendorId) ?? {
        vendorId: payment.vendorId,
        vendorName: payment.vendor.name,
        totalPaid: 0,
        paymentCount: 0,
        totalDaysToPay: 0,
      };

    entry.totalPaid += payment.amount;
    entry.paymentCount += 1;
    entry.totalDaysToPay += daysToPay;
    byVendor.set(payment.vendorId, entry);
  }

  return Array.from(byVendor.values()).map(
    (v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      paymentCount: v.paymentCount,
      totalPaid: v.totalPaid,
      averageDaysToPay:
        v.paymentCount > 0
          ? Math.round(
              v.totalDaysToPay /
                v.paymentCount
            )
          : null,
    })
  );
}

export async function getMsmePaymentAlerts() {
  const pending = await prisma.payment.findMany({
    where: {
      status: {
        in: [
          "SCHEDULED",
          "READY",
          "PROCESSING",
        ],
      },
      vendor: { msmeRegistered: true },
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          msmeRegistered: true,
        },
      },
      document: {
        select: {
          id: true,
          invoiceNumber: true,
        },
      },
    },
  });

  const now = Date.now();
  const alerts = [];

  for (const payment of pending) {
    const approvalDate =
      await getInvoiceApprovalDate(
        payment.documentId
      );

    const referenceDate =
      approvalDate ?? payment.createdAt;
    const daysSinceApproval = Math.floor(
      (now - referenceDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const overdueByTerms =
      payment.dueDate.getTime() < now;
    const msmeDeadlineBreached =
      daysSinceApproval >
      MSME_PAYMENT_DEADLINE_DAYS;

    if (
      overdueByTerms ||
      msmeDeadlineBreached
    ) {
      alerts.push({
        paymentId: payment.id,
        documentId: payment.documentId,
        invoiceNumber:
          payment.document.invoiceNumber,
        vendorId: payment.vendorId,
        vendorName: payment.vendor.name,
        amount: payment.amount,
        dueDate: payment.dueDate,
        daysSinceApproval,
        msmeDeadlineDays:
          MSME_PAYMENT_DEADLINE_DAYS,
        risk:
          msmeDeadlineBreached
            ? "MSME Payment Risk"
            : "Payment Overdue",
      });
    }
  }

  return alerts;
}

export async function getPaymentsCompletedThisMonth() {
  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const result = await prisma.payment.aggregate({
    where: {
      status: "PAID",
      paidDate: { gte: monthStart },
    },
    _sum: { amount: true },
    _count: true,
  });

  return {
    totalAmount: result._sum.amount ?? 0,
    count: result._count,
  };
}

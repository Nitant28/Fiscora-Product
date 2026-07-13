/**
 * Phase 16.5 — Maverick spend (strict policy violations).
 */
import prisma from "../db";
import { spendInvoiceWhere } from "./spendAnalytics";

export async function getMaverickSpend() {
  const totalAgg = await prisma.document.aggregate({
    where: spendInvoiceWhere,
    _sum: { totalAmount: true },
  });
  const totalSpend = totalAgg._sum.totalAmount ?? 0;

  const invoices = await prisma.document.findMany({
    where: {
      ...spendInvoiceWhere,
      totalAmount: { gt: 0 },
    },
    select: {
      id: true,
      totalAmount: true,
      vendorName: true,
      purchaseOrderId: true,
      status: true,
      approvalHistory: {
        select: { action: true },
      },
      flags: {
        where: { resolved: false },
        select: { type: true, message: true },
      },
      vendor: {
        select: { preferredVendor: true, name: true },
      },
      purchaseOrder: {
        select: {
          request: {
            select: { status: true },
          },
        },
      },
    },
  });

  const maverickRows: {
    id: number;
    vendorName: string;
    amount: number;
    reasons: string[];
  }[] = [];

  let maverickAmount = 0;

  for (const inv of invoices) {
    const reasons: string[] = [];
    const amount = inv.totalAmount ?? 0;

    if (!inv.purchaseOrderId) {
      reasons.push("No PO");
    }

    const hasApproval = inv.approvalHistory.some(
      (h) =>
        h.action === "APPROVE" ||
        h.action === "approved" ||
        h.action.toLowerCase().includes("approve")
    );
    if (!hasApproval) {
      reasons.push("No approval");
    }

    if (inv.vendor && !inv.vendor.preferredVendor) {
      reasons.push("Non-preferred vendor");
    }

    const budgetViolation =
      inv.purchaseOrder?.request?.status === "BUDGET_EXCEEDED" ||
      inv.flags.some(
        (f) =>
          f.type.toLowerCase().includes("budget") ||
          f.message.toLowerCase().includes("budget")
      );
    if (budgetViolation) {
      reasons.push("Budget violation");
    }

    if (reasons.length > 0) {
      maverickAmount += amount;
      maverickRows.push({
        id: inv.id,
        vendorName: inv.vendorName ?? inv.vendor?.name ?? "Unknown",
        amount: Math.round(amount),
        reasons,
      });
    }
  }

  const maverickPercent =
    totalSpend > 0 ? (maverickAmount / totalSpend) * 100 : null;

  return {
    maverickSpend: Math.round(maverickAmount),
    maverickPercent:
      maverickPercent != null
        ? Math.min(100, Math.round(maverickPercent * 10) / 10)
        : null,
    totalSpend: Math.round(totalSpend),
    count: maverickRows.length,
    topCases: maverickRows
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    hasEnoughData: totalSpend > 0,
  };
}

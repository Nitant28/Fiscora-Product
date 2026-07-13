/**
 * Phase 16.5 — Spend analytics (SQL-aligned, no approximations).
 */
import prisma, { prismaRaw } from "../db";
import { notDeleted } from "../lib/softDelete";

export const SPEND_INVOICE_STATUSES = ["approved", "paid"] as const;

export const spendInvoiceWhere = {
  ...notDeleted,
  status: { in: [...SPEND_INVOICE_STATUSES] },
  totalAmount: { not: null },
} as const;

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

export async function getSpendAnalytics() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const baseWhere = spendInvoiceWhere;

  const [totalAgg, monthAgg, ytdAgg, invoiceCount, poAgg, poCount] =
    await Promise.all([
      prisma.document.aggregate({
        where: baseWhere,
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
        _count: true,
      }),
      prisma.document.aggregate({
        where: { ...baseWhere, createdAt: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      prisma.document.aggregate({
        where: { ...baseWhere, createdAt: { gte: yearStart } },
        _sum: { totalAmount: true },
      }),
      prisma.document.count({ where: baseWhere }),
      prisma.purchaseOrder.aggregate({
        where: { ...notDeleted, amount: { gt: 0 } },
        _avg: { amount: true },
        _sum: { amount: true },
      }),
      prisma.purchaseOrder.count({
        where: { ...notDeleted, amount: { gt: 0 } },
      }),
    ]);

  const totalSpend = totalAgg._sum.totalAmount ?? 0;
  const monthlySpend = monthAgg._sum.totalAmount ?? 0;
  const ytdSpend = ytdAgg._sum.totalAmount ?? 0;
  const averageInvoice =
    invoiceCount > 0 ? totalSpend / invoiceCount : null;
  const averagePO =
    poCount > 0 ? (poAgg._sum.amount ?? 0) / poCount : null;

  const vendorGrouped = await prisma.document.groupBy({
    by: ["vendorName"],
    where: baseWhere,
    _sum: { totalAmount: true },
  });

  const spendByVendor = vendorGrouped
    .map((row) => ({
      vendor: row.vendorName ?? "Unknown",
      spend: Math.round(row._sum.totalAmount ?? 0),
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  const deptRows = await prismaRaw.$queryRaw<
    { department: string; spend: number }[]
  >`
    SELECT COALESCE(d.name, 'Unassigned') AS department,
           COALESCE(SUM(doc."totalAmount"), 0)::float AS spend
    FROM "Document" doc
    LEFT JOIN "PurchaseOrder" po ON po.id = doc."purchaseOrderId"
    LEFT JOIN "PurchaseRequest" pr ON pr.id = po."requestId"
    LEFT JOIN "Department" d ON d.id = pr."departmentId"
    WHERE doc."deletedAt" IS NULL
      AND doc.status IN ('approved', 'paid')
      AND doc."totalAmount" IS NOT NULL
    GROUP BY d.name
    ORDER BY spend DESC
  `;

  const spendByDepartment = deptRows.map((row) => ({
    department: row.department,
    spend: Math.round(Number(row.spend)),
  }));

  const trendRows = await prismaRaw.$queryRaw<
    { month: string; spend: number }[]
  >`
    SELECT TO_CHAR(doc."createdAt", 'YYYY-MM') AS month,
           COALESCE(SUM(doc."totalAmount"), 0)::float AS spend
    FROM "Document" doc
    WHERE doc."deletedAt" IS NULL
      AND doc.status IN ('approved', 'paid')
      AND doc."totalAmount" IS NOT NULL
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 12
  `;

  const monthlyTrend = [...trendRows]
    .reverse()
    .map((row) => ({
      month: row.month,
      spend: Math.round(Number(row.spend)),
    }));

  return {
    totalSpend: Math.round(totalSpend),
    monthlySpend: Math.round(monthlySpend),
    ytdSpend: Math.round(ytdSpend),
    averageInvoice:
      averageInvoice != null ? Math.round(averageInvoice) : null,
    averagePO: averagePO != null ? Math.round(averagePO) : null,
    spendByVendor,
    spendByDepartment,
    monthlyTrend,
    invoiceCount,
    poCount,
    hasEnoughInvoiceData: invoiceCount > 0,
    hasEnoughPoData: poCount > 0,
  };
}

/**
 * Domain: PO savings — benchmark-backed savings records and executive savings metrics.
 * Main exports: recordPOSavings, getSavingsThisMonth, getTotalSavings, getSavingsRateMetrics, listRecentSavings
 *   (re-exports savingsRealized, savingsRate from budgetEngine).
 * Called by: purchase-order.service.ts, executiveAnalytics.ts, controlTower.ts.
 */
import prisma from "../db";
import { getItemBenchmark } from "../procurement/benchmark";
import {
  savingsRealized,
  savingsRate,
} from "./budgetEngine";

export async function recordPOSavings(
  purchaseOrderId: number,
  requestedPrice: number,
  negotiatedPrice: number,
  itemDescription: string,
  categoryName?: string | null
) {
  let marketBenchmark: number | null = null;

  const benchmark = await getItemBenchmark(
    itemDescription,
    categoryName ?? undefined
  );

  if (benchmark) {
    marketBenchmark = benchmark.averageRate;
  }

  const savings = savingsRealized(
    requestedPrice,
    negotiatedPrice
  );

  return prisma.savings.upsert({
    where: { purchaseOrderId },
    create: {
      purchaseOrderId,
      requestedPrice,
      negotiatedPrice,
      marketBenchmark,
      savings,
    },
    update: {
      requestedPrice,
      negotiatedPrice,
      marketBenchmark,
      savings,
    },
  });
}

/* --- METRICS --- */

export async function getSavingsThisMonth() {
  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const rows = await prisma.savings.findMany({
    where: {
      createdAt: { gte: monthStart },
      savings: { gt: 0 },
    },
    select: { savings: true },
  });

  return rows.reduce(
    (sum, r) => sum + r.savings,
    0
  );
}

export async function getTotalSavings() {
  const result =
    await prisma.savings.aggregate({
      _sum: { savings: true },
      where: { savings: { gt: 0 } },
    });

  return result._sum.savings ?? 0;
}

export async function getSavingsRateMetrics() {
  const totalSavings =
    await getTotalSavings();

  const spendResult =
    await prisma.document.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: { in: ["approved", "paid"] },
        totalAmount: { not: null },
      },
    });

  const totalSpend =
    spendResult._sum.totalAmount ?? 0;

  return {
    totalSavings,
    totalSpend,
    savingsRate: savingsRate(
      totalSavings,
      totalSpend
    ),
  };
}

export async function listRecentSavings(limit = 10) {
  return prisma.savings.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      purchaseOrder: {
        select: {
          poNumber: true,
          vendorName: true,
        },
      },
    },
  });
}

export { savingsRealized, savingsRate };

/**
 * Domain: CFO treasury — cash outflow forecast, upcoming payments, vendor outflow, payment status mix.
 * Main exports: getCashForecast, getUpcomingPayments, getVendorOutflowBreakdown, getPaymentStatusMix, getCfoDashboardData.
 * Called by: modules/analytics/analytics.routes.ts, controlTower.ts; scripts/verify-cfo-dashboard.ts, verify-dashboard-data-quality.ts.
 */
import prisma from "../db";

const UNPAID_STATUSES = [
  "SCHEDULED",
  "READY",
  "PROCESSING",
] as const;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysRemaining(
  dueDate: Date,
  asOf: Date
): number {
  return Math.ceil(
    (dueDate.getTime() - asOf.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function sumAmountBeforeDeadline(
  payments: { amount: number; dueDate: Date }[],
  deadline: Date
): number {
  return payments
    .filter((payment) => payment.dueDate <= deadline)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

async function getUnpaidPayments(asOf = new Date()) {
  const in90 = addDays(asOf, 90);
  const recentOverdueCutoff = addDays(asOf, -30);

  return prisma.payment.findMany({
    where: {
      status: { in: [...UNPAID_STATUSES] },
      dueDate: {
        gte: recentOverdueCutoff,
        lte: in90,
      },
    },
    include: {
      vendor: {
        select: { id: true, name: true },
      },
      document: {
        select: {
          id: true,
          invoiceNumber: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });
}

/* --- CASH FORECAST --- */

export async function getCashForecast(asOf = new Date()) {
  const in7 = addDays(asOf, 7);
  const in30 = addDays(asOf, 30);
  const in90 = addDays(asOf, 90);

  const unpaid = await getUnpaidPayments(asOf);

  return {
    sevenDayOutflow: sumAmountBeforeDeadline(
      unpaid,
      in7
    ),
    thirtyDayOutflow: sumAmountBeforeDeadline(
      unpaid,
      in30
    ),
    ninetyDayOutflow: sumAmountBeforeDeadline(
      unpaid,
      in90
    ),
    asOf: asOf.toISOString(),
  };
}

export async function getUpcomingPayments(asOf = new Date()) {
  const unpaid = await getUnpaidPayments(asOf);

  return unpaid.map((payment) => ({
    id: payment.id,
    vendorId: payment.vendorId,
    vendorName: payment.vendor.name,
    invoiceId: payment.document.id,
    invoiceNumber:
      payment.document.invoiceNumber ??
      `INV-${payment.document.id}`,
    amount: payment.amount,
    dueDate: payment.dueDate.toISOString(),
    daysRemaining: daysRemaining(
      payment.dueDate,
      asOf
    ),
    status: payment.status,
  }));
}

export async function getVendorOutflowBreakdown(
  asOf = new Date()
) {
  const unpaid = await getUnpaidPayments(asOf);

  const byVendor = new Map<
    number,
    {
      vendorId: number;
      vendorName: string;
      totalAmount: number;
      paymentCount: number;
    }
  >();

  for (const payment of unpaid) {
    const entry =
      byVendor.get(payment.vendorId) ?? {
        vendorId: payment.vendorId,
        vendorName: payment.vendor.name,
        totalAmount: 0,
        paymentCount: 0,
      };

    entry.totalAmount += payment.amount;
    entry.paymentCount += 1;
    byVendor.set(payment.vendorId, entry);
  }

  return Array.from(byVendor.values())
    .sort(
      (a, b) =>
        b.totalAmount - a.totalAmount
    )
    .map((entry) => ({
      vendorId: entry.vendorId,
      vendorName: entry.vendorName,
      totalAmount: entry.totalAmount,
      paymentCount: entry.paymentCount,
    }));
}

export async function getPaymentStatusMix() {
  const statuses = [
    "SCHEDULED",
    "READY",
    "PROCESSING",
    "PAID",
    "FAILED",
  ] as const;

  const groups = await prisma.payment.groupBy({
    by: ["status"],
    _sum: { amount: true },
    _count: { _all: true },
  });

  const byStatus = new Map(
    groups.map((group) => [
      group.status,
      {
        count: group._count._all,
        amount: group._sum.amount ?? 0,
      },
    ])
  );

  return statuses.map((status) => ({
    status,
    count: byStatus.get(status)?.count ?? 0,
    amount:
      byStatus.get(status)?.amount ?? 0,
  }));
}

/* --- DASHBOARD AGGREGATE --- */

export async function getCfoDashboardData(
  asOf = new Date()
) {
  const [
    cashForecast,
    upcomingPayments,
    topVendors,
    paymentStatusMix,
  ] = await Promise.all([
    getCashForecast(asOf),
    getUpcomingPayments(asOf),
    getVendorOutflowBreakdown(asOf),
    getPaymentStatusMix(),
  ]);

  return {
    ...cashForecast,
    upcomingPayments,
    topVendors,
    paymentStatusMix,
  };
}

/**
 * =============================================================================
 * SCRIPT: verify-cfo-dashboard.ts
 * LOCATION: scripts/
 * PURPOSE: Acceptance test for CFO dashboard cash-outflow totals — seeds demo
 *          payments and compares service output to raw SQL sums.
 *
 * WHAT IT DOES (4 phases):
 *   1. Remove prior CFO-DEMO-* documents and linked payments
 *   2. Seed 10 scheduled payments with staggered due dates
 *   3. Compare getCfoDashboardData / getCashForecast vs manual SQL totals
 *   4. Run acceptance checks; set exit code 1 if any fail
 *
 * RUN: npx tsx scripts/verify-cfo-dashboard.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";
import {
  getCashForecast,
  getCfoDashboardData,
} from "../apps/api/src/services/cfoDashboard";

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const DEMO_PREFIX = "CFO-DEMO-";

// Ten payments spread across 7/30/90-day windows for outflow testing
const DEMO_PAYMENTS = [
  { suffix: "01", vendor: "Dell", amount: 500000, dueInDays: 3 },
  { suffix: "02", vendor: "HP", amount: 350000, dueInDays: 5 },
  { suffix: "03", vendor: "Infosys", amount: 250000, dueInDays: 7 },
  { suffix: "04", vendor: "Dell", amount: 400000, dueInDays: 14 },
  { suffix: "05", vendor: "HP", amount: 300000, dueInDays: 22 },
  { suffix: "06", vendor: "Infosys", amount: 720000, dueInDays: 28 },
  { suffix: "07", vendor: "Infosys", amount: 450000, dueInDays: 45 },
  { suffix: "08", vendor: "Dell", amount: 310000, dueInDays: 60 },
  { suffix: "09", vendor: "HP", amount: 240000, dueInDays: 75 },
  { suffix: "10", vendor: "Dell", amount: 180000, dueInDays: 88 },
];

/* --- Cleanup: remove demo invoices and payments from prior runs --- */
async function cleanupDemoData() {
  const demoDocs = await prisma.document.findMany({
    where: {
      invoiceNumber: { startsWith: DEMO_PREFIX },
    },
    select: { id: true },
  });

  const docIds = demoDocs.map((doc) => doc.id);

  if (docIds.length > 0) {
    await prisma.payment.deleteMany({
      where: { documentId: { in: docIds } },
    });
    await prisma.invoiceAction.deleteMany({
      where: { documentId: { in: docIds } },
    });
    await prisma.approvalHistory.deleteMany({
      where: { documentId: { in: docIds } },
    });
    await prisma.invoiceFlag.deleteMany({
      where: { documentId: { in: docIds } },
    });
    await prisma.lineItem.deleteMany({
      where: { documentId: { in: docIds } },
    });
    await prisma.threeWayMatch.deleteMany({
      where: { invoiceId: { in: docIds } },
    });
    await prisma.document.deleteMany({
      where: { id: { in: docIds } },
    });
  }
}

/* --- Seed: create invoice + SCHEDULED payment per demo row --- */
async function seedDemoPayments(asOf: Date) {
  for (const item of DEMO_PAYMENTS) {
    const vendor = await prisma.vendor.findFirst({
      where: { name: item.vendor },
    });

    if (!vendor) {
      throw new Error(`Missing vendor: ${item.vendor}`);
    }

    const document = await prisma.document.create({
      data: {
        status: "approved",
        vendorName: vendor.name,
        vendorId: vendor.id,
        invoiceNumber: `${DEMO_PREFIX}${item.suffix}`,
        invoiceDate: asOf.toISOString().slice(0, 10),
        totalAmount: item.amount,
      },
    });

    await prisma.payment.create({
      data: {
        vendorId: vendor.id,
        documentId: document.id,
        amount: item.amount,
        dueDate: addDays(asOf, item.dueInDays),
        status: "SCHEDULED",
      },
    });
  }
}

/* --- Reference totals: sum unpaid payments due within 7/30/90 days --- */
async function rawSqlTotals(asOf: Date) {
  const in7 = addDays(asOf, 7);
  const in30 = addDays(asOf, 30);
  const in90 = addDays(asOf, 90);

  const unpaid = await prisma.payment.findMany({
    where: {
      status: {
        in: ["SCHEDULED", "READY", "PROCESSING"],
      },
      dueDate: { lte: in90 },
    },
    select: { amount: true, dueDate: true },
  });

  const sumBefore = (deadline: Date) =>
    unpaid
      .filter((payment) => payment.dueDate <= deadline)
      .reduce((sum, payment) => sum + payment.amount, 0);

  return {
    sevenDayOutflow: sumBefore(in7),
    thirtyDayOutflow: sumBefore(in30),
    ninetyDayOutflow: sumBefore(in90),
  };
}

async function main() {
  const asOf = new Date();

  /* =========================================================================
   * PHASE 1–2: Reset and seed demo payment data
   * ========================================================================= */
  await cleanupDemoData();
  await seedDemoPayments(asOf);

  /* =========================================================================
   * PHASE 3: Compare dashboard service vs forecast vs raw SQL
   * ========================================================================= */
  const [dashboard, forecast, sqlTotals] =
    await Promise.all([
      getCfoDashboardData(asOf),
      getCashForecast(asOf),
      rawSqlTotals(asOf),
    ]);

  /* =========================================================================
   * PHASE 4: Acceptance checks
   * ========================================================================= */
  const checks = [
    {
      label: "7-day dashboard vs SQL",
      pass:
        dashboard.sevenDayOutflow ===
        sqlTotals.sevenDayOutflow,
      dashboard: dashboard.sevenDayOutflow,
      sql: sqlTotals.sevenDayOutflow,
    },
    {
      label: "30-day dashboard vs SQL",
      pass:
        dashboard.thirtyDayOutflow ===
        sqlTotals.thirtyDayOutflow,
      dashboard: dashboard.thirtyDayOutflow,
      sql: sqlTotals.thirtyDayOutflow,
    },
    {
      label: "90-day dashboard vs SQL",
      pass:
        dashboard.ninetyDayOutflow ===
        sqlTotals.ninetyDayOutflow,
      dashboard: dashboard.ninetyDayOutflow,
      sql: sqlTotals.ninetyDayOutflow,
    },
    {
      label: "forecast matches dashboard",
      pass:
        forecast.sevenDayOutflow ===
          dashboard.sevenDayOutflow &&
        forecast.thirtyDayOutflow ===
          dashboard.thirtyDayOutflow &&
        forecast.ninetyDayOutflow ===
          dashboard.ninetyDayOutflow,
      dashboard: dashboard.thirtyDayOutflow,
      sql: forecast.thirtyDayOutflow,
    },
    {
      label: "10 demo payments loaded",
      pass:
        dashboard.upcomingPayments.filter(
          (payment) =>
            payment.invoiceNumber.startsWith(
              DEMO_PREFIX
            )
        ).length === 10,
      dashboard: dashboard.upcomingPayments.length,
      sql: 10,
    },
  ];

  console.log("CFO Dashboard totals:");
  console.log(
    JSON.stringify(
      {
        sevenDayOutflow:
          dashboard.sevenDayOutflow,
        thirtyDayOutflow:
          dashboard.thirtyDayOutflow,
        ninetyDayOutflow:
          dashboard.ninetyDayOutflow,
        topVendors: dashboard.topVendors.slice(
          0,
          3
        ),
      },
      null,
      2
    )
  );

  console.log("\nAcceptance checks:");
  for (const check of checks) {
    console.log(
      `${check.pass ? "PASS" : "FAIL"} — ${check.label} (dashboard=${check.dashboard}, expected=${check.sql})`
    );
  }

  const allPassed = checks.every(
    (check) => check.pass
  );

  if (!allPassed) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
/**
 * =============================================================================
 * SCRIPT: verify-dashboard-data-quality.ts
 * LOCATION: scripts/
 * PURPOSE: Acceptance test for dashboard data integrity after demo repairs —
 *          contracts, exposure, CFO payments, and vendor risk.
 *
 * WHAT IT DOES (2 phases):
 *   1. Run demo data repairs, then load contracts, exposure, CFO, vendor risk
 *   2. Assert utilization fields, non-zero exposure, sane payment dates, spend
 *
 * RUN: npx tsx scripts/verify-dashboard-data-quality.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";
import { getContractExposureSummary } from "../apps/api/src/services/contractUtilization";
import { listContracts } from "../apps/api/src/services/contracts";
import { getCfoDashboardData } from "../apps/api/src/services/cfoDashboard";
import { getVendorRiskAnalysis } from "../apps/api/src/services/vendorRisk";
import { runDemoDataRepairs } from "../apps/api/src/lib/seed";

async function main() {
  /* =========================================================================
   * PHASE 1: Repair seed data and load dashboard service outputs
   * ========================================================================= */
  await runDemoDataRepairs();

  const [
    contracts,
    exposure,
    cfo,
    vendorRisk,
  ] = await Promise.all([
    listContracts(),
    getContractExposureSummary(),
    getCfoDashboardData(),
    getVendorRiskAnalysis(),
  ]);

  /* =========================================================================
   * PHASE 2: Acceptance checks on dashboard data quality
   * ========================================================================= */
  const checks = [
    {
      label: "Contracts API returns utilization fields",
      pass:
        contracts.length === 0 ||
        contracts.every(
          (contract) =>
            typeof contract.utilized ===
              "number" &&
            typeof contract.remaining ===
              "number" &&
            typeof contract.utilizationPercent ===
              "number"
        ),
      actual: contracts[0],
      expected: "utilized/remaining/utilizationPercent",
    },
    {
      label: "Contract exposure totalValue > 0",
      pass: exposure.totalValue > 0,
      actual: exposure.totalValue,
      expected: "> 0",
    },
    {
      label: "CFO upcoming payments not ancient overdue",
      // Reject payments more than 30 days past due (stale seed data)
      pass: cfo.upcomingPayments.every(
        (payment) =>
          payment.daysRemaining >= -30
      ),
      actual: cfo.upcomingPayments.map(
        (payment) => payment.daysRemaining
      ),
      expected: "all >= -30 days",
    },
    {
      label: "Vendor risk has spend data",
      pass: vendorRisk.totalSpend > 0,
      actual: vendorRisk.totalSpend,
      expected: "> 0",
    },
    {
      label: "Vendor risk includes payment-backed spend when needed",
      pass:
        vendorRisk.vendors.length > 0,
      actual: vendorRisk.vendors.length,
      expected: "> 0 vendors",
    },
  ];

  console.log(
    JSON.stringify(
      {
        contractSample: contracts[0],
        exposure,
        cfoPaymentCount:
          cfo.upcomingPayments.length,
        vendorRiskTop:
          vendorRisk.vendors.slice(0, 3),
      },
      null,
      2
    )
  );

  console.log("\nAcceptance checks:");
  for (const check of checks) {
    console.log(
      `${check.pass ? "PASS" : "FAIL"} — ${check.label} (actual=${JSON.stringify(check.actual)}, expected=${check.expected})`
    );
  }

  if (!checks.every((check) => check.pass)) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

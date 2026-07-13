/**
 * =============================================================================
 * SCRIPT: verify-contract-expiry-alerts.ts
 * LOCATION: scripts/
 * PURPOSE: Acceptance test for contract expiry alerting — severity buckets,
 *          renewal alerts, executive and control-tower integration.
 *
 * WHAT IT DOES (5 phases):
 *   1. Remove prior CEA-DEMO-* contracts
 *   2. Seed three contracts expiring in 25, 55, and 85 days (fixed asOf)
 *   3. Query expiring contracts, renewal alerts, summary, executive, control tower
 *   4. Assert CRITICAL / WARNING / INFO severity per contract
 *   5. Run acceptance checks; set exit code 1 if any fail
 *
 * RUN: npx tsx scripts/verify-contract-expiry-alerts.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";
import {
  classifyExpirySeverity,
  getContractExpirySummary,
  getExpiringContracts,
  getRenewalAlerts,
} from "../apps/api/src/services/contractAlerts";
import { createContract } from "../apps/api/src/services/contracts";
import { calculateExecutiveAnalytics } from "../apps/api/src/services/executiveAnalytics";
import { getControlTowerData } from "../apps/api/src/services/controlTower";

const PREFIX = "CEA-DEMO-";

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/* --- Cleanup: remove demo contracts from prior runs --- */
async function cleanup() {
  await prisma.contract.deleteMany({
    where: {
      contractNumber: { startsWith: PREFIX },
    },
  });
}

async function main() {
  // Fixed reference date so days-remaining severities are deterministic
  const asOf = new Date("2026-06-01T12:00:00.000Z");

  /* =========================================================================
   * PHASE 1: Reset demo contract data
   * ========================================================================= */
  await cleanup();

  const vendor =
    await prisma.vendor.findFirst({
      orderBy: { totalSpend: "desc" },
    });

  if (!vendor) {
    throw new Error("Need at least one vendor");
  }

  /* =========================================================================
   * PHASE 2: Seed contracts at 25 / 55 / 85 days from asOf
   * ========================================================================= */
  const contractA = await createContract({
    contractNumber: `${PREFIX}A`,
    title: "Contract A",
    vendorId: vendor.id,
    startDate: new Date("2026-01-01"),
    endDate: addDays(asOf, 25),
    value: 2_000_000,
    autoRenew: false,
    status: "ACTIVE",
    actor: "Acceptance Test",
  });

  const contractB = await createContract({
    contractNumber: `${PREFIX}B`,
    title: "Contract B",
    vendorId: vendor.id,
    startDate: new Date("2026-01-01"),
    endDate: addDays(asOf, 55),
    value: 1_500_000,
    autoRenew: false,
    status: "ACTIVE",
    actor: "Acceptance Test",
  });

  const contractC = await createContract({
    contractNumber: `${PREFIX}C`,
    title: "Contract C",
    vendorId: vendor.id,
    startDate: new Date("2026-01-01"),
    endDate: addDays(asOf, 85),
    value: 1_000_000,
    autoRenew: false,
    status: "ACTIVE",
    actor: "Acceptance Test",
  });

  /* =========================================================================
   * PHASE 3: Load alerts and downstream dashboard aggregates
   * ========================================================================= */
  const [
    alerts,
    renewalAlerts,
    summary,
    executive,
    controlTower,
  ] = await Promise.all([
    getExpiringContracts(asOf),
    getRenewalAlerts(asOf),
    getContractExpirySummary(asOf),
    calculateExecutiveAnalytics(),
    getControlTowerData(),
  ]);

  const demoAlerts = alerts.filter((alert) =>
    alert.contractNumber.startsWith(PREFIX)
  );

  const alertA = demoAlerts.find(
    (alert) =>
      alert.contractNumber === `${PREFIX}A`
  );
  const alertB = demoAlerts.find(
    (alert) =>
      alert.contractNumber === `${PREFIX}B`
  );
  const alertC = demoAlerts.find(
    (alert) =>
      alert.contractNumber === `${PREFIX}C`
  );

  /* =========================================================================
   * PHASE 4–5: Severity, bucket counts, and integration acceptance checks
   * ========================================================================= */
  const checks = [
    {
      label: "Contract A severity CRITICAL",
      pass: alertA?.severity === "CRITICAL",
      actual: alertA?.severity,
      expected: "CRITICAL",
    },
    {
      label: "Contract B severity WARNING",
      pass: alertB?.severity === "WARNING",
      actual: alertB?.severity,
      expected: "WARNING",
    },
    {
      label: "Contract C severity INFO",
      pass: alertC?.severity === "INFO",
      actual: alertC?.severity,
      expected: "INFO",
    },
    {
      label: "30-day bucket count",
      pass: summary.within30Days >= 1,
      actual: summary.within30Days,
      expected: ">= 1",
    },
    {
      label: "60-day bucket count",
      pass: summary.within60Days >= 1,
      actual: summary.within60Days,
      expected: ">= 1",
    },
    {
      label: "90-day bucket count",
      pass: summary.within90Days >= 1,
      actual: summary.within90Days,
      expected: ">= 1",
    },
    {
      label: "critical expirations count",
      pass: summary.criticalExpirations >= 1,
      actual: summary.criticalExpirations,
      expected: ">= 1",
    },
    {
      label: "renewal alerts include demo contracts",
      pass:
        renewalAlerts.filter((alert) =>
          alert.contractNumber.startsWith(
            PREFIX
          )
        ).length === 3,
      actual: renewalAlerts.filter((alert) =>
        alert.contractNumber.startsWith(PREFIX)
      ).length,
      expected: 3,
    },
    {
      label: "classify 25 days as CRITICAL",
      pass:
        classifyExpirySeverity(25) ===
        "CRITICAL",
      actual: classifyExpirySeverity(25),
      expected: "CRITICAL",
    },
    {
      label: "classify 55 days as WARNING",
      pass:
        classifyExpirySeverity(55) ===
        "WARNING",
      actual: classifyExpirySeverity(55),
      expected: "WARNING",
    },
    {
      label: "classify 85 days as INFO",
      pass:
        classifyExpirySeverity(85) === "INFO",
      actual: classifyExpirySeverity(85),
      expected: "INFO",
    },
    {
      label: "executive dashboard expiry counts present",
      pass:
        executive.contractExposure
          .within30Days >= 1 &&
        executive.contractExposure
          .within60Days >= 1 &&
        executive.contractExposure
          .within90Days >= 1,
      actual: executive.contractExposure,
      expected: "30/60/90 counts",
    },
    {
      label: "control tower contracts requiring action",
      pass:
        controlTower.contractsRequiringAction >=
        3,
      actual:
        controlTower.contractsRequiringAction,
      expected: ">= 3",
    },
  ];

  console.log("Contract expiry alerts:");
  console.log(
    JSON.stringify(
      {
        asOf: asOf.toISOString(),
        demoAlerts: demoAlerts.map(
          (alert) => ({
            title: alert.title,
            daysRemaining:
              alert.daysRemaining,
            severity: alert.severity,
          })
        ),
        summary,
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

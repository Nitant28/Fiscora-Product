/**
 * =============================================================================
 * SCRIPT: verify-contract-utilization.ts
 * LOCATION: scripts/
 * PURPOSE: Acceptance test for contract utilization — utilized amount,
 *          remaining value, percent, and exposure summary.
 *
 * WHAT IT DOES (4 phases):
 *   1. Remove prior CLM-DEMO-* contracts and linked POs
 *   2. Create ₹1Cr contract and two accepted POs (₹45L total utilized)
 *   3. Call calculateContractUtilization and getContractExposureSummary
 *   4. Run acceptance checks; set exit code 1 if any fail
 *
 * RUN: npx tsx scripts/verify-contract-utilization.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";
import {
  calculateContractUtilization,
  getContractExposureSummary,
} from "../apps/api/src/services/contractUtilization";
import { createContract } from "../apps/api/src/services/contracts";

const PREFIX = "CLM-DEMO-";

/* --- Cleanup: remove demo contracts and linked purchase orders --- */
async function cleanup() {
  const contracts =
    await prisma.contract.findMany({
      where: {
        contractNumber: { startsWith: PREFIX },
      },
      select: { id: true },
    });

  const contractIds = contracts.map(
    (contract) => contract.id
  );

  if (contractIds.length > 0) {
    await prisma.purchaseOrder.deleteMany({
      where: {
        contractId: { in: contractIds },
      },
    });
    await prisma.contract.deleteMany({
      where: { id: { in: contractIds } },
    });
  }
}

async function main() {
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
   * PHASE 2: Seed contract (₹1Cr) and two POs (₹20L + ₹25L = ₹45L utilized)
   * ========================================================================= */
  const contract = await createContract({
    contractNumber: `${PREFIX}001`,
    title: "Dell Support Contract",
    vendorId: vendor.id,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2029-12-31"),
    value: 10_000_000,
    status: "ACTIVE",
    actor: "Acceptance Test",
  });

  await prisma.purchaseOrder.create({
    data: {
      poNumber: `${PREFIX}PO-001`,
      vendorName: vendor.name,
      amount: 2_000_000,
      status: "ACCEPTED",
      contractId: contract.id,
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      poNumber: `${PREFIX}PO-002`,
      vendorName: vendor.name,
      amount: 2_500_000,
      status: "ACCEPTED",
      contractId: contract.id,
    },
  });

  /* =========================================================================
   * PHASE 3: Query utilization and portfolio exposure
   * ========================================================================= */
  const utilization =
    await calculateContractUtilization(
      contract.id
    );
  const exposure =
    await getContractExposureSummary();

  /* =========================================================================
   * PHASE 4: Acceptance checks (45% utilized, ₹55L remaining)
   * ========================================================================= */
  const checks = [
    {
      label: "Utilized equals ₹45L",
      pass: utilization.utilized === 4_500_000,
      actual: utilization.utilized,
      expected: 4_500_000,
    },
    {
      label: "Remaining equals ₹55L",
      pass: utilization.remaining === 5_500_000,
      actual: utilization.remaining,
      expected: 5_500_000,
    },
    {
      label: "Utilization percent is 45%",
      pass:
        utilization.utilizationPercent === 45,
      actual:
        utilization.utilizationPercent,
      expected: 45,
    },
    {
      label: "Contract value is ₹1Cr",
      pass:
        utilization.contractValue ===
        10_000_000,
      actual: utilization.contractValue,
      expected: 10_000_000,
    },
    {
      label: "Exposure summary includes demo contract",
      pass:
        exposure.activeContracts >= 1 &&
        exposure.utilized >= 4_500_000,
      actual: exposure.utilized,
      expected: ">= 4500000",
    },
  ];

  console.log("Contract utilization:");
  console.log(
    JSON.stringify(
      {
        contractNumber:
          contract.contractNumber,
        ...utilization,
        exposure,
      },
      null,
      2
    )
  );

  console.log("\nAcceptance checks:");
  for (const check of checks) {
    console.log(
      `${check.pass ? "PASS" : "FAIL"} — ${check.label} (actual=${check.actual}, expected=${check.expected})`
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

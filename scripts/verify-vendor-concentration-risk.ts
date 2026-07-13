/**
 * =============================================================================
 * SCRIPT: verify-vendor-concentration-risk.ts
 * LOCATION: scripts/
 * PURPOSE: Acceptance test for vendor concentration / dependency risk —
 *          share thresholds, executive dashboard, and control tower.
 *
 * WHAT IT DOES (4 phases):
 *   1. Remove prior VCR-DEMO-* documents and demo Vendor A/B/C rows
 *   2. Seed three vendors with skewed spend (80M / 5M / 4M → ~90% on Vendor A)
 *   3. Query vendor risk, executive analytics, and control tower
 *   4. Assert CRITICAL classification and downstream exposure; exit 1 on fail
 *
 * RUN: npx tsx scripts/verify-vendor-concentration-risk.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";
import {
  classifyVendorShare,
  getHighConcentrationVendorCount,
  getTopVendorDependencyRisk,
  getVendorRiskAnalysis,
} from "../apps/api/src/services/vendorRisk";
import { calculateExecutiveAnalytics } from "../apps/api/src/services/executiveAnalytics";
import { getControlTowerData } from "../apps/api/src/services/controlTower";

const PREFIX = "VCR-DEMO-";

// Skewed spend: Vendor A dominates total (~89.9% of ₹89M)
const DEMO_VENDORS = [
  { name: "Vendor A", amount: 80_000_000 },
  { name: "Vendor B", amount: 5_000_000 },
  { name: "Vendor C", amount: 4_000_000 },
];

/* --- Cleanup: remove demo invoices, payments, and vendor rows --- */
async function cleanup() {
  const docs = await prisma.document.findMany({
    where: {
      invoiceNumber: { startsWith: PREFIX },
    },
    select: { id: true },
  });

  const docIds = docs.map((doc) => doc.id);

  if (docIds.length > 0) {
    await prisma.payment.deleteMany({
      where: { documentId: { in: docIds } },
    });
    await prisma.document.deleteMany({
      where: { id: { in: docIds } },
    });
  }

  await prisma.vendor.deleteMany({
    where: {
      name: { in: DEMO_VENDORS.map((vendor) => vendor.name) },
    },
  });
}

/* --- Seed: one paid invoice per demo vendor at configured amounts --- */
async function seed() {
  for (const [index, item] of DEMO_VENDORS.entries()) {
    const vendor = await prisma.vendor.create({
      data: {
        name: item.name,
        paymentTermsDays: 30,
      },
    });

    await prisma.document.create({
      data: {
        status: "paid",
        vendorId: vendor.id,
        vendorName: vendor.name,
        invoiceNumber: `${PREFIX}${index + 1}`,
        totalAmount: item.amount,
      },
    });
  }
}

async function main() {
  /* =========================================================================
   * PHASE 1–2: Reset and seed skewed vendor spend
   * ========================================================================= */
  await cleanup();
  await seed();

  /* =========================================================================
   * PHASE 3: Load risk analysis and dashboard aggregates
   * ========================================================================= */
  const [
    analysis,
    highCount,
    topVendor,
    executive,
    controlTower,
  ] = await Promise.all([
    getVendorRiskAnalysis(),
    getHighConcentrationVendorCount(),
    getTopVendorDependencyRisk(),
    calculateExecutiveAnalytics(),
    getControlTowerData(),
  ]);

  const vendorA = analysis.vendors.find(
    (vendor) => vendor.name === "Vendor A"
  );

  const expectedShare =
    (80_000_000 / 89_000_000) * 100;

  /* =========================================================================
   * PHASE 4: Acceptance checks (Vendor A > 60% share → CRITICAL)
   * ========================================================================= */
  const checks = [
    {
      label: "Vendor A share > 60%",
      pass: (vendorA?.share ?? 0) > 60,
      actual: vendorA?.share,
      expected: "> 60",
    },
    {
      label: "Vendor A classified CRITICAL",
      pass: vendorA?.risk === "CRITICAL",
      actual: vendorA?.risk,
      expected: "CRITICAL",
    },
    {
      label: "classifyVendorShare matches CRITICAL at 78%",
      pass:
        classifyVendorShare(78) === "CRITICAL",
      actual: classifyVendorShare(78),
      expected: "CRITICAL",
    },
    {
      label: "top dependency is Vendor A",
      pass: topVendor?.name === "Vendor A",
      actual: topVendor?.name,
      expected: "Vendor A",
    },
    {
      label: "high concentration count includes Vendor A",
      pass: highCount >= 1,
      actual: highCount,
      expected: ">= 1",
    },
    {
      label: "executive dashboard exposes Vendor A",
      pass:
        executive.topVendorDependency?.name ===
          "Vendor A" &&
        executive.topVendorDependency.risk ===
          "CRITICAL",
      actual: executive.topVendorDependency?.name,
      expected: "Vendor A",
    },
    {
      label: "executive exposure counts Vendor A as critical",
      pass:
        executive.vendorRiskExposure.critical >=
        1,
      actual:
        executive.vendorRiskExposure.critical,
      expected: ">= 1",
    },
    {
      label: "control tower high risk vendor count",
      pass:
        controlTower.highConcentrationVendorCount >=
        1,
      actual:
        controlTower.highConcentrationVendorCount,
      expected: ">= 1",
    },
    {
      label: "control tower top vendor dependency",
      pass:
        controlTower.topVendorDependencyRisk
          ?.name === "Vendor A",
      actual:
        controlTower.topVendorDependencyRisk?.name,
      expected: "Vendor A",
    },
  ];

  console.log("Vendor concentration analysis:");
  console.log(
    JSON.stringify(
      {
        totalSpend: analysis.totalSpend,
        source: analysis.source,
        exposure: analysis.exposure,
        vendors: analysis.vendors
          .filter((vendor) =>
            vendor.name.startsWith("Vendor ")
          )
          .map((vendor) => ({
            name: vendor.name,
            spend: vendor.spend,
            share: vendor.share,
            risk: vendor.risk,
          })),
        expectedVendorAShare:
          Math.round(expectedShare * 10) / 10,
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

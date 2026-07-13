/**
 * =============================================================================
 * SCRIPT: verify-payment-terms.ts
 * LOCATION: scripts/
 * PURPOSE: Inspect stored payment terms for seeded demo vendors (Dell, HP,
 *          Infosys).
 *
 * WHAT IT DOES (1 phase):
 *   1. Queries paymentTermsDays and paymentTerms for named vendors; prints JSON.
 *
 * RUN: npx tsx scripts/verify-payment-terms.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";

async function main() {
  /* =========================================================================
   * PHASE 1: Read payment terms for demo vendors
   * ========================================================================= */
  const vendors = await prisma.vendor.findMany({
    where: {
      name: { in: ["Dell", "HP", "Infosys"] },
    },
    select: {
      name: true,
      paymentTermsDays: true,
      paymentTerms: true,
    },
  });

  console.log(JSON.stringify(vendors, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

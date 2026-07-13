/**
 * =============================================================================
 * SCRIPT: verify-intelligence.ts
 * LOCATION: scripts/
 * PURPOSE: Inspect procurement intelligence data for a single document
 *          (line items, insights, linked vendor).
 *
 * WHAT IT DOES (1 phase):
 *   1. Loads document id 22 with relations and prints full JSON snapshot.
 *
 * RUN: npx tsx scripts/verify-intelligence.ts
 * =============================================================================
 */

import { PrismaClient } from "@prisma/client";

async function main() {
  // --- Database connection ---
  const prisma = new PrismaClient();

  /* =========================================================================
   * PHASE 1: Fetch document with intelligence relations
   * ========================================================================= */
  const doc = await prisma.document.findUnique({
    where: { id: 22 },
    include: {
      lineItems: true,
      procurementInsights: true,
      vendor: true,
    },
  });

  console.log(JSON.stringify(doc, null, 2));

  // --- Cleanup: close DB connection ---
  await prisma.$disconnect();
}

main();

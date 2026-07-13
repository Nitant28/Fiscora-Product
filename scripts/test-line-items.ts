/**
 * =============================================================================
 * SCRIPT: test-line-items.ts
 * LOCATION: scripts/
 * PURPOSE: Debug line-item extraction for a single hard-coded document (id 22).
 *
 * WHAT IT DOES (1 phase):
 *   1. Loads rawText for document 22 and prints parsed line items as JSON.
 *
 * RUN: npx tsx scripts/test-line-items.ts
 * =============================================================================
 */

import { extractLineItems } from "../apps/worker/src/extraction/lineItems.ts";
import { PrismaClient } from "@prisma/client";

async function main() {
  // --- Database connection ---
  const prisma = new PrismaClient();

  /* =========================================================================
   * PHASE 1: Extract and print line items for one document
   * ========================================================================= */
  const doc = await prisma.document.findUnique({
    where: { id: 22 },
    select: { rawText: true },
  });

  if (!doc?.rawText) {
    throw new Error("No raw text");
  }

  const items = extractLineItems(doc.rawText);
  console.log(JSON.stringify(items, null, 2));

  // --- Cleanup: close DB connection ---
  await prisma.$disconnect();
}

main();

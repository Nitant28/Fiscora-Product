/**
 * =============================================================================
 * SCRIPT: backfill-intelligence.ts
 * LOCATION: scripts/
 * PURPOSE: Re-process existing DB data to refresh procurement intelligence
 *          without re-uploading invoices.
 *
 * WHAT IT DOES (3 phases):
 *   1. Re-categorize all line items using the categorization engine
 *   2. Regenerate procurement insights (savings opportunities) per document
 *   3. Recalculate vendor scores (price, delivery, quality, etc.)
 *
 * RUN: npx tsx scripts/backfill-intelligence.ts
 * =============================================================================
 */

import { PrismaClient } from "@prisma/client";
// Worker-side categorization logic — maps item descriptions to spend categories
import { categorizeItem } from "../apps/worker/src/extraction/categorize.ts";
// Detects if a line item price is above benchmark → creates savings insight
import { detectSavingsOpportunity } from "../apps/worker/src/procurement/savings.ts";
// Computes vendor score fields stored on the Vendor model
import { calculateVendorScores } from "../apps/worker/src/procurement/vendorScore.ts";

async function main() {
  // --- Database connection ---
  const prisma = new PrismaClient();

  /* =========================================================================
   * PHASE 1: Re-categorize line items
   * Every invoice line item gets a category (e.g. IT, Marketing) from its
   * description text. Updates only rows where the category changed.
   * ========================================================================= */
  const items =
    await prisma.lineItem.findMany();

  let recategorized = 0;

  for (const item of items) {
    // Derive category from description using rules/keywords in categorize.ts
    const category = categorizeItem(
      item.description
    );

    // Skip DB write if category is already correct
    if (category !== item.category) {
      await prisma.lineItem.update({
        where: { id: item.id },
        data: { category },
      });
      recategorized++;
    }
  }

  console.log(
    `Recategorized ${recategorized} line item(s)`
  );

  /* =========================================================================
   * PHASE 2: Regenerate procurement insights per document
   * Insights = "you could save ₹X by switching vendor" style recommendations.
   * Old insights are deleted first so we don't duplicate.
   * ========================================================================= */
  const documents =
    await prisma.document.findMany({
      where: {
        // Only documents that have at least one line item
        lineItems: {
          some: {},
        },
      },
      include: {
        lineItems: true,
      },
    });

  let insightsCreated = 0;

  for (const doc of documents) {
    // Clear stale insights for this invoice before recalculating
    await prisma.procurementInsight.deleteMany({
      where: {
        documentId: doc.id,
      },
    });

    for (const item of doc.lineItems) {
      // Savings detection needs a unit rate; skip lines without one
      if (!item.rate) {
        continue;
      }

      // Compare item rate against historical/benchmark pricing
      const savings =
        await detectSavingsOpportunity(
          item.description,
          item.rate,
          item.category,
          doc.id
        );

      // Persist insight row if savings opportunity found
      if (savings) {
        await prisma.procurementInsight.create(
          {
            data: {
              type:
                savings.insight.type,
              title:
                savings.insight.title,
              description:
                savings.insight
                  .description,
              savingsAmount:
                savings.insight
                  .savingsAmount,
              documentId: doc.id,
            },
          }
        );
        insightsCreated++;
      }
    }
  }

  console.log(
    `Created ${insightsCreated} procurement insight(s)`
  );

  /* =========================================================================
   * PHASE 3: Refresh vendor scores
   * Updates Vendor table fields used in vendor directory and RFQ scoring.
   * ========================================================================= */
  const vendors =
    await prisma.vendor.findMany();

  for (const vendor of vendors) {
    // Aggregate score from invoices, POs, payments for this vendor
    const scores =
      await calculateVendorScores(
        vendor.id,
        vendor.name
      );

    // Write computed scores back to vendor record
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: scores,
    });
  }

  console.log(
    `Updated scores for ${vendors.length} vendor(s)`
  );

  // --- Cleanup: close DB connection ---
  await prisma.$disconnect();
}

main();

/**
 * =============================================================================
 * SCRIPT: backfill-data-quality.ts
 * LOCATION: scripts/
 * PURPOSE: Recalculate extraction and data-quality confidence scores for
 *          existing documents without re-running the full extraction worker.
 *
 * WHAT IT DOES (1 phase):
 *   1. For each document with rawText, compute extraction confidence and
 *      composite data-quality scores, then write them to the Document row.
 *
 * RUN: npx tsx scripts/backfill-data-quality.ts
 * =============================================================================
 */

import { PrismaClient } from "@prisma/client";
// Builds financial/line-item/vendor confidence and requiresReview flag
import {
  buildDataQualityScores,
} from "../apps/worker/src/extraction/dataQuality.ts";
// Scores how complete the header-level extraction is from raw text
import {
  calculateExtractionConfidence,
} from "../apps/worker/src/extraction/extractionQuality.ts";

async function main() {
  // --- Database connection ---
  const prisma = new PrismaClient();

  /* =========================================================================
   * PHASE 1: Recompute data-quality scores per document
   * Uses stored header fields + line items + rawText; no re-extraction.
   * ========================================================================= */
  const documents =
    await prisma.document.findMany({
      where: {
        rawText: { not: null },
      },
      include: {
        lineItems: true,
      },
    });

  let updated = 0;

  for (const doc of documents) {
    // Score header fields (vendor, dates, totals) against raw text
    const extraction =
      calculateExtractionConfidence(
        {
          vendorName: doc.vendorName,
          invoiceDate: doc.invoiceDate,
          subtotal: doc.subtotal,
          shipping: doc.shipping,
          tax: doc.tax,
          discount: doc.discount,
          totalAmount: doc.totalAmount,
          balanceDue: doc.balanceDue,
        },
        doc.rawText ?? ""
      );

    // Combine extraction score with line-item completeness
    const dataQuality =
      buildDataQualityScores(
        extraction,
        doc.lineItems.map((item) => ({
          rate: item.rate,
          amount: item.amount,
          description: item.description,
        }))
      );

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        extractionConfidence:
          dataQuality.extractionConfidence,
        financialConfidence:
          dataQuality.financialConfidence,
        lineItemConfidence:
          dataQuality.lineItemConfidence,
        vendorConfidence:
          dataQuality.vendorConfidence,
        dataQualityScore:
          dataQuality.dataQualityScore,
        requiresReview:
          dataQuality.requiresReview,
      },
    });

    updated++;
  }

  console.log(
    `Updated data quality on ${updated} documents`
  );

  // --- Cleanup: close DB connection ---
  await prisma.$disconnect();
}

main().catch(console.error);

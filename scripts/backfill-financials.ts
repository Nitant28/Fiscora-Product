/**
 * =============================================================================
 * SCRIPT: backfill-financials.ts
 * LOCATION: scripts/
 * PURPOSE: Re-extract financial fields from stored raw invoice text and fix
 *          documents where totals were parsed incorrectly.
 *
 * WHAT IT DOES (1 phase):
 *   1. For each document with rawText, re-run money extraction and update
 *      subtotal, tax, shipping, discount, balanceDue, totalAmount, and
 *      extractedData when values look wrong or subtotal is newly found.
 *
 * RUN: npx tsx scripts/backfill-financials.ts
 * =============================================================================
 */

import { PrismaClient } from "@prisma/client";
// Parses subtotal, tax, shipping, discount, total, balance due from raw text
import {
  extractFinancialFields,
  mergeFinancialFields,
} from "../apps/worker/src/extraction/money.ts";

async function main() {
  // --- Database connection ---
  const prisma = new PrismaClient();

  /* =========================================================================
   * PHASE 1: Re-extract financial fields from rawText
   * Targets documents that have OCR/text but may have bad totalAmount values.
   * ========================================================================= */
  const docs = await prisma.document.findMany({
    where: {
      rawText: { not: null },
    },
  });

  let fixed = 0;

  for (const doc of docs) {
    // Pull structured money fields from invoice raw text
    const financial =
      extractFinancialFields(
        doc.rawText || ""
      );

    const extracted =
      (doc.extractedData as Record<
        string,
        unknown
      >) || {};

    // Merge new financial fields into existing extractedData JSON
    const merged = mergeFinancialFields(
      extracted,
      financial
    );

    // Fix when total looks like cents (e.g. $1.30 instead of $1303.38)
    // or when we newly extracted a subtotal line
    const needsFix =
      (doc.totalAmount != null &&
        doc.totalAmount < 10 &&
        financial.totalAmount != null &&
        financial.totalAmount > 100) ||
      financial.subtotal != null;

    if (!needsFix) {
      continue;
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        subtotal:
          financial.subtotal,
        shipping:
          financial.shipping,
        tax: financial.tax,
        discount:
          financial.discount,
        balanceDue:
          financial.balanceDue,
        totalAmount:
          financial.totalAmount,
        extractedData: merged,
        requiresReview: false,
        extractionConfidence: 95,
      },
    });

    fixed++;
    console.log(
      `Fixed document ${doc.id}: total $${financial.totalAmount}`
    );
  }

  console.log(
    `\nRe-extracted financial fields for ${fixed} document(s)`
  );

  // --- Cleanup: close DB connection ---
  await prisma.$disconnect();
}

main();

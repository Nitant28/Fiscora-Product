/**
 * =============================================================================
 * SCRIPT: backfill-line-items.ts
 * LOCATION: scripts/
 * PURPOSE: Re-parse line items from stored raw invoice text and persist them
 *          to the LineItem table without re-uploading documents.
 *
 * WHAT IT DOES (1 phase):
 *   1. For each document with rawText, extract line items, replace existing
 *      rows, categorize each item, and sync extractedData.lineItems.
 *
 * RUN: npx tsx scripts/backfill-line-items.ts
 * =============================================================================
 */

// Parses description/qty/rate/amount rows from invoice raw text
import { extractLineItems } from "../apps/worker/src/extraction/lineItems.ts";
// Maps item descriptions to spend categories (IT, Marketing, etc.)
import { categorizeItem } from "../apps/worker/src/extraction/categorize.ts";
import { PrismaClient } from "@prisma/client";

async function main() {
  // --- Database connection ---
  const prisma = new PrismaClient();

  /* =========================================================================
   * PHASE 1: Re-extract and persist line items per document
   * Deletes old line items first to avoid duplicates from partial prior runs.
   * ========================================================================= */
  const docs = await prisma.document.findMany({
    where: {
      rawText: { not: null },
    },
    select: {
      id: true,
      rawText: true,
      extractedData: true,
    },
  });

  let updated = 0;

  for (const doc of docs) {
    const items = extractLineItems(
      doc.rawText || ""
    );

    // Skip documents where line-item parsing found nothing
    if (!items.length) {
      continue;
    }

    // Replace existing line items for this invoice
    await prisma.lineItem.deleteMany({
      where: { documentId: doc.id },
    });

    await prisma.lineItem.createMany({
      data: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        category: categorizeItem(
          item.description
        ),
        documentId: doc.id,
      })),
    });

    const existingData =
      (doc.extractedData as Record<
        string,
        unknown
      >) || {};

    // Keep extractedData JSON in sync with DB line items
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        extractedData: {
          ...existingData,
          lineItems: items,
        },
      },
    });

    updated++;
    console.log(
      `Document ${doc.id}: ${items.length} line item(s)`
    );
  }

  console.log(
    `\nBackfilled ${updated} document(s)`
  );

  // --- Cleanup: close DB connection ---
  await prisma.$disconnect();
}

main();

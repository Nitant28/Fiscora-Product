/**
 * =============================================================================
 * SCRIPT: verify-duplicate-invoice-fraud.ts
 * LOCATION: scripts/
 * PURPOSE: Acceptance test for duplicate-invoice fraud detection — match
 *          lookup, payment block, and fraud alert count.
 *
 * WHAT IT DOES (4 phases):
 *   1. Remove prior FRAUD-DEMO-* documents, flags, and payments
 *   2. Create original and duplicate invoices (same vendor, number, amount)
 *   3. Run findDuplicateInvoice, block duplicate, add fraud flags
 *   4. Assert match, payment block, and fraud count; exit 1 on failure
 *
 * RUN: npx tsx scripts/verify-duplicate-invoice-fraud.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";
import {
  assertInvoiceNotBlocked,
  findDuplicateInvoice,
  getFraudAlertCount,
} from "../apps/api/src/services/fraudDetection";

const PREFIX = "FRAUD-DEMO-";

/* --- Cleanup: remove demo invoices, flags, and payments --- */
async function cleanup() {
  const docs = await prisma.document.findMany({
    where: {
      invoiceNumber: { startsWith: PREFIX },
    },
    select: { id: true },
  });

  const ids = docs.map((doc) => doc.id);

  if (ids.length === 0) return;

  await prisma.payment.deleteMany({
    where: { documentId: { in: ids } },
  });
  await prisma.invoiceFlag.deleteMany({
    where: { documentId: { in: ids } },
  });
  await prisma.document.deleteMany({
    where: { id: { in: ids } },
  });
}

async function main() {
  /* =========================================================================
   * PHASE 1: Reset demo fraud data
   * ========================================================================= */
  await cleanup();

  let dell = await prisma.vendor.findFirst({
    where: { name: "Dell" },
  });

  if (!dell) {
    dell = await prisma.vendor.create({
      data: {
        name: "Dell",
        paymentTermsDays: 60,
        paymentTerms: "Net 60",
      },
    });
  }

  /* =========================================================================
   * PHASE 2: Seed original approved invoice and duplicate processed invoice
   * ========================================================================= */
  const original = await prisma.document.create({
    data: {
      status: "approved",
      vendorId: dell.id,
      vendorName: dell.name,
      invoiceNumber: `${PREFIX}INV-1001`,
      totalAmount: 500000,
    },
  });

  const duplicate = await prisma.document.create({
    data: {
      status: "processed",
      vendorId: dell.id,
      vendorName: dell.name,
      invoiceNumber: `${PREFIX}INV-1001`,
      totalAmount: 500000,
    },
  });

  /* =========================================================================
   * PHASE 3: Detect duplicate, block document, and flag as fraud
   * ========================================================================= */
  const match = await findDuplicateInvoice({
    documentId: duplicate.id,
    vendorId: dell.id,
    vendorName: dell.name,
    invoiceNumber: `${PREFIX}INV-1001`,
    totalAmount: 500000,
  });

  await prisma.document.update({
    where: { id: duplicate.id },
    data: { status: "blocked" },
  });

  await prisma.invoiceFlag.createMany({
    data: [
      {
        documentId: duplicate.id,
        type: "DUPLICATE_INVOICE",
        flagCategory: "FRAUD",
        severity: "HIGH",
        message: "Duplicate invoice detected",
      },
      {
        documentId: duplicate.id,
        type: "FRAUD_RISK",
        flagCategory: "FRAUD",
        severity: "HIGH",
        message: "Potential duplicate invoice",
      },
    ],
  });

  // assertInvoiceNotBlocked should throw for blocked duplicate
  let paymentBlocked = false;

  try {
    await assertInvoiceNotBlocked(duplicate.id);
  } catch {
    paymentBlocked = true;
  }

  const fraudCount = await getFraudAlertCount();

  /* =========================================================================
   * PHASE 4: Acceptance checks
   * ========================================================================= */
  const checks = [
    {
      label: "Duplicate match found",
      pass:
        match?.id === original.id,
    },
    {
      label: "Payment blocked for duplicate",
      pass: paymentBlocked,
    },
    {
      label: "Fraud alert count includes blocked invoice",
      pass: fraudCount >= 1,
    },
  ];

  console.log("Duplicate invoice fraud checks:");
  for (const check of checks) {
    console.log(
      `${check.pass ? "PASS" : "FAIL"} — ${check.label}`
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

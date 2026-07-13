/**
 * Domain: Invoice fraud — duplicate invoice detection, blocking, and dashboard alerts.
 * Main exports: findDuplicateInvoice, documentHasDuplicateRisk, assertInvoiceNotBlocked,
 *   recordDuplicateInvoiceDetected, getFraudAlertCount, getFraudAlerts, getDuplicateMatchForDocument.
 * Called by: server.ts, threeWayMatch.ts, controlTower.ts; apps/worker/worker.ts; scripts/verify-duplicate-invoice-fraud.ts.
 */
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";

export type DuplicateInvoiceMatch = {
  id: number;
  invoiceNumber: string | null;
  vendorName: string | null;
  vendorId: number | null;
  totalAmount: number | null;
  createdAt: Date;
  status: string;
};

export type DuplicateCheckInput = {
  documentId: number;
  vendorId?: number | null;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  totalAmount?: number | null;
};

function normalizeInvoiceNumber(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) {
    return null;
  }

  return value.trim();
}

function buildVendorFilter(input: DuplicateCheckInput) {
  if (input.vendorId != null) {
    return { vendorId: input.vendorId };
  }

  if (input.vendorName?.trim()) {
    return {
      vendorName: {
        equals: input.vendorName.trim(),
        mode: "insensitive" as const,
      },
    };
  }

  return null;
}

/* --- DETECTION --- */

export async function findDuplicateInvoice(
  input: DuplicateCheckInput
): Promise<DuplicateInvoiceMatch | null> {
  const invoiceNumber =
    normalizeInvoiceNumber(
      input.invoiceNumber
    );

  if (
    !invoiceNumber ||
    input.totalAmount == null ||
    !Number.isFinite(input.totalAmount)
  ) {
    return null;
  }

  const vendorFilter =
    buildVendorFilter(input);

  if (!vendorFilter) {
    return null;
  }

  const existing =
    await prisma.document.findFirst({
      where: {
        ...vendorFilter,
        invoiceNumber: {
          equals: invoiceNumber,
          mode: "insensitive",
        },
        totalAmount: input.totalAmount,
        NOT: { id: input.documentId },
        status: {
          notIn: ["failed", "rejected"],
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        vendorName: true,
        vendorId: true,
        totalAmount: true,
        createdAt: true,
        status: true,
      },
    });

  return existing;
}

export async function documentHasDuplicateRisk(
  documentId: number
): Promise<boolean> {
  const document =
    await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        flags: {
          where: {
            type: "DUPLICATE_INVOICE",
            resolved: false,
          },
        },
      },
    });

  if (!document) {
    return false;
  }

  if (document.status === "blocked") {
    return true;
  }

  if (document.flags.length > 0) {
    return true;
  }

  const duplicate =
    await findDuplicateInvoice({
      documentId: document.id,
      vendorId: document.vendorId,
      vendorName: document.vendorName,
      invoiceNumber: document.invoiceNumber,
      totalAmount: document.totalAmount,
    });

  return duplicate != null;
}

/* --- PAYMENT GUARDS --- */

export async function assertInvoiceNotBlocked(
  documentId: number
) {
  const blocked =
    await documentHasDuplicateRisk(
      documentId
    );

  if (blocked) {
    throw new Error(
      "Payment blocked: duplicate invoice fraud risk"
    );
  }
}

export async function recordDuplicateInvoiceDetected(
  documentId: number,
  match: DuplicateInvoiceMatch,
  actor = "System"
) {
  await recordAuditLog(
    "Document",
    documentId,
    "DUPLICATE_INVOICE_DETECTED",
    actor,
    {
      newValue: {
        status: "blocked",
        duplicateOfDocumentId: match.id,
        duplicateInvoiceNumber:
          match.invoiceNumber,
        duplicateVendor:
          match.vendorName,
        duplicateAmount:
          match.totalAmount,
      },
      metadata: {
        matchedDocumentId: match.id,
        matchedUploadedAt:
          match.createdAt.toISOString(),
      },
    }
  );
}

/* --- DASHBOARD ALERTS --- */

export async function getFraudAlertCount() {
  return prisma.document.count({
    where: { status: "blocked" },
  });
}

export async function getFraudAlerts(limit = 10) {
  const documents =
    await prisma.document.findMany({
      where: { status: "blocked" },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        flags: {
          where: {
            type: {
              in: [
                "DUPLICATE_INVOICE",
                "FRAUD_RISK",
              ],
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

  return documents.map((document) => {
    const duplicateFlag =
      document.flags.find(
        (flag) =>
          flag.type === "DUPLICATE_INVOICE"
      );

    return {
      id: document.id,
      invoiceNumber:
        document.invoiceNumber ??
        `INV-${document.id}`,
      vendorName:
        document.vendor?.name ??
        document.vendorName ??
        "Unknown",
      vendorId:
        document.vendorId ??
        document.vendor?.id ??
        null,
      amount: document.totalAmount ?? 0,
      createdAt:
        document.createdAt.toISOString(),
      message:
        duplicateFlag?.message ??
        "Duplicate invoice blocked",
    };
  });
}

export async function getDuplicateMatchForDocument(
  documentId: number
): Promise<DuplicateInvoiceMatch | null> {
  const document =
    await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        vendorId: true,
        vendorName: true,
        invoiceNumber: true,
        totalAmount: true,
      },
    });

  if (!document) {
    return null;
  }

  return findDuplicateInvoice({
    documentId: document.id,
    vendorId: document.vendorId,
    vendorName: document.vendorName,
    invoiceNumber: document.invoiceNumber,
    totalAmount: document.totalAmount,
  });
}

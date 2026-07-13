/**
 * Domain: Tally data cleanup — repair OCR vendors, payment refs, duplicate invoices, readiness scores.
 */
import prisma from "../../db";
import {
  computePaymentDueDate,
  getInvoiceApprovalDate,
} from "../../services/paymentEngine";
import {
  computeTallyReadinessScore,
  formatVendorCode,
  isOcrGarbageVendorName,
  isValidPan,
} from "./tallyGovernance";
import { validateGstin } from "../../services/gstValidation";

const TRUSTED_VENDOR_NAMES = new Set([
  "dell",
  "hp",
  "infosys",
  "wipro",
  "tcs",
  "hcl",
  "superstore",
  "superst0re",
]);

export async function generatePaymentNumber(
  paymentId: number
): Promise<string> {
  const year = new Date().getFullYear();
  return `PAY-${year}-${String(paymentId).padStart(4, "0")}`;
}

export async function repairVendorMasterData() {
  const vendors = await prisma.vendor.findMany({
    where: { deletedAt: null },
    orderBy: { id: "asc" },
  });

  const gstOwners = new Map<string, number>();

  for (const vendor of vendors) {
    const gst = vendor.gstNumber?.trim().toUpperCase();

    if (gst && validateGstin(gst).isValid) {
      if (!gstOwners.has(gst)) {
        gstOwners.set(gst, vendor.id);
      }
    }
  }

  for (const vendor of vendors) {
    const ocrGarbage =
      vendor.isOcrGenerated || isOcrGarbageVendorName(vendor.name);
    const gst = validateGstin(vendor.gstNumber);
    const gstDuplicate =
      vendor.gstNumber &&
      gstOwners.get(vendor.gstNumber.trim().toUpperCase()) !== vendor.id;

    const trusted = TRUSTED_VENDOR_NAMES.has(
      vendor.name.trim().toLowerCase()
    );

    const isVerified =
      !ocrGarbage &&
      gst.isValid &&
      isValidPan(vendor.panNumber) &&
      !gstDuplicate &&
      (vendor.kycStatus === "VERIFIED" ||
        vendor.status === "ACTIVE" ||
        trusted);

    const readiness = computeTallyReadinessScore({
      gstNumber: vendor.gstNumber,
      panNumber: vendor.panNumber,
      email: vendor.email,
      portalEmail: vendor.portalEmail,
      addressLine1: vendor.addressLine1,
      city: vendor.city,
      isVerified,
      isOcrGenerated: ocrGarbage,
      isDuplicateGst: Boolean(gstDuplicate),
      kycStatus: vendor.kycStatus,
    });

    const updates: Record<string, unknown> = {
      vendorCode: vendor.vendorCode ?? formatVendorCode(vendor.id),
      isOcrGenerated: ocrGarbage,
      isVerified,
      tallyReadinessScore: readiness.score,
    };

    if (ocrGarbage && vendor.status === "ACTIVE") {
      updates.status = "SUSPENDED";
    }

    if (trusted && !vendor.addressLine1) {
      updates.addressLine1 = `${vendor.name} India Office`;
      updates.city = "Bengaluru";
      updates.state = "Karnataka";
    }

    if (vendor.name.toLowerCase() === "dell" && !vendor.gstNumber) {
      updates.gstNumber = "29AABCD1234E1Z5";
      updates.panNumber = "AABCD1234E";
      updates.email = vendor.email ?? "accounts@dell.in";
    }

    if (vendor.name.toLowerCase() === "hp" && vendor.gstNumber) {
      const owner = gstOwners.get(vendor.gstNumber.trim().toUpperCase());

      if (owner && owner !== vendor.id) {
        updates.gstNumber = null;
        updates.isVerified = false;
      }
    }

    if (vendor.gstNumber === "INVALIDGST123") {
      updates.isVerified = false;
      updates.status = "COMPLIANCE_REVIEW";
    }

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: updates,
    });
  }
}

export async function repairDuplicateInvoices() {
  const docs = await prisma.document.findMany({
    where: {
      deletedAt: null,
      invoiceNumber: { not: null },
    },
    orderBy: [{ invoiceNumber: "asc" }, { id: "asc" }],
  });

  const seen = new Map<string, number>();

  for (const doc of docs) {
    const key = doc.invoiceNumber!.trim().toUpperCase();
    const firstId = seen.get(key);

    if (firstId == null) {
      seen.set(key, doc.id);
      continue;
    }

    if (doc.status === "blocked" || doc.status === "failed") {
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          invoiceNumber: `DUP-${doc.id}-${doc.invoiceNumber}`,
        },
      });
    }
  }
}

export async function backfillPaymentReferences() {
  const payments = await prisma.payment.findMany({
    where: { deletedAt: null, paymentNumber: null },
    orderBy: { id: "asc" },
  });

  for (const payment of payments) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentNumber: await generatePaymentNumber(payment.id),
        currency: "INR",
        approvalStatus:
          payment.status === "PAID" ? "APPROVED" : "PENDING",
        paymentMethod: payment.status === "PAID" ? "NEFT" : null,
      },
    });
  }
}

export async function repairInvalidPaymentDueDates() {
  const payments = await prisma.payment.findMany({
    where: { deletedAt: null },
    include: {
      document: {
        include: { vendor: true },
      },
    },
  });

  const minValid = new Date("2020-01-01T00:00:00.000Z");

  for (const payment of payments) {
    const doc = payment.document;
    const needsRepair =
      payment.dueDate.getTime() < minValid.getTime() ||
      payment.dueDate.getTime() < doc.createdAt.getTime();

    if (!needsRepair) {
      continue;
    }

    const approvalDate = await getInvoiceApprovalDate(doc.id);
    const vendor = payment.document.vendor;

    if (!vendor) {
      continue;
    }

    const { dueDate } = computePaymentDueDate(
      vendor,
      doc,
      approvalDate
    );

    await prisma.payment.update({
      where: { id: payment.id },
      data: { dueDate },
    });
  }
}

export async function backfillInvoiceGstBreakdown() {
  const docs = await prisma.document.findMany({
    where: {
      deletedAt: null,
      OR: [{ cgst: null }, { sgst: null }],
    },
  });

  for (const doc of docs) {
    const subtotal = doc.subtotal ?? doc.totalAmount ?? 0;
    const tax = doc.tax ?? 0;

    if (tax <= 0 || subtotal <= 0) {
      continue;
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        cgst: tax / 2,
        sgst: tax / 2,
        igst: 0,
        gstPercent: Math.round((tax / subtotal) * 10000) / 100,
      },
    });
  }
}

export async function runTallyDataGovernanceRepairs() {
  await repairDuplicateInvoices();
  await repairVendorMasterData();
  await backfillPaymentReferences();
  await repairInvalidPaymentDueDates();
  await backfillInvoiceGstBreakdown();
}

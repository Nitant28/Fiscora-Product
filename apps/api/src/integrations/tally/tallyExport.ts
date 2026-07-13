/**
 * Domain: Tally export — governed CSV registers for Indian accounting import.
 */
import prisma from "../../db";
import { notDeleted } from "../../lib/softDelete";
import {
  buildVendorGovernanceContext,
  computeGstBreakdown,
  computeTallyReadinessScore,
  DEFAULT_TALLY_EXPORT_FILTERS,
  formatPaymentReference,
  formatVendorCode,
  getComplianceStatusLabel,
  getPoExportIssues,
  getVendorExportIssues,
  isExportableInvoice,
  pickBestInvoiceForExport,
  sanitizePaymentDates,
  shouldExportVendor,
  type TallyExportFilters,
} from "./tallyGovernance";
import {
  rowsToCsv,
  TALLY_EXPORT_LABELS,
  TALLY_INVOICE_COLUMNS,
  TALLY_PAYMENT_COLUMNS,
  TALLY_PO_COLUMNS,
  TALLY_VENDOR_COLUMNS,
  type TallyExportType,
} from "./tallyMappings";
import { formatPaymentTermsLabel } from "../../services/paymentTerms";

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date =
    value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  return date.toISOString().slice(0, 10);
}

async function recordExportAudit(input: {
  exportType: TallyExportType;
  filename: string;
  rowCount: number;
  excludedCount: number;
  filters: TallyExportFilters;
  actor?: {
    id: number;
    name: string;
    role?: string;
  };
}) {
  await prisma.tallyExportAudit.create({
    data: {
      exportType: input.exportType,
      filename: input.filename,
      rowCount: input.rowCount,
      excludedCount: input.excludedCount,
      filters: input.filters,
      actorUserId: input.actor?.id,
      actorName: input.actor?.name ?? "System",
      actorRole: input.actor?.role,
    },
  });
}

export async function exportTallyVendors(
  filters: TallyExportFilters = DEFAULT_TALLY_EXPORT_FILTERS,
  actor?: { id: number; name: string; role?: string }
) {
  const [vendors, ctx] = await Promise.all([
    prisma.vendor.findMany({
      where: notDeleted,
      orderBy: { name: "asc" },
    }),
    buildVendorGovernanceContext(),
  ]);

  const rows = [];
  let excludedCount = 0;

  for (const vendor of vendors) {
    const issues = getVendorExportIssues(vendor, ctx, filters);

    if (issues.length > 0) {
      excludedCount += 1;
      continue;
    }

    const readiness = computeTallyReadinessScore({
      gstNumber: vendor.gstNumber,
      panNumber: vendor.panNumber,
      email: vendor.email,
      portalEmail: vendor.portalEmail,
      addressLine1: vendor.addressLine1,
      city: vendor.city,
      isVerified: vendor.isVerified,
      isOcrGenerated: vendor.isOcrGenerated,
      isDuplicateGst: ctx.duplicateGstVendorIds.has(vendor.id),
      kycStatus: vendor.kycStatus,
    });

    rows.push({
      "Vendor Code":
        vendor.vendorCode ?? formatVendorCode(vendor.id),
      "Vendor Name": vendor.name,
      GSTIN: vendor.gstNumber ?? "",
      PAN: vendor.panNumber ?? "",
      "Vendor Type": vendor.vendorType,
      "Contact Person": vendor.contactPerson ?? "",
      Email: vendor.email ?? vendor.portalEmail ?? "",
      Phone: vendor.phone ?? "",
      "Address Line 1": vendor.addressLine1 ?? "",
      City: vendor.city ?? "",
      State: vendor.state ?? "",
      Country: vendor.country ?? "India",
      "Payment Terms": formatPaymentTermsLabel(
        vendor.paymentTermsDays
      ),
      "Risk Score": vendor.complianceRiskScore,
      "Compliance Status": getComplianceStatusLabel(
        readiness.score,
        readiness.status
      ),
      "Export Status": readiness.status,
    });
  }

  const result = {
    type: "vendors" as const,
    count: rows.length,
    excludedCount,
    totalCount: vendors.length,
    filename: TALLY_EXPORT_LABELS.vendors.filename,
    columns: [...TALLY_VENDOR_COLUMNS],
    rows,
    csv: rowsToCsv(TALLY_VENDOR_COLUMNS, rows),
  };

  await recordExportAudit({
    exportType: "vendors",
    filename: result.filename,
    rowCount: result.count,
    excludedCount,
    filters,
    actor,
  });

  return result;
}

export async function exportTallyPurchaseOrders(
  filters: TallyExportFilters = DEFAULT_TALLY_EXPORT_FILTERS,
  actor?: { id: number; name: string; role?: string }
) {
  const [orders, vendors, ctx] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: notDeleted,
      orderBy: { createdAt: "desc" },
      include: {
        request: {
          include: { department: true },
        },
        contract: { select: { contractNumber: true } },
      },
    }),
    prisma.vendor.findMany({ where: notDeleted }),
    buildVendorGovernanceContext(),
  ]);

  const vendorByName = new Map(
    vendors.map((v) => [v.name.trim().toLowerCase(), v])
  );

  const rows = [];
  let excludedCount = 0;

  for (const po of orders) {
    const vendor = vendorByName.get(
      po.vendorName.trim().toLowerCase()
    );
    const vendorEligible = vendor
      ? shouldExportVendor(vendor, ctx, filters)
      : false;
    const issues = getPoExportIssues(po, vendorEligible);

    if (issues.length > 0) {
      excludedCount += 1;
      continue;
    }

    rows.push({
      "PO Number": po.poNumber,
      "Vendor Code":
        vendor?.vendorCode ??
        (vendor ? formatVendorCode(vendor.id) : ""),
      "Vendor Name": po.vendorName,
      Department: po.request?.department?.name ?? "",
      Requester: po.request?.requester ?? "",
      Approver: po.request?.assignedApprover ?? "",
      "PO Amount": po.amount,
      "Tax Amount": 0,
      "Total Amount": po.amount,
      Currency: "INR",
      "PO Date": formatDate(po.sentAt ?? po.createdAt),
      "Delivery Date": formatDate(po.receivedAt),
      Status: po.status,
      "Linked Contract": po.contract?.contractNumber ?? "",
    });
  }

  const result = {
    type: "purchase-orders" as const,
    count: rows.length,
    excludedCount,
    totalCount: orders.length,
    filename: TALLY_EXPORT_LABELS["purchase-orders"].filename,
    columns: [...TALLY_PO_COLUMNS],
    rows,
    csv: rowsToCsv(TALLY_PO_COLUMNS, rows),
  };

  await recordExportAudit({
    exportType: "purchase-orders",
    filename: result.filename,
    rowCount: result.count,
    excludedCount,
    filters,
    actor,
  });

  return result;
}

export async function exportTallyInvoices(
  actor?: { id: number; name: string; role?: string }
) {
  const invoices = await prisma.document.findMany({
    where: notDeleted,
    orderBy: { createdAt: "desc" },
    include: {
      vendor: { select: { name: true } },
    },
  });

  const exportable = invoices.filter(isExportableInvoice);
  const selected = pickBestInvoiceForExport(exportable);
  const excludedCount = invoices.length - selected.length;

  const rows = selected.map((doc) => {
    const subtotal = doc.subtotal ?? doc.totalAmount ?? 0;
    const gst = computeGstBreakdown({
      subtotal,
      tax: doc.tax ?? 0,
      cgst: doc.cgst,
      sgst: doc.sgst,
      igst: doc.igst,
      gstPercent: doc.gstPercent,
    });

    return {
      "Invoice Number": doc.invoiceNumber ?? "",
      Vendor: doc.vendorName ?? doc.vendor?.name ?? "",
      Subtotal: subtotal,
      CGST: gst.cgst,
      SGST: gst.sgst,
      IGST: gst.igst,
      "Total Tax": gst.totalTax,
      "Grand Total": doc.totalAmount ?? subtotal + gst.totalTax,
      "Invoice Date": doc.invoiceDate ?? formatDate(doc.createdAt),
      Status: doc.status,
      Currency: doc.currency ?? "INR",
    };
  });

  const result = {
    type: "invoices" as const,
    count: rows.length,
    excludedCount,
    totalCount: invoices.length,
    filename: TALLY_EXPORT_LABELS.invoices.filename,
    columns: [...TALLY_INVOICE_COLUMNS],
    rows,
    csv: rowsToCsv(TALLY_INVOICE_COLUMNS, rows),
  };

  await recordExportAudit({
    exportType: "invoices",
    filename: result.filename,
    rowCount: result.count,
    excludedCount,
    filters: DEFAULT_TALLY_EXPORT_FILTERS,
    actor,
  });

  return result;
}

export async function exportTallyPayments(
  actor?: { id: number; name: string; role?: string }
) {
  const payments = await prisma.payment.findMany({
    where: {
      ...notDeleted,
      status: { in: ["SCHEDULED", "READY", "PROCESSING", "PAID"] },
    },
    orderBy: { dueDate: "desc" },
    include: {
      vendor: { select: { name: true } },
      document: {
        select: {
          invoiceNumber: true,
          createdAt: true,
        },
      },
    },
  });

  const rows = payments.map((payment) => {
    const dates = sanitizePaymentDates(
      payment,
      payment.document.createdAt
    );

    return {
      "Payment ID": formatPaymentReference(payment),
      "Invoice Number":
        payment.document.invoiceNumber ?? "",
      Vendor: payment.vendor.name,
      "Payment Method": payment.paymentMethod ?? "",
      "Bank Reference": payment.bankReference ?? "",
      Amount: payment.amount,
      Currency: payment.currency ?? "INR",
      "Due Date": formatDate(dates.dueDate),
      "Payment Date": formatDate(dates.paidDate),
      Status: payment.status,
      "Approval Status":
        payment.approvalStatus ??
        (payment.status === "PAID" ? "APPROVED" : "PENDING"),
    };
  });

  const result = {
    type: "payments" as const,
    count: rows.length,
    excludedCount: 0,
    totalCount: payments.length,
    filename: TALLY_EXPORT_LABELS.payments.filename,
    columns: [...TALLY_PAYMENT_COLUMNS],
    rows,
    csv: rowsToCsv(TALLY_PAYMENT_COLUMNS, rows),
  };

  await recordExportAudit({
    exportType: "payments",
    filename: result.filename,
    rowCount: result.count,
    excludedCount: 0,
    filters: DEFAULT_TALLY_EXPORT_FILTERS,
    actor,
  });

  return result;
}

export async function getTallyExportSummary(
  filters: TallyExportFilters = DEFAULT_TALLY_EXPORT_FILTERS
) {
  const [vendors, pos, invoices, payments, ctx, history] =
    await Promise.all([
      prisma.vendor.findMany({ where: notDeleted }),
      prisma.purchaseOrder.findMany({ where: notDeleted }),
      prisma.document.findMany({ where: notDeleted }),
      prisma.payment.count({ where: notDeleted }),
      buildVendorGovernanceContext(),
      prisma.tallyExportAudit.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  const vendorByName = new Map(
    vendors.map((v) => [v.name.trim().toLowerCase(), v])
  );

  const exportableVendors = vendors.filter((v) =>
    shouldExportVendor(v, ctx, filters)
  ).length;

  let exportablePos = 0;

  for (const po of pos) {
    const vendor = vendorByName.get(
      po.vendorName.trim().toLowerCase()
    );
    const eligible = vendor
      ? shouldExportVendor(vendor, ctx, filters)
      : false;

    if (
      getPoExportIssues(po, eligible).length === 0
    ) {
      exportablePos += 1;
    }
  }

  const exportableInvoices = pickBestInvoiceForExport(
    invoices.filter(isExportableInvoice)
  ).length;

  const readinessPreview = vendors
    .filter((v) => !v.isOcrGenerated)
    .slice(0, 8)
    .map((vendor) => {
      const readiness = computeTallyReadinessScore({
        gstNumber: vendor.gstNumber,
        panNumber: vendor.panNumber,
        email: vendor.email,
        portalEmail: vendor.portalEmail,
        addressLine1: vendor.addressLine1,
        city: vendor.city,
        isVerified: vendor.isVerified,
        isOcrGenerated: vendor.isOcrGenerated,
        isDuplicateGst: ctx.duplicateGstVendorIds.has(vendor.id),
        kycStatus: vendor.kycStatus,
      });

      return {
        vendorCode:
          vendor.vendorCode ?? formatVendorCode(vendor.id),
        vendorName: vendor.name,
        score: readiness.score,
        status: readiness.status,
      };
    });

  return {
    vendors: exportableVendors,
    purchaseOrders: exportablePos,
    invoices: exportableInvoices,
    payments,
    totalVendors: vendors.length,
    totalPurchaseOrders: pos.length,
    totalInvoices: invoices.length,
    excludedVendors: vendors.length - exportableVendors,
    formats: ["CSV"],
    filters,
    readinessPreview,
    exportHistory: history.map((row) => ({
      id: row.id,
      exportType: row.exportType,
      filename: row.filename,
      rowCount: row.rowCount,
      excludedCount: row.excludedCount,
      actorName: row.actorName,
      createdAt: row.createdAt.toISOString(),
    })),
    note: "Governed export — OCR junk, invalid GST, and unverified vendors excluded by default.",
  };
}

export async function listTallyExportHistory(limit = 20) {
  const rows = await prisma.tallyExportAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    exportType: row.exportType,
    filename: row.filename,
    rowCount: row.rowCount,
    excludedCount: row.excludedCount,
    actorName: row.actorName,
    actorRole: row.actorRole,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function exportTallyByType(
  type: TallyExportType,
  filters: TallyExportFilters = DEFAULT_TALLY_EXPORT_FILTERS,
  actor?: { id: number; name: string; role?: string }
) {
  switch (type) {
    case "vendors":
      return exportTallyVendors(filters, actor);
    case "purchase-orders":
      return exportTallyPurchaseOrders(filters, actor);
    case "invoices":
      return exportTallyInvoices(actor);
    case "payments":
      return exportTallyPayments(actor);
    default:
      throw new Error("Unknown export type");
  }
}

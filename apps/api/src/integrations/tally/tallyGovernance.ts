/**
 * Domain: Tally export governance — vendor quality gates, readiness scoring, export filters.
 */
import type { Document, Payment, PurchaseOrder, Vendor } from "@prisma/client";
import prisma from "../../db";
import {
  detectDuplicateGstin,
  validateGstin,
} from "../../services/gstValidation";

export type TallyExportFilters = {
  verifiedOnly: boolean;
  excludeOcr: boolean;
  excludeDuplicates: boolean;
  excludeInvalidGst: boolean;
  excludeDraft: boolean;
};

export const DEFAULT_TALLY_EXPORT_FILTERS: TallyExportFilters = {
  verifiedOnly: true,
  excludeOcr: true,
  excludeDuplicates: true,
  excludeInvalidGst: true,
  excludeDraft: true,
};

const OCR_GARBAGE_PATTERNS = [
  /^invoice\b/i,
  /\binvoice reference\b/i,
  /\bmedical billing\b/i,
  /\bpurchase order\b/i,
  /\bproforma/i,
  /\bpo\s*#\s*\d+/i,
  /\boas-\d+/i,
  /^(draft|statement|receipt|utility bill)\b/i,
  /\bstat(e)?ment\b/i,
  /\bnvoig/i,
];

const TEST_VENDOR_NAMES = new Set([
  "idly",
  "nitant",
  "singh",
  "alex rivera",
  "test vendor",
  "acme vendor",
]);

const DRAFT_VENDOR_STATUSES = new Set([
  "DRAFT",
  "INVITED",
  "PENDING_REVIEW",
  "REJECTED",
]);

export function parseTallyExportFilters(
  query: Record<string, string | undefined>
): TallyExportFilters {
  const bool = (key: keyof TallyExportFilters, fallback: boolean) => {
    const raw = query[key];

    if (raw == null || raw === "") {
      return fallback;
    }

    return raw === "true" || raw === "1";
  };

  return {
    verifiedOnly: bool("verifiedOnly", true),
    excludeOcr: bool("excludeOcr", true),
    excludeDuplicates: bool("excludeDuplicates", true),
    excludeInvalidGst: bool("excludeInvalidGst", true),
    excludeDraft: bool("excludeDraft", true),
  };
}

export function isOcrGarbageVendorName(name: string): boolean {
  const trimmed = name.trim();

  if (trimmed.length < 3) {
    return true;
  }

  if (TEST_VENDOR_NAMES.has(trimmed.toLowerCase())) {
    return true;
  }

  return OCR_GARBAGE_PATTERNS.some((pattern) =>
    pattern.test(trimmed)
  );
}

export function isValidPan(pan: string | null | undefined): boolean {
  if (!pan?.trim()) {
    return false;
  }

  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase());
}

export function formatVendorCode(vendorId: number): string {
  return `V-${String(vendorId).padStart(4, "0")}`;
}

export function computeTallyReadinessScore(input: {
  gstNumber: string | null;
  panNumber: string | null;
  email: string | null;
  portalEmail: string | null;
  addressLine1: string | null;
  city: string | null;
  isVerified: boolean;
  isOcrGenerated: boolean;
  isDuplicateGst: boolean;
  kycStatus: string;
}): { score: number; status: "READY" | "NOT READY" | "REVIEW" } {
  let score = 0;

  const gst = validateGstin(input.gstNumber);
  if (gst.isValid) score += 25;
  if (isValidPan(input.panNumber)) score += 15;
  if (input.email || input.portalEmail) score += 10;
  if (input.addressLine1 && input.city) score += 15;
  if (input.isVerified) score += 20;
  if (!input.isOcrGenerated) score += 10;
  if (!input.isDuplicateGst) score += 5;

  if (input.kycStatus === "VERIFIED") {
    score += 5;
  } else if (input.kycStatus === "PENDING") {
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));

  let status: "READY" | "NOT READY" | "REVIEW" = "NOT READY";

  if (score >= 85 && gst.isValid && input.isVerified) {
    status = "READY";
  } else if (score >= 60) {
    status = "REVIEW";
  }

  return { score, status };
}

export type VendorGovernanceContext = {
  duplicateGstVendorIds: Set<number>;
};

export async function buildVendorGovernanceContext(): Promise<VendorGovernanceContext> {
  const vendors = await prisma.vendor.findMany({
    where: { deletedAt: null, gstNumber: { not: null } },
    select: { id: true, gstNumber: true },
  });

  const gstMap = new Map<string, number[]>();

  for (const vendor of vendors) {
    const gst = vendor.gstNumber?.trim().toUpperCase();

    if (!gst) continue;

    const list = gstMap.get(gst) ?? [];
    list.push(vendor.id);
    gstMap.set(gst, list);
  }

  const duplicateGstVendorIds = new Set<number>();

  for (const ids of gstMap.values()) {
    if (ids.length > 1) {
      for (const id of ids) {
        duplicateGstVendorIds.add(id);
      }
    }
  }

  return { duplicateGstVendorIds };
}

export function getVendorExportIssues(
  vendor: Pick<
    Vendor,
    | "id"
    | "name"
    | "gstNumber"
    | "panNumber"
    | "status"
    | "isVerified"
    | "isOcrGenerated"
    | "kycStatus"
  >,
  ctx: VendorGovernanceContext,
  filters: TallyExportFilters
): string[] {
  const issues: string[] = [];

  if (filters.excludeDraft && DRAFT_VENDOR_STATUSES.has(vendor.status)) {
    issues.push("Draft or inactive vendor status");
  }

  if (filters.excludeOcr) {
    if (vendor.isOcrGenerated || isOcrGarbageVendorName(vendor.name)) {
      issues.push("OCR-generated vendor");
    }
  }

  if (filters.verifiedOnly && !vendor.isVerified) {
    issues.push("Vendor not verified");
  }

  if (filters.excludeInvalidGst) {
    const gst = validateGstin(vendor.gstNumber);

    if (!vendor.gstNumber) {
      issues.push("Missing GSTIN");
    } else if (!gst.isValid) {
      issues.push("Invalid GSTIN");
    }
  }

  if (filters.excludeDuplicates && ctx.duplicateGstVendorIds.has(vendor.id)) {
    issues.push("Duplicate GSTIN");
  }

  if (!isValidPan(vendor.panNumber)) {
    issues.push("Missing or invalid PAN");
  }

  return issues;
}

export function shouldExportVendor(
  vendor: Pick<
    Vendor,
    | "id"
    | "name"
    | "gstNumber"
    | "panNumber"
    | "status"
    | "isVerified"
    | "isOcrGenerated"
    | "kycStatus"
  >,
  ctx: VendorGovernanceContext,
  filters: TallyExportFilters
): boolean {
  return getVendorExportIssues(vendor, ctx, filters).length === 0;
}

export function getComplianceStatusLabel(
  score: number,
  status: "READY" | "NOT READY" | "REVIEW"
): string {
  if (status === "READY") return "COMPLIANT";
  if (status === "REVIEW") return "NEEDS REVIEW";
  return "NOT COMPLIANT";
}

export function computeGstBreakdown(input: {
  subtotal: number;
  tax: number;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  gstPercent?: number | null;
}) {
  if (input.cgst != null || input.sgst != null || input.igst != null) {
    const cgst = input.cgst ?? 0;
    const sgst = input.sgst ?? 0;
    const igst = input.igst ?? 0;
    const totalTax = cgst + sgst + igst;

    return {
      cgst,
      sgst,
      igst,
      totalTax,
      gstPercent:
        input.gstPercent ??
        (input.subtotal > 0
          ? Math.round((totalTax / input.subtotal) * 10000) / 100
          : 0),
    };
  }

  const tax = input.tax ?? 0;
  const subtotal = input.subtotal ?? 0;

  if (tax <= 0 || subtotal <= 0) {
    return {
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
      gstPercent: 0,
    };
  }

  const gstPercent =
    input.gstPercent ??
    Math.round((tax / subtotal) * 10000) / 100;

  return {
    cgst: tax / 2,
    sgst: tax / 2,
    igst: 0,
    totalTax: tax,
    gstPercent,
  };
}

const INVOICE_STATUS_PRIORITY: Record<string, number> = {
  paid: 100,
  approved: 90,
  processed: 80,
  in_review: 70,
  uploaded: 60,
  queued: 50,
  processing: 40,
  rejected: 20,
  blocked: 10,
  failed: 5,
};

export function pickBestInvoiceForExport<T extends Pick<Document, "id" | "invoiceNumber" | "status">>(
  docs: T[]
): T[] {
  const groups = new Map<string, T[]>();

  for (const doc of docs) {
    const key = doc.invoiceNumber?.trim().toUpperCase() ?? `__DOC_${doc.id}`;

    const list = groups.get(key) ?? [];
    list.push(doc);
    groups.set(key, list);
  }

  const selected: T[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      const pa = INVOICE_STATUS_PRIORITY[a.status] ?? 0;
      const pb = INVOICE_STATUS_PRIORITY[b.status] ?? 0;

      if (pb !== pa) return pb - pa;
      return b.id - a.id;
    });

    selected.push(sorted[0]!);
  }

  return selected;
}

export function isExportableInvoice(
  doc: Pick<Document, "status" | "invoiceNumber">
): boolean {
  if (!doc.invoiceNumber?.trim()) {
    return false;
  }

  return !["blocked", "failed", "rejected"].includes(doc.status);
}

export async function isVendorEligibleForPo(
  vendorName: string,
  vendorByName: Map<string, Vendor>,
  ctx: VendorGovernanceContext,
  filters: TallyExportFilters
): Promise<boolean> {
  const vendor = vendorByName.get(vendorName.trim().toLowerCase());

  if (!vendor) {
    return false;
  }

  return shouldExportVendor(vendor, ctx, filters);
}

export function sanitizePaymentDates(payment: Pick<Payment, "dueDate" | "paidDate">, documentCreatedAt: Date) {
  const minValid = new Date("2020-01-01");
  let dueDate = payment.dueDate;
  let paidDate = payment.paidDate;

  if (dueDate.getTime() < minValid.getTime() || dueDate.getTime() < documentCreatedAt.getTime()) {
    dueDate = new Date(documentCreatedAt);
    dueDate.setDate(dueDate.getDate() + 30);
  }

  if (paidDate && paidDate.getTime() < minValid.getTime()) {
    paidDate = null;
  }

  if (paidDate && paidDate.getTime() < dueDate.getTime() - 365 * 24 * 60 * 60 * 1000) {
    paidDate = null;
  }

  return { dueDate, paidDate };
}

export function formatPaymentReference(
  payment: Pick<Payment, "id" | "paymentNumber">
): string {
  return payment.paymentNumber ?? `PAY-LEGACY-${payment.id}`;
}

export async function isDuplicateGstVendor(
  vendorId: number,
  gstNumber: string | null
): Promise<boolean> {
  if (!gstNumber) {
    return false;
  }

  const result = await detectDuplicateGstin(gstNumber, vendorId);
  return result.isDuplicate;
}

export function getPoExportIssues(
  po: Pick<PurchaseOrder, "vendorName" | "status">,
  vendorEligible: boolean
): string[] {
  const issues: string[] = [];

  if (po.status === "DRAFT" || po.status === "CANCELLED") {
    issues.push("Draft or cancelled PO");
  }

  if (!vendorEligible) {
    issues.push("Vendor failed governance checks");
  }

  if (isOcrGarbageVendorName(po.vendorName)) {
    issues.push("OCR garbage vendor on PO");
  }

  return issues;
}

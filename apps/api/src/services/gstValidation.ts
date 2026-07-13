/**
 * Domain: GST Intelligence — validate GSTIN format, extract PAN, detect duplicates.
 */
import prisma from "../db";
import type { RiskLevel } from "@prisma/client";

const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "28", "29", "30", "31",
  "32", "33", "34", "35", "36", "37", "38",
]);

export type GstValidationResult = {
  gstNumber: string;
  isValid: boolean;
  stateCode: string | null;
  panDerived: string | null;
  errors: string[];
};

export function normalizeGstin(
  gstin: string | null | undefined
): string | null {
  if (!gstin?.trim()) {
    return null;
  }

  return gstin.trim().toUpperCase();
}

export function extractPanFromGstin(
  gstin: string | null | undefined
): string | null {
  const normalized = normalizeGstin(gstin);

  if (!normalized || normalized.length < 12) {
    return null;
  }

  return normalized.slice(2, 12);
}

export function validateGstin(
  gstin: string | null | undefined
): GstValidationResult {
  const normalized = normalizeGstin(gstin);
  const errors: string[] = [];

  if (!normalized) {
    return {
      gstNumber: "",
      isValid: false,
      stateCode: null,
      panDerived: null,
      errors: ["GSTIN is required"],
    };
  }

  if (normalized.length !== 15) {
    errors.push("GSTIN must be 15 characters");
  }

  if (!GSTIN_REGEX.test(normalized)) {
    errors.push("GSTIN format is invalid");
  }

  const stateCode = normalized.slice(0, 2);

  if (!STATE_CODES.has(stateCode)) {
    errors.push("Invalid state code in GSTIN");
  }

  const panDerived = extractPanFromGstin(normalized);

  if (panDerived && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panDerived)) {
    errors.push("PAN embedded in GSTIN is invalid");
  }

  return {
    gstNumber: normalized,
    isValid: errors.length === 0,
    stateCode: errors.length === 0 ? stateCode : null,
    panDerived,
    errors,
  };
}

export async function detectDuplicateGstin(
  gstin: string,
  excludeVendorId?: number
): Promise<{ isDuplicate: boolean; vendorIds: number[] }> {
  const normalized = normalizeGstin(gstin);

  if (!normalized) {
    return { isDuplicate: false, vendorIds: [] };
  }

  const vendors = await prisma.vendor.findMany({
    where: {
      gstNumber: {
        equals: normalized,
        mode: "insensitive",
      },
      ...(excludeVendorId
        ? { id: { not: excludeVendorId } }
        : {}),
    },
    select: { id: true },
  });

  return {
    isDuplicate: vendors.length > 0,
    vendorIds: vendors.map((v) => v.id),
  };
}

export async function persistGstValidation(
  gstin: string | null | undefined,
  vendorId?: number
) {
  const result = validateGstin(gstin);
  const now = new Date();

  if (!result.gstNumber) {
    return null;
  }

  return prisma.gstValidation.create({
    data: {
      gstNumber: result.gstNumber,
      vendorId: vendorId ?? null,
      isValid: result.isValid,
      stateCode: result.stateCode,
      panDerived: result.panDerived,
      lastCheckedAt: now,
    },
  });
}

export type ComplianceRiskBreakdown = {
  score: number;
  level: RiskLevel;
  factors: string[];
  reasons: ComplianceRiskReason[];
};

export type ComplianceRiskReason = {
  code: string;
  label: string;
  points: number;
};

export function riskLevelFromScore(
  score: number
): RiskLevel {
  if (score <= 30) {
    return "LOW";
  }

  if (score <= 60) {
    return "MEDIUM";
  }

  return "HIGH";
}

export function calculateComplianceRisk(input: {
  gstNumber?: string | null;
  gstValid?: boolean;
  duplicateGst?: boolean;
  panNumber?: string | null;
  kycStatus?: string | null;
  vendorStatus?: string | null;
  hasExpiredDocument?: boolean;
  hasLatePayments?: boolean;
}): ComplianceRiskBreakdown {
  let score = 0;
  const reasons: ComplianceRiskReason[] = [];

  if (!input.gstNumber?.trim()) {
    score += 25;
    reasons.push({
      code: "MISSING_GST",
      label: "Missing GST",
      points: 25,
    });
  } else if (input.gstValid === false) {
    score += 25;
    reasons.push({
      code: "INVALID_GST",
      label: "Invalid GST format",
      points: 25,
    });
  } else if (input.duplicateGst) {
    score += 25;
    reasons.push({
      code: "DUPLICATE_GST",
      label: "Duplicate GST",
      points: 25,
    });
  }

  if (!input.panNumber?.trim()) {
    score += 15;
    reasons.push({
      code: "MISSING_PAN",
      label: "Missing PAN",
      points: 15,
    });
  }

  const kyc = (input.kycStatus ?? "PENDING").toUpperCase();

  if (kyc === "PENDING" || kyc === "UNDER_REVIEW") {
    score += 20;
    reasons.push({
      code: "KYC_PENDING",
      label: "KYC pending",
      points: 20,
    });
  }

  const activeStatuses = new Set(["ACTIVE", "APPROVED"]);

  if (
    input.vendorStatus &&
    !activeStatuses.has(input.vendorStatus)
  ) {
    score += 10;
    reasons.push({
      code: "INACTIVE_VENDOR",
      label: "Inactive vendor",
      points: 10,
    });
  }

  if (input.hasExpiredDocument) {
    score += 15;
    reasons.push({
      code: "EXPIRED_DOCUMENT",
      label: "Expired document",
      points: 15,
    });
  }

  if (input.hasLatePayments) {
    score += 15;
    reasons.push({
      code: "LATE_PAYMENTS",
      label: "Late payments",
      points: 15,
    });
  }

  const capped = Math.min(100, score);

  return {
    score: capped,
    level: riskLevelFromScore(capped),
    factors: reasons.map((r) => r.label),
    reasons,
  };
}

export async function validateAndStoreVendorGst(
  vendorId: number,
  gstin: string | null | undefined
) {
  const validation = await persistGstValidation(gstin, vendorId);

  if (validation?.panDerived) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { panNumber: true },
    });

    if (!vendor?.panNumber?.trim()) {
      await prisma.vendor.update({
        where: { id: vendorId },
        data: { panNumber: validation.panDerived },
      });
    }
  }

  return validation;
}

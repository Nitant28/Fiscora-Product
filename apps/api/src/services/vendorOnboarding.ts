/**
 * Domain: Vendor onboarding — invite links, document upload, validation, review, and activation.
 * Main exports: inviteVendor, getInviteByToken, uploadVendorDocument, validateVendorOnboarding,
 *   submitVendorForReview, activateVendor, listPendingVendors, REQUIRED_DOCS.
 * Called by: modules/vendor-onboarding/vendor-onboarding.routes.ts.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";
import { updateVendorPaymentTerms } from "./vendorDirectory";
import {
  validateAndStoreVendorGst,
} from "./gstValidation";
import { refreshVendorComplianceScore } from "../modules/compliance/compliance.service";
import type { VendorDocType } from "@prisma/client";

const REQUIRED_DOCS: VendorDocType[] = [
  "GST",
  "PAN",
  "BANK_ACCOUNT",
  "INSURANCE",
  "COMPLIANCE",
  "MSA",
  "NDA",
];

/* --- INVITE & PUBLIC FLOW --- */

export async function inviteVendor(
  email: string,
  vendorName: string,
  actor: string
) {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const vendor = await prisma.vendor.create({
    data: {
      name: vendorName,
      email,
      status: "DRAFT",
    },
  });

  const invite = await prisma.vendorInvite.create({
    data: {
      email,
      token,
      vendorId: vendor.id,
      expiresAt,
    },
  });

  await recordAuditLog(
    "Vendor",
    vendor.id,
    "Vendor Invited",
    actor,
    { newValue: { email, token } }
  );

  return { invite, vendor };
}

export async function getInviteByToken(token: string) {
  return prisma.vendorInvite.findUnique({
    where: { token },
    include: { vendor: true },
  });
}

export async function uploadVendorDocument(
  vendorId: number,
  type: VendorDocType,
  fileName: string,
  fileBuffer: Buffer
) {
  const uploadDir = path.join(process.cwd(), "uploads", "vendor-docs");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(uploadDir, safeName);
  fs.writeFileSync(filePath, fileBuffer);

  const fileUrl = `/files/vendor-docs/${safeName}`;

  const existing =
    await prisma.vendorDocument.findFirst({
      where: { vendorId, type },
    });

  if (existing) {
    const doc = await prisma.vendorDocument.update({
      where: { id: existing.id },
      data: {
        fileName,
        fileUrl,
        status: "PENDING",
        verificationStatus: "PENDING",
        uploadedAt: new Date(),
      },
    });

    await prisma.vendor.update({
      where: { id: vendorId },
      data: { status: "COMPLIANCE_REVIEW" },
    });

    return doc;
  }

  const doc = await prisma.vendorDocument.create({
    data: {
      vendorId,
      type,
      fileName,
      fileUrl,
      status: "PENDING",
      verificationStatus: "PENDING",
      uploadedAt: new Date(),
    },
  });

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: "COMPLIANCE_REVIEW" },
  });

  return doc;
}

export async function validateVendorOnboarding(
  vendorId: number
) {
  const docs =
    await prisma.vendorDocument.findMany({
      where: { vendorId },
    });

  const uploadedTypes = new Set(
    docs.map((d) => d.type)
  );

  const missing = REQUIRED_DOCS.filter(
    (t) => !uploadedTypes.has(t)
  );

  return {
    complete: missing.length === 0,
    missing,
    docs,
  };
}

/* --- REVIEW & ACTIVATION --- */

export async function submitVendorForReview(
  vendorId: number,
  profile: {
    gstNumber?: string;
    panNumber?: string;
    bankAccount?: string;
    contactPerson?: string;
  }
) {
  const validation =
    await validateVendorOnboarding(vendorId);

  if (!validation.complete) {
    throw new Error(
      `Missing documents: ${validation.missing.join(", ")}`
    );
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      ...profile,
      status: "UNDER_REVIEW",
    },
  });

  return validation;
}

export async function activateVendor(
  vendorId: number,
  actor: string,
  options?: {
    paymentTermsDays?: number;
    msmeRegistered?: boolean;
  }
) {
  const validation =
    await validateVendorOnboarding(vendorId);

  if (!validation.complete) {
    throw new Error("Onboarding incomplete");
  }

  const existing =
    await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

  if (!existing) {
    throw new Error("Vendor not found");
  }

  const termsDays =
    options?.paymentTermsDays ??
    existing.paymentTermsDays;

  if (
    termsDays == null ||
    termsDays <= 0
  ) {
    throw new Error(
      "Payment terms required before activation (Net 15/30/45/60/90)"
    );
  }

  if (
    options?.paymentTermsDays != null ||
    options?.msmeRegistered != null ||
    existing.paymentTermsDays == null
  ) {
    await updateVendorPaymentTerms(
      vendorId,
      {
        paymentTermsDays: termsDays,
        msmeRegistered:
          options?.msmeRegistered ??
          existing.msmeRegistered,
      },
      actor
    );
  }

  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: "ACTIVE", kycStatus: "APPROVED" },
  });

  await prisma.vendorDocument.updateMany({
    where: { vendorId },
    data: {
      status: "VERIFIED",
      verificationStatus: "VERIFIED",
    },
  });

  if (existing.gstNumber) {
    await validateAndStoreVendorGst(
      vendorId,
      existing.gstNumber
    );
  }

  await refreshVendorComplianceScore(vendorId);

  await recordAuditLog(
    "Vendor",
    vendorId,
    "Vendor Activated",
    actor,
    { newValue: { status: "ACTIVE" } }
  );

  return vendor;
}

/* --- ADMIN --- */

export async function listPendingVendors() {
  return prisma.vendor.findMany({
    where: {
      deletedAt: null,
      status: {
        in: [
          "DRAFT",
          "UNDER_REVIEW",
          "COMPLIANCE_REVIEW",
        ],
      },
    },
    include: {
      onboardingDocs: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export { REQUIRED_DOCS };

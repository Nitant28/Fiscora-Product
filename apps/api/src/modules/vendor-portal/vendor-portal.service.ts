/**
 * Domain: Vendor Portal — login, profile, documents, dashboard.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import prisma from "../../db";
import { hashPassword, verifyPassword } from "../../lib/auth";
import { recordAuditLog } from "../../lib/audit";
import {
  validateAndStoreVendorGst,
} from "../../services/gstValidation";
import { refreshVendorComplianceScore } from "../compliance/compliance.service";
import type { VendorDocType } from "@prisma/client";

const SESSION_DAYS = 7;

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function loginVendor(
  email: string,
  password: string
) {
  const vendor = await prisma.vendor.findFirst({
    where: {
      portalEmail: email.toLowerCase(),
      portalEnabled: true,
    },
  });

  if (
    !vendor?.portalPasswordHash ||
    !verifyPassword(password, vendor.portalPasswordHash)
  ) {
    return null;
  }

  const token = newToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.vendorPortalSession.create({
    data: {
      vendorId: vendor.id,
      token,
      expiresAt,
    },
  });

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    token,
    vendor: {
      id: vendor.id,
      name: vendor.name,
      email: vendor.portalEmail,
      kycStatus: vendor.kycStatus,
      status: vendor.status,
    },
  };
}

export async function getVendorSession(token: string) {
  const session =
    await prisma.vendorPortalSession.findUnique({
      where: { token },
      include: { vendor: true },
    });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.vendorPortalSession.delete({
        where: { id: session.id },
      });
    }
    return null;
  }

  return session.vendor;
}

export async function getVendorProfile(vendorId: number) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      email: true,
      portalEmail: true,
      gstNumber: true,
      panNumber: true,
      bankAccount: true,
      ifscCode: true,
      msmeNumber: true,
      kycStatus: true,
      status: true,
      riskScore: true,
      contactPerson: true,
      lastLoginAt: true,
      onboardingDocs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  return {
    ...vendor,
    gstin: vendor.gstNumber,
    pan: vendor.panNumber,
  };
}

export async function updateVendorProfile(
  vendorId: number,
  input: {
    gstin?: string;
    pan?: string;
    bankAccount?: string;
    ifscCode?: string;
    msmeNumber?: string;
    contactPerson?: string;
  }
) {
  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      gstNumber: input.gstin?.trim() || undefined,
      panNumber: input.pan?.trim() || undefined,
      bankAccount: input.bankAccount?.trim() || undefined,
      ifscCode: input.ifscCode?.trim() || undefined,
      msmeNumber: input.msmeNumber?.trim() || undefined,
      contactPerson: input.contactPerson?.trim() || undefined,
      kycStatus: "PENDING",
    },
  });

  await recordAuditLog(
    "Vendor",
    vendorId,
    "Vendor Portal Profile Updated",
    vendor.name,
    {
      newValue: {
        gstin: vendor.gstNumber,
        pan: vendor.panNumber,
        kycStatus: vendor.kycStatus,
      },
    }
  );

  if (input.gstin !== undefined) {
    await validateAndStoreVendorGst(vendorId, vendor.gstNumber);
  }

  await refreshVendorComplianceScore(vendorId);

  return getVendorProfile(vendorId);
}

export async function uploadVendorPortalDocument(
  vendorId: number,
  type: VendorDocType,
  fileName: string,
  fileBuffer: Buffer
) {
  const uploadDir = path.join(
    process.cwd(),
    "uploads",
    "vendor-docs"
  );

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

  const doc = existing
    ? await prisma.vendorDocument.update({
        where: { id: existing.id },
        data: {
          fileName,
          fileUrl,
          status: "PENDING",
          verificationStatus: "PENDING",
          uploadedAt: new Date(),
        },
      })
    : await prisma.vendorDocument.create({
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
    data: {
      kycStatus: "UNDER_REVIEW",
      status: "COMPLIANCE_REVIEW",
    },
  });

  await recordAuditLog(
    "Vendor",
    vendorId,
    "Vendor Portal Document Uploaded",
    "Vendor Portal",
    {
      newValue: { type, fileName },
    }
  );

  await refreshVendorComplianceScore(vendorId);

  return doc;
}

export async function getVendorDashboard(vendorId: number) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const [openRfqs, purchaseOrders, invoices, payments] =
    await Promise.all([
      prisma.vendorBid.count({
        where: { vendorId },
      }),
      prisma.purchaseOrder.count({
        where: { vendorName: vendor.name },
      }),
      prisma.document.count({
        where: { vendorId },
      }),
      prisma.payment.count({
        where: { vendorId },
      }),
    ]);

  return {
    rfqs: openRfqs,
    purchaseOrders,
    invoices,
    payments,
  };
}

export async function seedVendorPortalDemo() {
  const passwordHash = hashPassword("fiscora123");

  await prisma.vendor.upsert({
    where: { name: "Dell" },
    create: {
      name: "Dell",
      status: "ACTIVE",
      portalEnabled: true,
      portalEmail: "vendor@fiscora.com",
      portalPasswordHash: passwordHash,
      kycStatus: "APPROVED",
      gstNumber: "29AABCD1234E1Z5",
      panNumber: "AABCD1234E",
    },
    update: {
      portalEnabled: true,
      portalEmail: "vendor@fiscora.com",
      portalPasswordHash: passwordHash,
      kycStatus: "APPROVED",
    },
  });
}

/**
 * Domain: Compliance — vendor GST status, risk scoring, and compliance dashboard.
 */
import prisma from "../../db";
import { notDeleted } from "../../lib/softDelete";
import {
  calculateComplianceRisk,
  detectDuplicateGstin,
  persistGstValidation,
  validateGstin,
  validateAndStoreVendorGst,
  type ComplianceRiskReason,
} from "../../services/gstValidation";
import type { RiskLevel } from "@prisma/client";

export type ComplianceVendorRow = {
  vendorId: number;
  vendorName: string;
  gstNumber: string | null;
  gstValid: boolean | null;
  gstStatus: string;
  panNumber: string | null;
  kycStatus: string;
  complianceRiskScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: string[];
  reasons: ComplianceRiskReason[];
  vendorStatus: string;
};

export type GstIssueRow = {
  vendorId: number;
  vendorName: string;
  gstin: string | null;
  issue: string;
  detectedAt: string;
};

export type ComplianceDrillDown = {
  gstIssues: GstIssueRow[];
  highRiskVendors: ComplianceVendorRow[];
  missingPan: ComplianceVendorRow[];
  pendingKyc: ComplianceVendorRow[];
  expiringDocuments: {
    vendorId: number;
    vendorName: string;
    documentType: string;
    fileName: string;
    expiryDate: string;
  }[];
};

const activeVendorFilter = notDeleted;

export type ComplianceSummary = {
  highRiskVendors: number;
  gstIssues: number;
  missingPan: number;
  pendingKyc: number;
  expiringDocuments: number;
};

async function vendorHasExpiredDocument(
  vendorId: number
): Promise<boolean> {
  const now = new Date();

  const expired = await prisma.vendorDocument.count({
    where: {
      vendorId,
      OR: [
        { verificationStatus: "EXPIRED" },
        { expiryDate: { lt: now } },
      ],
    },
  });

  return expired > 0;
}

async function vendorHasLatePayments(
  vendorId: number
): Promise<boolean> {
  const now = new Date();

  const late = await prisma.payment.count({
    where: {
      vendorId,
      status: { not: "PAID" },
      dueDate: { lt: now },
    },
  });

  return late > 0;
}

async function getLatestGstValidation(
  vendorId: number,
  gstNumber: string | null
) {
  if (!gstNumber) {
    return null;
  }

  return prisma.gstValidation.findFirst({
    where: { vendorId, gstNumber },
    orderBy: { lastCheckedAt: "desc" },
  });
}

export async function computeVendorComplianceRow(
  vendor: {
    id: number;
    name: string;
    gstNumber: string | null;
    panNumber: string | null;
    kycStatus: string;
    status: string;
    complianceRiskScore: number;
    riskLevel: RiskLevel;
  }
): Promise<ComplianceVendorRow> {
  const latestGst = await getLatestGstValidation(
    vendor.id,
    vendor.gstNumber
  );

  let gstValid: boolean | null = null;

  if (vendor.gstNumber) {
    gstValid = latestGst?.isValid ?? validateGstin(vendor.gstNumber).isValid;
  }

  const [hasExpiredDocument, hasLatePayments, duplicateGst] =
    await Promise.all([
      vendorHasExpiredDocument(vendor.id),
      vendorHasLatePayments(vendor.id),
      vendor.gstNumber
        ? detectDuplicateGstin(
            vendor.gstNumber,
            vendor.id
          ).then((d) => d.isDuplicate)
        : Promise.resolve(false),
    ]);

  const risk = calculateComplianceRisk({
    gstNumber: vendor.gstNumber,
    gstValid: gstValid ?? false,
    duplicateGst,
    panNumber: vendor.panNumber,
    kycStatus: vendor.kycStatus,
    vendorStatus: vendor.status,
    hasExpiredDocument,
    hasLatePayments,
  });

  let gstStatus = "MISSING";

  if (vendor.gstNumber) {
    if (duplicateGst && gstValid) {
      gstStatus = "DUPLICATE";
    } else {
      gstStatus = gstValid ? "VALID" : "INVALID";
    }
  }

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    gstNumber: vendor.gstNumber,
    gstValid,
    gstStatus,
    panNumber: vendor.panNumber,
    kycStatus: vendor.kycStatus,
    complianceRiskScore: risk.score,
    riskScore: risk.score,
    riskLevel: risk.level,
    riskFactors: risk.factors,
    reasons: risk.reasons,
    vendorStatus: vendor.status,
  };
}

export async function refreshVendorComplianceScore(
  vendorId: number
) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    return null;
  }

  if (vendor.gstNumber) {
    await validateAndStoreVendorGst(vendorId, vendor.gstNumber);
  }

  const row = await computeVendorComplianceRow(vendor);

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      complianceRiskScore: row.complianceRiskScore,
      riskLevel: row.riskLevel,
    },
  });

  return row;
}

export async function refreshAllVendorComplianceScores() {
  const vendors = await prisma.vendor.findMany({
    where: activeVendorFilter,
    orderBy: { name: "asc" },
  });

  for (const vendor of vendors) {
    await refreshVendorComplianceScore(vendor.id);
  }
}

export async function getComplianceVendors(): Promise<{
  vendors: ComplianceVendorRow[];
  summary: ComplianceSummary;
  drillDown: ComplianceDrillDown;
}> {
  const vendors = await prisma.vendor.findMany({
    where: activeVendorFilter,
    orderBy: { complianceRiskScore: "desc" },
  });

  const rows = await Promise.all(
    vendors.map((vendor) =>
      computeVendorComplianceRow(vendor)
    )
  );

  const drillDown = await buildComplianceDrillDown(rows);

  const now = new Date();
  const expiringCutoff = new Date();
  expiringCutoff.setDate(expiringCutoff.getDate() + 30);

  const [missingPan, pendingKyc] = await Promise.all([
    prisma.vendor.count({
      where: {
        ...activeVendorFilter,
        OR: [
          { panNumber: null },
          { panNumber: "" },
        ],
      },
    }),
    prisma.vendor.count({
      where: {
        ...activeVendorFilter,
        kycStatus: { in: ["PENDING", "UNDER_REVIEW"] },
      },
    }),
  ]);

  const highRiskVendors = rows.filter(
    (row) => row.riskLevel === "HIGH"
  ).length;

  const gstIssuesFromRows = drillDown.gstIssues.length;

  return {
    vendors: rows,
    summary: {
      highRiskVendors,
      gstIssues: gstIssuesFromRows,
      missingPan,
      pendingKyc,
      expiringDocuments: drillDown.expiringDocuments.length,
    },
    drillDown,
  };
}

async function buildComplianceDrillDown(
  rows: ComplianceVendorRow[]
): Promise<ComplianceDrillDown> {
  const now = new Date();
  const expiringCutoff = new Date();
  expiringCutoff.setDate(expiringCutoff.getDate() + 30);

  const gstIssues: GstIssueRow[] = [];

  for (const row of rows) {
    const latest = row.gstNumber
      ? await prisma.gstValidation.findFirst({
          where: {
            vendorId: row.vendorId,
            gstNumber: row.gstNumber,
          },
          orderBy: { lastCheckedAt: "desc" },
        })
      : null;

    const detectedAt =
      latest?.lastCheckedAt.toISOString() ??
      new Date().toISOString();

    if (row.gstStatus === "MISSING") {
      gstIssues.push({
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        gstin: null,
        issue: "Missing GST",
        detectedAt,
      });
    } else if (row.gstStatus === "INVALID") {
      gstIssues.push({
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        gstin: row.gstNumber,
        issue: "Invalid Format",
        detectedAt,
      });
    } else if (row.gstStatus === "DUPLICATE") {
      gstIssues.push({
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        gstin: row.gstNumber,
        issue: "Duplicate GST",
        detectedAt,
      });
    }
  }

  const expiringDocs =
    await prisma.vendorDocument.findMany({
      where: {
        vendor: activeVendorFilter,
        expiryDate: {
          gte: now,
          lte: expiringCutoff,
        },
        verificationStatus: { not: "EXPIRED" },
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

  return {
    gstIssues,
    highRiskVendors: rows.filter(
      (r) => r.riskLevel === "HIGH"
    ),
    missingPan: rows.filter(
      (r) => !r.panNumber?.trim()
    ),
    pendingKyc: rows.filter((r) =>
      ["PENDING", "UNDER_REVIEW"].includes(
        r.kycStatus.toUpperCase()
      )
    ),
    expiringDocuments: expiringDocs.map((doc) => ({
      vendorId: doc.vendor.id,
      vendorName: doc.vendor.name,
      documentType: doc.type,
      fileName: doc.fileName,
      expiryDate: doc.expiryDate!.toISOString(),
    })),
  };
}

export async function getVendorComplianceProfile(
  vendorId: number
) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, ...activeVendorFilter },
    include: {
      onboardingDocs: {
        orderBy: { uploadedAt: "desc" },
      },
      contracts: {
        orderBy: { endDate: "asc" },
        take: 5,
      },
      payments: {
        orderBy: { dueDate: "desc" },
        take: 10,
      },
      gstValidations: {
        orderBy: { lastCheckedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!vendor) {
    return null;
  }

  const compliance = await computeVendorComplianceRow(
    vendor
  );

  const violations = await prisma.auditLog.findMany({
    where: {
      entityType: "Vendor",
      entityId: vendorId,
      action: {
        contains: "Reject",
        mode: "insensitive",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const fraudFlags = await prisma.invoiceFlag.findMany({
    where: {
      document: { vendorId },
      flagCategory: "FRAUD",
      resolved: false,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      document: {
        select: {
          id: true,
          invoiceNumber: true,
        },
      },
    },
  });

  const latestGst = vendor.gstValidations[0] ?? null;

  return {
    vendor: {
      id: vendor.id,
      name: vendor.name,
      email: vendor.email,
      status: vendor.status,
      kycStatus: vendor.kycStatus,
      gstNumber: vendor.gstNumber,
      panNumber: vendor.panNumber,
      msmeNumber: vendor.msmeNumber,
      createdAt: vendor.createdAt.toISOString(),
    },
    compliance: {
      riskScore: compliance.riskScore,
      riskLevel: compliance.riskLevel,
      reasons: compliance.reasons,
      gstStatus: compliance.gstStatus,
    },
    gst: latestGst
      ? {
          isValid: latestGst.isValid,
          stateCode: latestGst.stateCode,
          panDerived: latestGst.panDerived,
          lastCheckedAt: latestGst.lastCheckedAt.toISOString(),
          history: vendor.gstValidations.map((v) => ({
            gstNumber: v.gstNumber,
            isValid: v.isValid,
            lastCheckedAt: v.lastCheckedAt.toISOString(),
          })),
        }
      : null,
    documents: vendor.onboardingDocs.map((doc) => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.fileName,
      verificationStatus: doc.verificationStatus,
      uploadedAt: doc.uploadedAt.toISOString(),
      expiryDate: doc.expiryDate?.toISOString() ?? null,
    })),
    recentViolations: [
      ...violations.map((v) => ({
        id: v.id,
        type: "audit",
        action: v.action,
        actor: v.actor,
        requestId: v.requestId,
        createdAt: v.createdAt.toISOString(),
      })),
      ...fraudFlags.map((f) => ({
        id: f.id,
        type: "fraud_flag",
        action: f.type,
        actor: "System",
        requestId: null,
        message: f.message,
        invoiceId: f.document.id,
        invoiceNumber: f.document.invoiceNumber,
        createdAt: f.createdAt.toISOString(),
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    ),
    payments: vendor.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      dueDate: p.dueDate.toISOString(),
      paidDate: p.paidDate?.toISOString() ?? null,
      isLate:
        p.status !== "PAID" && p.dueDate < new Date(),
    })),
    contracts: vendor.contracts.map((c) => ({
      id: c.id,
      contractNumber: c.contractNumber,
      title: c.title,
      status: c.status,
      endDate: c.endDate.toISOString(),
    })),
  };
}

export async function getComplianceGstRecords() {
  const validations = await prisma.gstValidation.findMany({
    orderBy: { lastCheckedAt: "desc" },
    take: 100,
    include: {
      vendor: {
        select: { id: true, name: true },
      },
    },
  });

  const enriched = await Promise.all(
    validations.map(async (record) => {
      const duplicate = record.isValid
        ? await detectDuplicateGstin(
            record.gstNumber,
            record.vendorId ?? undefined
          )
        : { isDuplicate: false, vendorIds: [] as number[] };

      return {
        id: record.id,
        gstNumber: record.gstNumber,
        vendorId: record.vendorId,
        vendorName: record.vendor?.name ?? null,
        isValid: record.isValid,
        stateCode: record.stateCode,
        panDerived: record.panDerived,
        isDuplicate: duplicate.isDuplicate,
        duplicateVendorIds: duplicate.vendorIds,
        lastCheckedAt: record.lastCheckedAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
      };
    })
  );

  return { validations: enriched };
}

export async function getComplianceRisks() {
  const { vendors, summary } =
    await getComplianceVendors();

  const distribution = vendors.reduce(
    (counts, vendor) => {
      counts[vendor.riskLevel.toLowerCase() as keyof typeof counts] += 1;
      return counts;
    },
    { low: 0, medium: 0, high: 0 }
  );

  const topRisks = vendors
    .filter((v) => v.complianceRiskScore > 0)
    .slice(0, 10);

  return {
    summary,
    distribution,
    topRisks,
    formula: {
      missingGst: 25,
      missingPan: 15,
      kycPending: 20,
      inactiveVendor: 10,
      expiredDocument: 15,
      latePayments: 15,
      bands: {
        low: "0-30",
        medium: "31-60",
        high: "61-100",
      },
    },
  };
}

export async function seedComplianceDemo() {
  await prisma.vendor.updateMany({
    where: { name: "HP" },
    data: {
      gstNumber: null,
      panNumber: null,
      kycStatus: "PENDING",
      status: "ACTIVE",
    },
  });

  await prisma.vendor.updateMany({
    where: { name: "Infosys" },
    data: {
      gstNumber: "INVALIDGST123",
      panNumber: "AAACI1234A",
      kycStatus: "UNDER_REVIEW",
      status: "ACTIVE",
    },
  });

  const dell = await prisma.vendor.findFirst({
    where: { name: "Dell" },
  });

  if (dell?.gstNumber) {
    await persistGstValidation(dell.gstNumber, dell.id);
  }

  if (dell) {
    const hp = await prisma.vendor.findFirst({
      where: { name: "HP" },
    });

    if (hp) {
      await prisma.vendor.update({
        where: { id: hp.id },
        data: { gstNumber: dell.gstNumber },
      });
    }
  }

  const infosys = await prisma.vendor.findFirst({
    where: { name: "Infosys" },
  });

  if (infosys) {
    await persistGstValidation(
      infosys.gstNumber,
      infosys.id
    );

    const existingGstDoc =
      await prisma.vendorDocument.findFirst({
        where: {
          vendorId: infosys.id,
          type: "GST",
        },
      });

    if (existingGstDoc) {
      await prisma.vendorDocument.update({
        where: { id: existingGstDoc.id },
        data: {
          verificationStatus: "EXPIRED",
          status: "EXPIRED",
          expiryDate: new Date("2024-01-01"),
        },
      });
    } else {
      await prisma.vendorDocument.create({
        data: {
          vendorId: infosys.id,
          type: "GST",
          fileName: "gst-cert.pdf",
          fileUrl: "/files/vendor-docs/demo-gst.pdf",
          status: "EXPIRED",
          verificationStatus: "EXPIRED",
          expiryDate: new Date("2024-01-01"),
        },
      });
    }
  }

  const hpVendor = await prisma.vendor.findFirst({
    where: { name: "HP" },
  });

  if (hpVendor) {
    const overduePayment = await prisma.payment.findFirst({
      where: { vendorId: hpVendor.id },
    });

    if (overduePayment) {
      await prisma.payment.update({
        where: { id: overduePayment.id },
        data: {
          dueDate: new Date("2024-06-01"),
          status: "SCHEDULED",
        },
      });
    }
  }

  await refreshAllVendorComplianceScores();
}

/** Maps legacy vendor statuses to lifecycle v2 values. */
export async function migrateVendorLifecycleStatuses() {
  await prisma.vendor.updateMany({
    where: { status: "INVITED" },
    data: { status: "DRAFT" },
  });

  await prisma.vendor.updateMany({
    where: { status: "PENDING_REVIEW" },
    data: { status: "UNDER_REVIEW" },
  });
}

/**
 * Demo data cleanup — enterprise-realistic vendors, contracts, and compliance posture.
 */
import prisma from "../db";
import { notDeleted } from "../lib/softDelete";
import { isOcrGarbageVendorName } from "../integrations/tally/tallyGovernance";
import { refreshVendorComplianceScore } from "../modules/compliance/compliance.service";
import { enrichContractIntelligenceMetadata } from "./contractIntelligenceSeed";
import { seedEnterpriseDepartments } from "../lib/seed/enterpriseDemo";

const OCR_VENDOR_PATTERNS = [
  /^superst0re$/i,
  /^superstore$/i,
  /^invoice$/i,
  /^purchase order$/i,
  /^medical billing/i,
  /^idly$/i,
  /^nitant$/i,
  /^singh$/i,
];

const REALISTIC_VENDORS = [
  "Tata Steel Supply",
  "Reliance Industrial",
  "Infosys",
  "Dell",
  "OfficeMart India",
  "TechServ Automation",
  "Precision Tools India",
];

function isGarbageVendor(name: string) {
  const normalized = name.trim();

  if (isOcrGarbageVendorName(normalized)) {
    return true;
  }

  return OCR_VENDOR_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
}

async function ensureVendor(name: string) {
  return prisma.vendor.upsert({
    where: { name },
    create: {
      name,
      status: "ACTIVE",
      kycStatus: "APPROVED",
      gstNumber: "27AABCT1234A1Z5",
      panNumber: "AABCT1234A",
      isVerified: true,
    },
    update: {
      status: "ACTIVE",
      deletedAt: null,
    },
  });
}

async function reassignContractsFromGarbageVendors() {
  const garbageVendors = await prisma.vendor.findMany({
    where: notDeleted,
    select: { id: true, name: true },
  });

  const targets = garbageVendors.filter((vendor) =>
    isGarbageVendor(vendor.name)
  );

  if (targets.length === 0) {
    return;
  }

  const replacements = await Promise.all(
    REALISTIC_VENDORS.slice(0, 5).map((name) =>
      ensureVendor(name)
    )
  );

  const contracts = await prisma.contract.findMany({
    where: {
      vendorId: { in: targets.map((v) => v.id) },
      ...notDeleted,
    },
  });

  const demoTitles = [
    "Steel Supply Agreement",
    "IT Infrastructure Support",
    "Software License Renewal",
    "Logistics Services Contract",
    "Office Supplies Framework",
  ];

  for (const [index, contract] of contracts.entries()) {
    const vendor =
      replacements[index % replacements.length];

    if (!vendor) {
      continue;
    }

    const title =
      demoTitles[index % demoTitles.length];

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        vendorId: vendor.id,
        title:
          contract.title.startsWith("Contract ") ||
          contract.title === "Legacy Contract"
            ? title
            : contract.title,
        contractNumber: contract.contractNumber.startsWith(
          "CEA-DEMO"
        )
          ? `CTR-ACME-2026-${String(index + 1).padStart(2, "0")}`
          : contract.contractNumber,
        ownerDepartment:
          index % 2 === 0 ? "Procurement" : "IT",
        contractCategory:
          index % 3 === 0 ? "Software" : "Services",
      },
    });
  }

  for (const vendor of targets) {
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { deletedAt: new Date() },
    });
  }
}

async function normalizeComplianceDemo() {
  const compliantVendors = await prisma.vendor.findMany({
    where: {
      ...notDeleted,
      name: {
        in: REALISTIC_VENDORS,
      },
    },
  });

  for (const vendor of compliantVendors) {
    if (vendor.name === "Infosys") {
      continue;
    }

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        kycStatus: "APPROVED",
        panNumber: vendor.panNumber ?? "AABCT1234A",
        gstNumber:
          vendor.gstNumber ?? "27AABCT1234A1Z5",
        riskLevel: "LOW",
        complianceRiskScore: 12,
      },
    });
  }

  const hp = await prisma.vendor.findFirst({
    where: { name: "HP", ...notDeleted },
  });

  if (hp) {
    await prisma.vendor.update({
      where: { id: hp.id },
      data: {
        gstNumber: null,
        panNumber: "AABCH1234A",
        kycStatus: "APPROVED",
        riskLevel: "HIGH",
        complianceRiskScore: 72,
      },
    });
  }

  const infosys = await prisma.vendor.findFirst({
    where: { name: "Infosys", ...notDeleted },
  });

  if (infosys) {
    await prisma.vendor.update({
      where: { id: infosys.id },
      data: {
        gstNumber: "INVALIDGST123",
        panNumber: "AAACI1234A",
        kycStatus: "UNDER_REVIEW",
        riskLevel: "HIGH",
        complianceRiskScore: 68,
      },
    });
  }

  const missingPanVendor = await prisma.vendor.findFirst({
    where: {
      name: "ChemPure Solutions",
      ...notDeleted,
    },
  });

  if (missingPanVendor) {
    await prisma.vendor.update({
      where: { id: missingPanVendor.id },
      data: {
        panNumber: null,
        kycStatus: "APPROVED",
        riskLevel: "MEDIUM",
        complianceRiskScore: 38,
      },
    });
  }

  const dell = await prisma.vendor.findFirst({
    where: { name: "Dell", ...notDeleted },
  });

  if (dell) {
    await prisma.vendor.update({
      where: { id: dell.id },
      data: {
        contactPerson: "Sarah Chen",
        kycStatus: "APPROVED",
        panNumber: dell.panNumber ?? "AABCD1234A",
        gstNumber: dell.gstNumber ?? "27AABCD1234A1Z5",
        riskLevel: "LOW",
        complianceRiskScore: 10,
      },
    });
  }

  const refreshIds = [
    hp?.id,
    infosys?.id,
    missingPanVendor?.id,
    dell?.id,
  ].filter((id): id is number => id != null);

  for (const vendorId of refreshIds) {
    await refreshVendorComplianceScore(vendorId).catch(
      () => null
    );
  }
}

const DEMO_VENDOR_NAMES = [
  /^vendor a$/i,
  /^vendor b$/i,
  /^vendor c$/i,
  /^test vendor$/i,
  /^demo vendor$/i,
  /^sample vendor$/i,
];

const DEPARTMENT_RENAMES: Record<string, string> = {
  "Acme · Production": "Production",
  "Acme · Procurement": "Procurement",
  "Acme · Finance": "Finance",
  "Acme · IT": "IT",
  "Acme · HR": "HR",
  "Acme · Quality": "Quality Assurance",
  "Acme · Logistics": "Logistics",
  "Acme · R&D": "Research & Development",
  "Acme · Maintenance": "Plant Maintenance",
  "Acme · Admin": "Administration",
  "Acme · Sales": "Sales",
  "Acme · Legal": "Legal",
};

const LEGACY_DEPARTMENT_MERGES: Record<string, string> = {
  Engineering: "Production",
  Marketing: "Sales",
  Operations: "Logistics",
};

async function mergeDepartment(
  fromName: string,
  toName: string
) {
  const from = await prisma.department.findUnique({
    where: { name: fromName },
  });

  if (!from) {
    return;
  }

  const to = await prisma.department.findUnique({
    where: { name: toName },
  });

  if (!to) {
    await prisma.department.update({
      where: { id: from.id },
      data: { name: toName },
    });
    return;
  }

  await prisma.user.updateMany({
    where: { departmentId: from.id },
    data: { departmentId: to.id },
  });

  await prisma.purchaseRequest.updateMany({
    where: { departmentId: from.id },
    data: { departmentId: to.id },
  });

  await prisma.department.delete({
    where: { id: from.id },
  });
}

async function normalizeEnterpriseDepartments() {
  for (const [fromName, toName] of Object.entries(
    DEPARTMENT_RENAMES
  )) {
    await mergeDepartment(fromName, toName);
  }

  for (const [fromName, toName] of Object.entries(
    LEGACY_DEPARTMENT_MERGES
  )) {
    await mergeDepartment(fromName, toName);
  }

  await seedEnterpriseDepartments();
}

async function removeDemoVendors() {
  const vendors = await prisma.vendor.findMany({
    where: notDeleted,
    select: { id: true, name: true },
  });

  for (const vendor of vendors) {
    const isDemoVendor = DEMO_VENDOR_NAMES.some((pattern) =>
      pattern.test(vendor.name.trim())
    );

    if (!isDemoVendor) {
      continue;
    }

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { deletedAt: new Date() },
    });
  }
}

async function removeOcrDocuments() {
  const garbageDocs = await prisma.document.findMany({
    where: {
      ...notDeleted,
      OR: [
        { vendorName: { contains: "SuperSt", mode: "insensitive" } },
        { vendorName: { equals: "Invoice", mode: "insensitive" } },
        { vendorName: { contains: "Medical Billing", mode: "insensitive" } },
        { vendorName: { contains: "Purchase Order", mode: "insensitive" } },
        { vendorName: { equals: "Idly", mode: "insensitive" } },
      ],
    },
    take: 50,
  });

  for (const doc of garbageDocs) {
    await prisma.document.update({
      where: { id: doc.id },
      data: { deletedAt: new Date() },
    });
  }
}

export async function runDemoDataCleanup() {
  await normalizeEnterpriseDepartments();
  await removeDemoVendors();
  await reassignContractsFromGarbageVendors();
  await removeOcrDocuments();
  await normalizeComplianceDemo();
  await enrichContractIntelligenceMetadata().catch(
    () => null
  );
}

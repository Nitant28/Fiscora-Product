/**
 * Enterprise manufacturing demo dataset — realistic Indian mid-market company.
 */
import prisma from "../../db";
import { FlagCategory } from "@prisma/client";

export const ENTERPRISE_COMPANY_NAME =
  "Fiscora Manufacturing Pvt Ltd";

export const ENTERPRISE_DEPARTMENTS = [
  { name: "Production", budget: 8500000, utilizationPct: 61 },
  { name: "Procurement", budget: 4200000, utilizationPct: 54 },
  { name: "Finance", budget: 3100000, utilizationPct: 42 },
  { name: "IT", budget: 2800000, utilizationPct: 72 },
  { name: "HR", budget: 1200000, utilizationPct: 45 },
  { name: "Quality Assurance", budget: 900000, utilizationPct: 48 },
  { name: "Logistics", budget: 2400000, utilizationPct: 58 },
  { name: "Research & Development", budget: 5600000, utilizationPct: 67 },
  { name: "Plant Maintenance", budget: 1800000, utilizationPct: 52 },
  { name: "Administration", budget: 750000, utilizationPct: 33 },
  { name: "Sales", budget: 1500000, utilizationPct: 73 },
  { name: "Legal", budget: 600000, utilizationPct: 41 },
] as const;

/** @deprecated use ENTERPRISE_DEPARTMENTS */
export const ACME_DEPARTMENTS = ENTERPRISE_DEPARTMENTS;

const ENTERPRISE_VENDORS = [
  { name: "Tata Steel Supply", gst: "27AAACT2727Q1ZW", spend: 3200000 },
  { name: "Reliance Industrial", gst: "24AAACR5055K1Z7", spend: 2100000 },
  { name: "Bharat Logistics Co", gst: "09AABCB1234E1Z2", spend: 890000 },
  { name: "Precision Tools India", gst: "29AABCP5678F1Z3", spend: 1450000 },
  { name: "ChemPure Solutions", gst: "07AABCC9012G1Z4", spend: 620000 },
  { name: "SecurePack Materials", gst: "19AABCS3456H1Z5", spend: 480000 },
  { name: "PowerGrid Utilities", gst: "33AABCP7890J1Z6", spend: 1100000 },
  { name: "TechServ Automation", gst: "36AABCT1234K1Z7", spend: 1750000 },
  { name: "GreenChem Industries", gst: "06AABCG5678L1Z8", spend: 540000 },
  { name: "FastFreight Express", gst: "22AABCF9012M1Z9", spend: 720000 },
  { name: "SafetyFirst Equipment", gst: "11AABCS3456N1Z0", spend: 380000 },
  { name: "OfficeMart India", gst: "32AABCO7890P1Z1", spend: 290000 },
  { name: "CloudNine Software", gst: "29AABCC1234Q1Z2", spend: 960000 },
  { name: "LegalEase Advisors", gst: "07AABCL5678R1Z3", spend: 450000 },
];

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function seedEnterpriseDepartments() {
  for (const dept of ENTERPRISE_DEPARTMENTS) {
    const spentBudget = Math.round(
      dept.budget * (dept.utilizationPct / 100)
    );
    const reservedBudget = Math.round(dept.budget * 0.08);

    await prisma.department.upsert({
      where: { name: dept.name },
      create: {
        name: dept.name,
        budget: dept.budget,
        spentBudget,
        reservedBudget,
      },
      update: {
        budget: dept.budget,
        spentBudget,
        reservedBudget,
      },
    });
  }
}

export async function seedEnterpriseManufacturingDemo() {
  await seedEnterpriseDepartments();

  for (const vendor of ENTERPRISE_VENDORS) {
    await prisma.vendor.upsert({
      where: { name: vendor.name },
      create: {
        name: vendor.name,
        gstNumber: vendor.gst,
        panNumber: vendor.gst.slice(2, 12),
        status: "ACTIVE",
        kycStatus: "APPROVED",
        totalSpend: vendor.spend,
        invoiceCount: Math.floor(vendor.spend / 150000),
        paymentTermsDays: 30,
        paymentTerms: "Net 30",
      },
      update: {
        totalSpend: vendor.spend,
        gstNumber: vendor.gst,
        panNumber: vendor.gst.slice(2, 12),
      },
    });
  }

  const existingDell = await prisma.vendor.findFirst({
    where: { name: "Dell" },
  });

  if (existingDell) {
    await prisma.vendor.update({
      where: { id: existingDell.id },
      data: {
        totalSpend: 2800000,
        invoiceCount: 18,
        kycStatus: "APPROVED",
      },
    });
  }

  const poCount = await prisma.purchaseOrder.count({
    where: { deletedAt: null },
  });

  if (poCount < 20) {
    const vendors = await prisma.vendor.findMany({
      where: { deletedAt: null },
      take: 10,
    });

    const now = new Date();

    for (let i = 0; i < 15; i++) {
      const vendor = vendors[i % vendors.length];
      if (!vendor) break;

      const poNumber = `FISC-PO-2026-${String(i + 1).padStart(4, "0")}`;

      const exists = await prisma.purchaseOrder.findUnique({
        where: { poNumber },
      });

      if (exists) continue;

      await prisma.purchaseOrder.create({
        data: {
          poNumber,
          vendorName: vendor.name,
          amount: 150000 + i * 45000,
          status: i % 3 === 0 ? "SENT" : i % 3 === 1 ? "RECEIVED" : "ACCEPTED",
          sentAt: addDays(now, -30 + i),
          createdAt: addDays(now, -45 + i),
        },
      });
    }
  }

  const docCount = await prisma.document.count({
    where: { deletedAt: null },
  });

  if (docCount < 30) {
    const vendors = await prisma.vendor.findMany({
      where: { deletedAt: null },
      take: 8,
    });

    for (let i = 0; i < 12; i++) {
      const vendor = vendors[i % vendors.length];
      if (!vendor) break;

      const invoiceNumber = `FISC-INV-2026-${String(i + 100).padStart(4, "0")}`;

      const exists = await prisma.document.findFirst({
        where: { invoiceNumber },
      });

      if (exists) continue;

      await prisma.document.create({
        data: {
          fileName: `${invoiceNumber}.pdf`,
          status: i % 4 === 0 ? "approved" : i % 4 === 1 ? "paid" : "processed",
          vendorName: vendor.name,
          vendorId: vendor.id,
          invoiceNumber,
          totalAmount: 85000 + i * 12000,
          currency: "INR",
          createdAt: addDays(new Date(), -20 + i),
        },
      });
    }
  }

  const fraudCount = await prisma.invoiceFlag.count({
    where: { flagCategory: "FRAUD", resolved: false },
  });

  if (fraudCount < 3) {
    const suspiciousDocs = await prisma.document.findMany({
      where: { deletedAt: null },
      orderBy: { totalAmount: "desc" },
      take: 3,
    });

    const fraudTypes = [
      {
        type: "DUPLICATE_INVOICE",
        message: "Duplicate invoice detected — same amount and vendor within 7 days",
      },
      {
        type: "SPLIT_PURCHASE",
        message: "Split purchase pattern — multiple POs just below approval threshold",
      },
      {
        type: "VENDOR_MISMATCH",
        message: "Invoice vendor GSTIN does not match registered vendor profile",
      },
    ];

    for (const [index, doc] of suspiciousDocs.entries()) {
      const fraud = fraudTypes[index];
      if (!fraud) break;

      const existing = await prisma.invoiceFlag.findFirst({
        where: {
          documentId: doc.id,
          type: fraud.type,
        },
      });

      if (existing) continue;

      await prisma.invoiceFlag.create({
        data: {
          documentId: doc.id,
          type: fraud.type,
          flagCategory: FlagCategory.FRAUD,
          severity: "HIGH",
          message: fraud.message,
        },
      });
    }
  }

  const splitFlagCount =
    await prisma.purchaseRequestFlag.count({
      where: { type: "SPLIT_PURCHASE", resolved: false },
    });

  if (splitFlagCount < 1) {
    const request = await prisma.purchaseRequest.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (request) {
      await prisma.purchaseRequestFlag.create({
        data: {
          requestId: request.id,
          type: "SPLIT_PURCHASE",
          severity: "HIGH",
          message:
            "Related purchase requests from same requester within 48 hours",
        },
      });
    }
  }
}

/** @deprecated use seedEnterpriseManufacturingDemo */
export const seedAcmeManufacturingDemo =
  seedEnterpriseManufacturingDemo;

export async function getEnterpriseDemoSummary() {
  const [
    vendorCount,
    poCount,
    invoiceCount,
    paymentTotal,
    complianceHighRisk,
    fraudAlerts,
  ] = await Promise.all([
    prisma.vendor.count({ where: { deletedAt: null } }),
    prisma.purchaseOrder.count({
      where: { deletedAt: null },
    }),
    prisma.document.count({
      where: { deletedAt: null },
    }),
    prisma.payment.aggregate({
      where: { deletedAt: null, status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.vendor.count({
      where: {
        deletedAt: null,
        riskLevel: "HIGH",
      },
    }),
    prisma.invoiceFlag.count({
      where: {
        flagCategory: "FRAUD",
        resolved: false,
      },
    }),
  ]);

  const spendAggregate = await prisma.vendor.aggregate({
    where: { deletedAt: null },
    _sum: { totalSpend: true },
  });

  return {
    company: ENTERPRISE_COMPANY_NAME,
    totalSpendInr:
      spendAggregate._sum.totalSpend ?? 0,
    totalSpendCr: Number(
      (
        (spendAggregate._sum.totalSpend ?? 0) / 10000000
      ).toFixed(2)
    ),
    vendorCount,
    purchaseOrders: poCount,
    invoices: invoiceCount,
    paidPaymentsInr: paymentTotal._sum.amount ?? 0,
    complianceRisks: complianceHighRisk,
    fraudAlerts,
  };
}

/** @deprecated use getEnterpriseDemoSummary */
export const getAcmeDemoSummary = getEnterpriseDemoSummary;

/** @deprecated use ENTERPRISE_COMPANY_NAME */
export const ACME_COMPANY_NAME = ENTERPRISE_COMPANY_NAME;

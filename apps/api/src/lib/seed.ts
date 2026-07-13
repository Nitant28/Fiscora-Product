/**
 * Demo and enterprise seed routines: idempotent fills for dev/staging and data repair on startup.
 */
import prisma from "../db";
import { hashPassword } from "./auth";
import { seedRbacPermissions } from "../services/rbac";
import { resolveApprover } from "./audit";
import { seedDepartmentsIfEmpty } from "../modules/departments/department.service";
import { reconcileBudgetReservations } from "../services/budgetEngine";
import {
  backfillRequestCategories,
  seedSpendCategoriesIfEmpty,
} from "../services/spendCategories";
import { refreshAllVendorProcurementScores } from "../services/procurementScoring";
import { seedVendorPortalDemo } from "../modules/vendor-portal/vendor-portal.service";
import { seedComplianceDemo, migrateVendorLifecycleStatuses } from "../modules/compliance/compliance.service";
import {
  seedEnterpriseManufacturingDemo,
} from "./seed/enterpriseDemo";
import { assignSlaOnRequest } from "../services/slaEngine";
import { seedNotificationTemplatesIfEmpty, processContractExpiryNotifications } from "../services/notificationService";
import { runTallyDataGovernanceRepairs } from "../integrations/tally/tallyDataCleanup";
import { seedInitialBackupIfEmpty } from "../services/backupEngine";
import { enrichContractIntelligenceMetadata } from "../services/contractIntelligenceSeed";
import { runDemoDataCleanup } from "../services/demoDataCleanup";
import { seedSavingsIntelligenceDemo } from "../services/savingsIntelligenceSeed";
import { prismaRaw } from "../db";
import { runWithTenantId } from "./tenantContext";
import {
  seedBillingCatalog,
  ensureTenantSubscription,
} from "../services/billing.service";
import { syncContractStatuses } from "../services/contractRisk";

/* --- TENANT --- */
/** Ensures the default tenant exists for single-company demo / backfill. */
export async function ensureDefaultTenant() {
  return prismaRaw.tenant.upsert({
    where: { slug: "default" },
    update: { name: "Default Company", onboardingComplete: true },
    create: {
      name: "Default Company",
      slug: "default",
      onboardingComplete: true,
    },
  });
}

/* --- UTILITIES --- */
function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/* --- PAYMENT & CONTRACT REPAIRS --- */
/** Pushes stale unpaid payments forward so CFO cash-forecast charts have future due dates. */
export async function backfillPaymentDueDates() {
  const now = new Date();
  const staleCutoff = addDays(now, -30);

  const stalePayments =
    await prisma.payment.findMany({
      where: {
        status: {
          in: [
            "SCHEDULED",
            "READY",
            "PROCESSING",
          ],
        },
        dueDate: { lt: staleCutoff },
      },
      orderBy: { id: "asc" },
    });

  const offsets = [7, 14, 21, 30, 45, 60, 75, 90];

  for (const [index, payment] of stalePayments.entries()) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        dueDate: addDays(
          now,
          offsets[index % offsets.length]!
        ),
      },
    });
  }
}

/** Syncs contract ACTIVE/EXPIRING/EXPIRED status with endDate relative to now. */
export async function normalizeContractStatuses() {
  await syncContractStatuses();
}

/* --- CFO DEMO PAYMENTS --- */
/** Creates scheduled payments at staggered offsets when fewer than six unpaid rows exist. */
export async function seedCfoUpcomingPayments() {
  const now = new Date();
  const targetOffsets = [7, 14, 30, 45, 60, 75, 90];

  const unpaid =
    await prisma.payment.findMany({
      where: {
        status: {
          in: [
            "SCHEDULED",
            "READY",
            "PROCESSING",
          ],
        },
      },
      orderBy: { dueDate: "asc" },
    });

  if (unpaid.length >= 6) {
    return;
  }

  const vendors =
    await prisma.vendor.findMany({
      take: 3,
      orderBy: { totalSpend: "desc" },
    });

  if (vendors.length === 0) {
    return;
  }

  for (const [index, offset] of targetOffsets.entries()) {
    const vendor =
      vendors[index % vendors.length]!;

    const existing =
      await prisma.payment.findFirst({
        where: {
          vendorId: vendor.id,
          status: {
            in: [
              "SCHEDULED",
              "READY",
              "PROCESSING",
            ],
          },
          dueDate: {
            gte: addDays(now, offset - 2),
            lte: addDays(now, offset + 2),
          },
        },
      });

    if (existing) {
      continue;
    }

    const amount = 250000 + index * 50000;

    const document =
      await prisma.document.create({
        data: {
          status: "approved",
          vendorId: vendor.id,
          vendorName: vendor.name,
          invoiceNumber: `CFO-SEED-${String(index + 1).padStart(2, "0")}`,
          invoiceDate: now
            .toISOString()
            .slice(0, 10),
          totalAmount: amount,
        },
      });

    await prisma.payment.create({
      data: {
        vendorId: vendor.id,
        documentId: document.id,
        amount,
        dueDate: addDays(now, offset),
        status: "SCHEDULED",
      },
    });
  }
}

/* --- APPROVAL RULES --- */
/** Seeds tiered amount/department/category rules when no enterprise rules exist yet. */
export async function seedApprovalRulesIfEmpty() {
  const hasEnterpriseRules =
    await prisma.approvalRule.findFirst({
      where: {
        department: { not: null },
      },
    });

  if (hasEnterpriseRules) {
    return;
  }

  await prisma.approvalRule.createMany({
    data: [
      {
        name: "IT department override",
        department: "IT",
        minAmount: 0,
        maxAmount: 50000,
        approver: "Director",
        priority: 30,
      },
      {
        name: "Manager approval",
        minAmount: 0,
        maxAmount: 50000,
        approver: "Manager",
        priority: 20,
      },
      {
        name: "Director approval",
        minAmount: 50000,
        maxAmount: 500000,
        approver: "Director",
        priority: 15,
      },
      {
        name: "CFO approval",
        minAmount: 500000,
        approver: "CFO",
        priority: 10,
      },
    ],
  });
}

/* --- VENDOR DEMO DATA --- */
const VENDOR_ENRICHMENTS: Record<
  string,
  {
    preferredVendor?: boolean;
    paymentTerms?: string;
    paymentTermsDays?: number;
    msmeRegistered?: boolean;
    contactPerson?: string;
    contractExpiry?: Date;
    onTimeDeliveryRate?: number;
  }
> = {
  Dell: {
    preferredVendor: true,
    paymentTerms: "Net 60",
    paymentTermsDays: 60,
    msmeRegistered: false,
    contactPerson: "Sarah Chen",
    contractExpiry: new Date("2027-06-30"),
    onTimeDeliveryRate: 94,
  },
  HP: {
    preferredVendor: false,
    paymentTerms: "Net 45",
    paymentTermsDays: 45,
    msmeRegistered: true,
    contactPerson: "James Park",
    contractExpiry: new Date("2026-12-31"),
    onTimeDeliveryRate: 88,
  },
  Infosys: {
    preferredVendor: false,
    paymentTerms: "Net 30",
    paymentTermsDays: 30,
    msmeRegistered: false,
    contactPerson: "Ravi Mehta",
    onTimeDeliveryRate: 91,
  },
  Amazon: {
    preferredVendor: true,
    paymentTerms: "Net 15",
    paymentTermsDays: 15,
    msmeRegistered: false,
    contactPerson: "Sarah Chen",
    onTimeDeliveryRate: 97,
  },
};

/** Upserts core demo vendors and applies enrichment fields (terms, SLA metrics, etc.). */
export async function seedVendorMetadata() {
  const demoVendors = [
    { name: "Dell", paymentTermsDays: 60, paymentTerms: "Net 60" },
    { name: "HP", paymentTermsDays: 45, paymentTerms: "Net 45" },
    { name: "Infosys", paymentTermsDays: 30, paymentTerms: "Net 30" },
  ];

  for (const vendor of demoVendors) {
    await prisma.vendor.upsert({
      where: { name: vendor.name },
      create: {
        name: vendor.name,
        status: "ACTIVE",
        paymentTermsDays: vendor.paymentTermsDays,
        paymentTerms: vendor.paymentTerms,
      },
      update: {},
    });
  }

  for (const [name, fields] of Object.entries(
    VENDOR_ENRICHMENTS
  )) {
    await prisma.vendor.updateMany({
      where: { name },
      data: fields,
    });
  }
}

/* --- USERS & RBAC --- */
/** Creates default role-based demo users when the user table is empty. */
export async function seedUsersIfEmpty() {
  const count = await prisma.user.count();
  if (count > 0) {
    return;
  }

  const sales = await prisma.department.findUnique({
    where: { name: "Sales" },
  });
  const procurement = await prisma.department.findUnique({
    where: { name: "Procurement" },
  });
  const it = await prisma.department.findUnique({
    where: { name: "IT" },
  });

  const demoPassword = hashPassword("fiscora123");

  await prisma.user.createMany({
    data: [
      {
        email: "admin@fiscora.com",
        name: "Reshma",
        passwordHash: demoPassword,
        role: "ADMIN",
      },
      {
        email: "employee@fiscora.com",
        name: "Rahul Sharma",
        passwordHash: demoPassword,
        role: "EMPLOYEE",
        departmentId: sales?.id,
      },
      {
        email: "manager@fiscora.com",
        name: "Anika Patel",
        passwordHash: demoPassword,
        role: "MANAGER",
        departmentId: procurement?.id,
      },
      {
        email: "director@fiscora.com",
        name: "Vikram Desai",
        passwordHash: demoPassword,
        role: "DIRECTOR",
      },
      {
        email: "cfo@fiscora.com",
        name: "Meera Iyer",
        passwordHash: demoPassword,
        role: "CFO",
      },
      {
        email: "procurement@fiscora.com",
        name: "Priya Procurement",
        passwordHash: demoPassword,
        role: "PROCUREMENT",
      },
      {
        email: "finance@fiscora.com",
        name: "Rajesh Kapoor",
        passwordHash: demoPassword,
        role: "FINANCE",
      },
      {
        email: "auditor@fiscora.com",
        name: "Ava Auditor",
        passwordHash: demoPassword,
        role: "AUDITOR",
      },
    ],
  });
}

/** Ensures FINANCE and AUDITOR demo accounts exist after RBAC matrix changes. */
export async function seedDemoRbacUsers() {
  const demoPassword = hashPassword("fiscora123");
  const extras = [
    {
      email: "finance@fiscora.com",
      name: "Frank Finance",
      role: "FINANCE" as const,
    },
    {
      email: "auditor@fiscora.com",
      name: "Ava Auditor",
      role: "AUDITOR" as const,
    },
  ];

  for (const user of extras) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        name: user.name,
        passwordHash: demoPassword,
        role: user.role,
      },
      update: {
        name: user.name,
        role: user.role,
      },
    });
  }
}

/* --- CATALOG & CONTRACTS --- */
/** Adds a standard IT catalog item linked to Dell when catalog is empty. */
export async function seedCatalogIfEmpty() {
  const count = await prisma.catalogItem.count();
  if (count > 0) {
    return;
  }

  let dell = await prisma.vendor.findFirst({
    where: { name: { contains: "Dell", mode: "insensitive" } },
  });

  if (!dell) {
    dell = await prisma.vendor.create({
      data: {
        name: "Dell",
        preferredVendor: true,
        status: "ACTIVE",
        paymentTerms: "Net 60",
        paymentTermsDays: 60,
        contactPerson: "Sarah Chen",
      },
    });
  }

  const it = await prisma.department.findUnique({
    where: { name: "IT" },
  });

  await prisma.catalogItem.create({
    data: {
      name: "Dell Latitude 7450",
      description:
        "Approved IT laptop — standard configuration",
      vendorId: dell.id,
      price: 85000,
      departmentId: it?.id,
      active: true,
    },
  });
}

/** Seeds sample active contracts for top vendors when none exist. */
export async function seedContractsIfEmpty() {
  const count = await prisma.contract.count();
  if (count > 0) {
    return;
  }

  let dell = await prisma.vendor.findFirst({
    where: { name: "Dell" },
  });

  if (!dell) {
    dell = await prisma.vendor.findFirst({
      orderBy: { totalSpend: "desc" },
    });
  }

  const now = new Date();

  if (dell) {
    await prisma.contract.create({
      data: {
        contractNumber: "CTR-DELL-SUPPORT-2026",
        title: "Dell Support Contract",
        vendorId: dell.id,
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: addDays(now, 365),
        value: 450000,
        annualValue: 450000,
        autoRenew: true,
        renewalNoticeDays: 90,
        ownerDepartment: "IT",
        contractCategory: "Hardware Support",
        status: "ACTIVE",
      },
    });
  }

  const secondary =
    await prisma.vendor.findFirst({
      where: {
        id: dell ? { not: dell.id } : undefined,
      },
      orderBy: { totalSpend: "desc" },
    });

  if (secondary) {
    await prisma.contract.create({
      data: {
        contractNumber: "CTR-SECONDARY-2026",
        title: "Secondary Vendor Agreement",
        vendorId: secondary.id,
        startDate: new Date(now.getFullYear() - 1, 0, 1),
        endDate: new Date(now.getFullYear(), 11, 31),
        value: 120000,
        annualValue: 120000,
        autoRenew: false,
        renewalNoticeDays: 60,
        ownerDepartment: "Procurement",
        contractCategory: "Services",
        status: "ACTIVE",
      },
    });
  }
}

/* --- DEMO REPAIRS & BACKFILLS --- */
/** Lightweight repair pass: payments, contracts, notifications (safe to re-run). */
export async function runDemoDataRepairs() {
  await runTallyDataGovernanceRepairs();
  await runDemoDataCleanup().catch(console.error);
  await seedSavingsIntelligenceDemo().catch(console.error);
  await seedInitialBackupIfEmpty().catch(console.error);
  await enrichContractIntelligenceMetadata().catch(console.error);
  await backfillPaymentDueDates();
  await normalizeContractStatuses();
  await seedCfoUpcomingPayments();
  await seedNotificationTemplatesIfEmpty();
  await processContractExpiryNotifications().catch(
    console.error
  );
}

/** Assigns approver + SLA to submitted requests missing assignedApprover. */
async function backfillAssignedApprovers() {
  const missing =
    await prisma.purchaseRequest.findMany({
      where: {
        status: "SUBMITTED",
        assignedApprover: null,
      },
      include: { department: true },
    });

  for (const req of missing) {
    const approver =
      (await resolveApprover({
        amount: req.estimatedAmount,
        department: req.department?.name ?? null,
        category: req.category ?? null,
      })) ?? "Manager";

    await assignSlaOnRequest(req.id, approver);
  }
}

/* --- ENTERPRISE SEED ORCHESTRATION --- */
/** Full startup seed: departments, rules, vendors, users, catalog, repairs, and scoring backfills. */
export async function runEnterpriseSeeds() {
  const tenant = await ensureDefaultTenant();

  await seedBillingCatalog();
  await ensureTenantSubscription(tenant.id);

  await runWithTenantId(tenant.id, async () => {
    await seedDepartmentsIfEmpty();
    await seedSpendCategoriesIfEmpty();
    await seedApprovalRulesIfEmpty();
    await seedVendorMetadata();
    await seedUsersIfEmpty();
    await seedDemoRbacUsers();
    await seedRbacPermissions();
    await seedVendorPortalDemo();
    await migrateVendorLifecycleStatuses();
    await seedComplianceDemo();
    await seedEnterpriseManufacturingDemo();
    await seedCatalogIfEmpty();
    await seedContractsIfEmpty();
    await runDemoDataRepairs();
    await backfillRequestCategories();
    await backfillAssignedApprovers();
    await reconcileBudgetReservations();
    await refreshAllVendorProcurementScores();
  });
}

/** @alias runEnterpriseSeeds — used by apps/api/scripts/seed.ts */
export const seedDatabase = runEnterpriseSeeds;

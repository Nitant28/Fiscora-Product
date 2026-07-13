/**
 * Domain: Executive reporting — cross-functional KPIs (compliance, risk, budgets, savings, contracts).
 * Main exports: calculateExecutiveAnalytics, calculateVendorSpend, calculateCategoryAnalytics (re-export).
 * Called by: server.ts; scripts/verify-vendor-concentration-risk.ts, verify-contract-expiry-alerts.ts.
 */
import prisma from "../db";
import { calculateCategoryAnalytics } from "./categoryAnalytics";
import { calculateVariance } from "../modules/purchase-orders/purchase-order.service";
import {
  budgetUtilization,
  calculateAvailableBudget,
} from "./budgetEngine";
import { getSavingsThisMonth, getTotalSavings } from "./savingsEngine";
import { getRFQSavingsThisMonth, getTotalRFQSavings } from "./rfqSavings";
import { savingsRate } from "./budgetEngine";
import { getPolicyViolationSummary } from "./splitPurchaseFraud";
import {
  getTopVendorDependencyRisk,
  getVendorRiskExposure,
} from "./vendorRisk";
import { getContractExposureSummary } from "./contractUtilization";
import {
  getContractExpirySummary,
  getExpiringContracts,
} from "./contractAlerts";

const MIN_APPROVALS_FOR_AVG_TIME = 5;

export interface ExecutiveAnalyticsData {
  poProgramActive: boolean;
  poCompliancePercent: number | null;
  invoicesWaitingApproval: number;
  pendingRequestApprovals: number;
  averageApprovalTimeHours: number | null;
  hasEnoughApprovalData: boolean;
  duplicateInvoiceCount: number;
  policyViolations: {
    duplicateInvoices: number;
    splitPurchases: number;
    approvalBypassAttempts: number;
    total: number;
  };
  vendorRiskExposure: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  topVendorDependency: {
    name: string;
    spend: number;
    share: number;
    risk: string;
  } | null;
  contractExposure: {
    activeContracts: number;
    totalValue: number;
    utilized: number;
    remaining: number;
    criticalExpirations: number;
    within30Days: number;
    within60Days: number;
    within90Days: number;
  };
  expiringContracts: {
    id: number;
    contractNumber: string;
    title: string;
    vendorName: string;
    daysRemaining: number;
    severity: string;
    renewalRequired: boolean;
  }[];
  budgetUtilization: {
    department: string;
    budget: number;
    spentBudget: number;
    reservedBudget: number;
    committedBudget: number;
    available: number;
    utilization: number;
  }[];
  departmentSpend: {
    department: string;
    budget: number;
    reservedBudget: number;
    committedBudget: number;
    spentBudget: number;
    available: number;
  }[];
  monthlySpendTrend: {
    month: string;
    spend: number;
  }[];
  topVendors: {
    vendor: string;
    spend: number;
  }[];
  poCycleTimeHours: number | null;
  poSavingsThisMonth: number;
  rfqSavingsThisMonth: number;
  totalSavingsThisMonth: number;
  poSavingsTotal: number;
  rfqSavingsTotal: number;
  totalSavings: number;
  savingsRate: number;
  /** @deprecated use totalSavingsThisMonth */
  savingsThisMonth: number;
}

export interface VendorSpendRow {
  vendor: string;
  spend: number;
  invoiceCount: number;
}

/* --- EXECUTIVE DASHBOARD --- */

export async function calculateExecutiveAnalytics(): Promise<ExecutiveAnalyticsData> {
  const [
    purchaseOrderCount,
    invoicesWithPo,
    waitingApproval,
    pendingRequests,
    approvals,
    duplicateCount,
    departments,
    vendors,
    allInvoices,
    pos,
    poSavingsThisMonth,
    rfqSavingsThisMonth,
    poSavingsTotal,
    rfqSavingsTotal,
    approvedSpend,
    policyViolations,
    vendorRiskExposure,
    topVendorDependency,
    contractExposure,
    contractExpirySummary,
    expiringContractAlerts,
  ] = await Promise.all([
    prisma.purchaseOrder.count(),

    prisma.document.findMany({
      where: {
        purchaseOrderId: { not: null },
        totalAmount: { not: null },
      },
      include: { purchaseOrder: true },
    }),

    prisma.document.count({
      where: { status: "processed" },
    }),

    prisma.purchaseRequest.count({
      where: { status: "SUBMITTED" },
    }),

    prisma.approvalHistory.findMany({
      where: { action: "APPROVE" },
      include: {
        document: {
          select: { createdAt: true },
        },
      },
    }),

    prisma.document.count({
      where: { status: "blocked" },
    }),

    prisma.department.findMany(),

    prisma.vendor.findMany({
      orderBy: { totalSpend: "desc" },
      take: 5,
      select: {
        name: true,
        totalSpend: true,
      },
    }),

    prisma.document.findMany({
      where: {
        totalAmount: { not: null },
        status: {
          in: [
            "processed",
            "approved",
            "paid",
          ],
        },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    }),

    prisma.purchaseOrder.findMany({
      where: {
        sentAt: { not: null },
        receivedAt: { not: null },
      },
      select: {
        sentAt: true,
        receivedAt: true,
      },
    }),

    getSavingsThisMonth(),
    getRFQSavingsThisMonth(),
    getTotalSavings(),
    getTotalRFQSavings(),
    prisma.document.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: { in: ["approved", "paid"] },
        totalAmount: { not: null },
      },
    }),
    getPolicyViolationSummary(),
    getVendorRiskExposure(),
    getTopVendorDependencyRisk(),
    getContractExposureSummary(),
    getContractExpirySummary(),
    getExpiringContracts(),
  ]);

  const poProgramActive =
    purchaseOrderCount > 0;

  let compliant = 0;

  for (const doc of invoicesWithPo) {
    if (
      !doc.purchaseOrder ||
      doc.totalAmount == null
    ) {
      continue;
    }

    const { withinTolerance } =
      calculateVariance(
        doc.purchaseOrder.amount,
        doc.totalAmount
      );

    if (withinTolerance) {
      compliant++;
    }
  }

  const poCompliancePercent =
    poProgramActive &&
    invoicesWithPo.length > 0
      ? Math.round(
          (compliant /
            invoicesWithPo.length) *
            100
        )
      : null;

  let totalHours = 0;
  let approvalCount = 0;

  for (const entry of approvals) {
    if (!entry.document) {
      continue;
    }

    const ms =
      entry.createdAt.getTime() -
      entry.document.createdAt.getTime();

    totalHours += ms / (1000 * 60 * 60);
    approvalCount++;
  }

  const hasEnoughApprovalData =
    approvalCount >=
    MIN_APPROVALS_FOR_AVG_TIME;

  const averageApprovalTimeHours =
    hasEnoughApprovalData
      ? Math.round(
          (totalHours / approvalCount) *
            10
        ) / 10
      : null;

  const budgetUtilizationRows =
    departments.map((d) => ({
      department: d.name,
      budget: d.budget,
      spentBudget: d.spentBudget,
      reservedBudget: d.reservedBudget,
      committedBudget: d.committedBudget,
      available: calculateAvailableBudget(
        d.budget,
        d.reservedBudget,
        d.committedBudget,
        d.spentBudget
      ),
      utilization: Math.round(
        budgetUtilization(
          d.spentBudget,
          d.budget
        )
      ),
    }));

  const departmentSpend =
    departments.map((d) => ({
      department: d.name,
      budget: d.budget,
      reservedBudget: d.reservedBudget,
      committedBudget: d.committedBudget,
      spentBudget: d.spentBudget,
      available: calculateAvailableBudget(
        d.budget,
        d.reservedBudget,
        d.committedBudget,
        d.spentBudget
      ),
    }));

  const monthMap = new Map<
    string,
    number
  >();

  for (const inv of allInvoices) {
    const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(
      key,
      (monthMap.get(key) ?? 0) +
        (inv.totalAmount ?? 0)
    );
  }

  const monthlySpendTrend = [...monthMap.entries()]
    .sort(([a], [b]) =>
      a.localeCompare(b)
    )
    .slice(-6)
    .map(([month, spend]) => ({
      month,
      spend,
    }));

  let poCycleTimeHours: number | null =
    null;

  if (pos.length >= 3) {
    let totalMs = 0;
    for (const po of pos) {
      if (po.sentAt && po.receivedAt) {
        totalMs +=
          po.receivedAt.getTime() -
          po.sentAt.getTime();
      }
    }
    poCycleTimeHours =
      Math.round(
        (totalMs /
          pos.length /
          (1000 * 60 * 60)) *
          10
      ) / 10;
  }

  const totalSavingsThisMonth =
    poSavingsThisMonth + rfqSavingsThisMonth;
  const totalSavings =
    poSavingsTotal + rfqSavingsTotal;
  const totalSpend =
    approvedSpend._sum.totalAmount ?? 0;

  return {
    poProgramActive,
    poCompliancePercent,
    invoicesWaitingApproval:
      waitingApproval,
    pendingRequestApprovals:
      pendingRequests,
    averageApprovalTimeHours,
    hasEnoughApprovalData,
    duplicateInvoiceCount:
      duplicateCount,
    policyViolations,
    vendorRiskExposure,
    topVendorDependency,
    contractExposure: {
      ...contractExposure,
      ...contractExpirySummary,
    },
    expiringContracts:
      expiringContractAlerts
        .slice(0, 5)
        .map((alert) => ({
          id: alert.id,
          contractNumber:
            alert.contractNumber,
          title: alert.title,
          vendorName: alert.vendorName,
          daysRemaining:
            alert.daysRemaining,
          severity: alert.severity,
          renewalRequired:
            alert.renewalRequired,
        })),
    budgetUtilization: budgetUtilizationRows,
    departmentSpend,
    monthlySpendTrend,
    topVendors: vendors.map((v) => ({
      vendor: v.name,
      spend: v.totalSpend,
    })),
    poCycleTimeHours,
    poSavingsThisMonth,
    rfqSavingsThisMonth,
    totalSavingsThisMonth,
    poSavingsTotal,
    rfqSavingsTotal,
    totalSavings,
    savingsRate: savingsRate(
      totalSavings,
      totalSpend
    ),
    savingsThisMonth: totalSavingsThisMonth,
  };
}

/* --- VENDOR SPEND --- */

export async function calculateVendorSpend(): Promise<
  VendorSpendRow[]
> {
  const vendors =
    await prisma.vendor.findMany({
      orderBy: { totalSpend: "desc" },
      select: {
        name: true,
        totalSpend: true,
        invoiceCount: true,
      },
    });

  return vendors.map((v) => ({
    vendor: v.name,
    spend: v.totalSpend,
    invoiceCount: v.invoiceCount,
  }));
}

export { calculateCategoryAnalytics };

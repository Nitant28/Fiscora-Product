/**
 * Domain: Executive operations — real-time procurement control tower KPIs and risk rollups.
 * Main exports: getControlTowerData.
 * Called by: server.ts; scripts/verify-contract-expiry-alerts.ts, verify-vendor-concentration-risk.ts.
 */
import prisma from "../db";
import { resolveApprover } from "../lib/audit";
import { getExpiringContracts } from "./contractAlerts";
import { getContractRiskSummary } from "./contractRisk";
import { getSavingsThisMonth } from "./savingsEngine";
import { getRFQSavingsThisMonth } from "./rfqSavings";
import {
  getCashForecast,
} from "./cfoDashboard";
import {
  getMsmePaymentAlerts,
  getPaymentsCompletedThisMonth,
} from "./paymentEngine";
import {
  budgetUtilization,
  calculateAvailableBudget,
  totalBudgetUtilization,
} from "./budgetEngine";
import {
  getFraudAlertCount,
  getFraudAlerts,
} from "./fraudDetection";
import {
  getSplitPurchaseAlertCount,
  getSplitPurchaseAlerts,
} from "./splitPurchaseFraud";
import {
  getHighConcentrationVendorCount,
  getTopVendorDependencyRisk,
} from "./vendorRisk";

export async function getControlTowerData() {
  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const [
    pendingRequests,
    pendingInvoices,
    posAwaitingReceipt,
    posAwaitingAcceptance,
    posInTransit,
    posPartiallyReceived,
    posFullyReceived,
    posClosed,
    departments,
    monthlyInvoices,
    pos,
    auditRecent,
    expiringContracts,
    contractRiskSummary,
    poSavingsThisMonth,
    rfqSavingsThisMonth,
    cashFlowForecast,
    msmePaymentAlerts,
    paymentsCompletedThisMonth,
    fraudAlertCount,
    fraudAlerts,
    splitPurchaseAlertCount,
    splitPurchaseAlerts,
    highConcentrationVendorCount,
    topVendorDependencyRisk,
  ] = await Promise.all([
    prisma.purchaseRequest.count({
      where: { status: "SUBMITTED" },
    }),

    prisma.document.count({
      where: { status: "processed" },
    }),

    prisma.purchaseOrder.count({
      where: { status: "ACCEPTED" },
    }),

    prisma.purchaseOrder.count({
      where: { status: "SENT" },
    }),

    prisma.purchaseOrder.count({
      where: { status: "ACCEPTED" },
    }),

    prisma.purchaseOrder.count({
      where: { status: "PARTIALLY_RECEIVED" },
    }),

    prisma.purchaseOrder.count({
      where: { status: "RECEIVED" },
    }),

    prisma.purchaseOrder.count({
      where: { status: "CLOSED" },
    }),

    prisma.department.findMany({
      orderBy: { name: "asc" },
    }),

    prisma.document.findMany({
      where: {
        createdAt: { gte: monthStart },
        totalAmount: { not: null },
        status: {
          in: [
            "processed",
            "approved",
            "paid",
          ],
        },
      },
      select: { totalAmount: true },
    }),

    prisma.purchaseOrder.findMany({
      where: {
        receivedAt: { not: null },
        sentAt: { not: null },
      },
      select: {
        sentAt: true,
        receivedAt: true,
      },
    }),

    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),

    getExpiringContracts(now),
    getContractRiskSummary(now),
    getSavingsThisMonth(),
    getRFQSavingsThisMonth(),
    getCashForecast(),
    getMsmePaymentAlerts(),
    getPaymentsCompletedThisMonth(),
    getFraudAlertCount(),
    getFraudAlerts(5),
    getSplitPurchaseAlertCount(),
    getSplitPurchaseAlerts(5),
    getHighConcentrationVendorCount(),
    getTopVendorDependencyRisk(),
  ]);

  const departmentBudgetStatus = departments.map(
    (d) => {
      const encumbered =
        d.reservedBudget +
        d.committedBudget +
        d.spentBudget;
      const utilization = Math.round(
        totalBudgetUtilization(
          encumbered,
          d.budget
        )
      );
      const spentUtilization = Math.round(
        budgetUtilization(
          d.spentBudget,
          d.budget
        )
      );
      const available =
        calculateAvailableBudget(
          d.budget,
          d.reservedBudget,
          d.committedBudget,
          d.spentBudget
        );

      return {
        department: d.name,
        budget: d.budget,
        reservedBudget: d.reservedBudget,
        committedBudget: d.committedBudget,
        spentBudget: d.spentBudget,
        available,
        utilization,
        spentUtilization,
      };
    }
  );

  const departmentsExceeding80 =
    departmentBudgetStatus.filter(
      (d) => d.utilization >= 80
    );
  const departmentsExceeding90 =
    departmentBudgetStatus.filter(
      (d) => d.utilization >= 90
    );
  const departmentsExceeding100 =
    departmentBudgetStatus.filter(
      (d) => d.utilization >= 100
    );

  const budgetAlerts = departmentBudgetStatus.filter(
    (d) => d.utilization >= 90 || d.available <= 0
  );

  const spendThisMonth =
    monthlyInvoices.reduce(
      (s, i) => s + (i.totalAmount ?? 0),
      0
    );

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

  const submittedRequests =
    await prisma.purchaseRequest.findMany({
      where: { status: "SUBMITTED" },
      include: { department: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

  const pendingApprovals = [];

  for (const req of submittedRequests) {
    const approver =
      await resolveApprover({
        amount: req.estimatedAmount,
        department:
          req.department?.name ?? null,
        category: req.category ?? null,
      });

    pendingApprovals.push({
      id: req.id,
      title: req.title,
      amount: req.estimatedAmount,
      requester: req.requester,
      department:
        req.department?.name ?? null,
      approver,
    });
  }

  return {
    pendingRequests,
    pendingApprovals,
    pendingInvoices,
    posAwaitingReceipt,
    posAwaitingAcceptance,
    posInTransit,
    posPartiallyReceived,
    posFullyReceived,
    posClosed,
    budgetAlerts,
    departmentBudgetStatus,
    departmentsExceeding80,
    departmentsExceeding90,
    departmentsExceeding100,
    highConcentrationVendorCount,
    topVendorDependencyRisk,
    spendThisMonth,
    savingsThisMonth: poSavingsThisMonth,
    poSavingsThisMonth,
    rfqSavingsThisMonth,
    totalSavingsThisMonth:
      poSavingsThisMonth + rfqSavingsThisMonth,
    cashOutflow: {
      next7Days: cashFlowForecast.sevenDayOutflow,
      next30Days: cashFlowForecast.thirtyDayOutflow,
      next90Days: cashFlowForecast.ninetyDayOutflow,
    },
    paymentsDueThisWeek:
      cashFlowForecast.sevenDayOutflow,
    paymentsDueThisMonth:
      cashFlowForecast.thirtyDayOutflow,
    paymentsCompletedThisMonth:
      paymentsCompletedThisMonth.totalAmount,
    paymentsCompletedCount:
      paymentsCompletedThisMonth.count,
    msmePaymentAlerts,
    poCycleTimeHours,
    fraudAlertCount,
    fraudAlerts,
    splitPurchaseAlertCount,
    splitPurchaseAlerts,
    riskAlerts: {
      duplicateInvoices: fraudAlertCount,
      splitPurchases: splitPurchaseAlertCount,
      total:
        fraudAlertCount +
        splitPurchaseAlertCount,
    },
    recentActivity: auditRecent,
    expiringContracts: expiringContracts.map(
      (alert) => ({
        id: alert.id,
        contractNumber: alert.contractNumber,
        title: alert.title,
        vendor: alert.vendorName,
        vendorId: alert.vendorId,
        endDate: alert.endDate,
        value: alert.value,
        autoRenew: alert.autoRenew,
        daysRemaining: alert.daysRemaining,
        severity: alert.severity,
        renewalRequired:
          alert.renewalRequired,
      })
    ),
    contractsRequiringAction:
      expiringContracts.filter(
        (alert) => alert.renewalRequired
      ).length,
    contractRisks: contractRiskSummary,
  };
}

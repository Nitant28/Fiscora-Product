/**
 * Sprint 16 — Department budget burn-rate forecasting.
 */
import prisma from "../db";
import { snapshotFromDepartment } from "./budgetEngine";

export async function getBudgetForecasts() {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthsRemaining = 12 - now.getMonth();

  const recentRequests = await prisma.purchaseRequest.groupBy({
    by: ["departmentId"],
    where: {
      createdAt: { gte: monthStart },
      status: { in: ["APPROVED", "CONVERTED_TO_PO", "SUBMITTED"] },
    },
    _sum: { estimatedAmount: true },
  });

  const monthlyBurnByDept = new Map<number, number>();
  for (const row of recentRequests) {
    if (row.departmentId) {
      monthlyBurnByDept.set(
        row.departmentId,
        row._sum.estimatedAmount ?? 0
      );
    }
  }

  const alerts: {
    department: string;
    budget: number;
    spent: number;
    monthlyBurn: number;
    monthsUntilExhausted: number | null;
    severity: "HIGH" | "MEDIUM" | "LOW";
    message: string;
  }[] = [];

  for (const dept of departments) {
    const snap = snapshotFromDepartment(dept);
    const monthlyBurn = monthlyBurnByDept.get(dept.id) ?? dept.spentBudget / Math.max(1, now.getMonth() + 1);
    const remaining = snap.available;
    const monthsUntilExhausted =
      monthlyBurn > 0 ? remaining / monthlyBurn : null;

    let severity: "HIGH" | "MEDIUM" | "LOW" = "LOW";
    let message = "On track";

    if (monthsUntilExhausted != null && monthsUntilExhausted < 2) {
      severity = "HIGH";
      message = `Budget exhausted in ${monthsUntilExhausted.toFixed(1)} months at current burn`;
    } else if (monthsUntilExhausted != null && monthsUntilExhausted < monthsRemaining) {
      severity = "MEDIUM";
      message = `Projected overrun before year-end (${monthsUntilExhausted.toFixed(1)} months runway)`;
    }

    if (severity !== "LOW" || dept.budget > 0) {
      alerts.push({
        department: dept.name,
        budget: Math.round(dept.budget),
        spent: Math.round(dept.spentBudget + dept.committedBudget + dept.reservedBudget),
        monthlyBurn: Math.round(monthlyBurn),
        monthsUntilExhausted:
          monthsUntilExhausted != null
            ? Math.round(monthsUntilExhausted * 10) / 10
            : null,
        severity,
        message,
      });
    }
  }

  return {
    forecasts: alerts.sort((a, b) => {
      const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return rank[a.severity] - rank[b.severity];
    }),
    atRisk: alerts.filter((a) => a.severity !== "LOW").length,
  };
}

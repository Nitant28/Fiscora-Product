/**
 * Domain: Department budgets — utilization metrics, reservations, commits, spend, and reconciliation.
 * Main exports: calculateAvailableBudget, budgetUtilization, snapshotFromDepartment, checkBudgetAvailability,
 *   reserveBudget, releaseBudget, commitBudget, reserveAndCommitBudget, recordBudgetSpend, reconcileBudgetReservations,
 *   plus analytics helpers (forecastSpend, savingsRealized, vendorScore, etc.).
 * Called by: purchase-request.service.ts, department.service.ts, catalog.ts, server.ts, lib/seed.ts;
 *   controlTower.ts, executiveAnalytics.ts, savingsEngine.ts, procurementScoring.ts.
 */
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";

/* --- ANALYTICS HELPERS --- */

export function calculateAvailableBudget(
  total: number,
  reserved: number,
  committed: number,
  spent: number
) {
  return total - reserved - committed - spent;
}

export function budgetUtilization(
  spent: number,
  budget: number
) {
  if (budget <= 0) {
    return 0;
  }
  return (spent / budget) * 100;
}

export function totalBudgetUtilization(
  total: number,
  budget: number
) {
  if (budget <= 0) {
    return 0;
  }
  return (total / budget) * 100;
}

export function budgetBurnRate(
  monthlySpend: number,
  monthlyBudget: number
) {
  if (monthlyBudget <= 0) {
    return 0;
  }
  return (monthlySpend / monthlyBudget) * 100;
}

export function forecastSpend(
  spend: number,
  monthsPassed: number
) {
  if (monthsPassed <= 0) {
    return 0;
  }
  return (spend / monthsPassed) * 12;
}

export function approvalCycleTime(
  requestDate: Date,
  approvedDate: Date
) {
  return approvedDate.getTime() - requestDate.getTime();
}

export function poCycleTimeDays(
  poCreated: Date,
  receivedDate: Date
) {
  const ms =
    receivedDate.getTime() - poCreated.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

export function contractCoverage(
  spendUnderContract: number,
  totalSpend: number
) {
  if (totalSpend <= 0) {
    return 0;
  }
  return (spendUnderContract / totalSpend) * 100;
}

export function savingsRealized(
  requestedPrice: number,
  negotiatedPrice: number
) {
  return requestedPrice - negotiatedPrice;
}

export function savingsRate(
  savings: number,
  totalSpend: number
) {
  if (totalSpend <= 0) {
    return 0;
  }
  return (savings / totalSpend) * 100;
}

export function vendorScore(
  delivery: number,
  quality: number,
  cost: number,
  compliance: number
) {
  return (
    delivery * 0.4 +
    quality * 0.3 +
    cost * 0.2 +
    compliance * 0.1
  );
}

/* --- DEPARTMENT SNAPSHOTS --- */

export type BudgetSnapshot = {
  id: number;
  name: string;
  budget: number;
  reservedBudget: number;
  committedBudget: number;
  spentBudget: number;
  available: number;
};

export function snapshotFromDepartment(dept: {
  id: number;
  name: string;
  budget: number;
  reservedBudget: number;
  committedBudget: number;
  spentBudget: number;
}): BudgetSnapshot {
  return {
    id: dept.id,
    name: dept.name,
    budget: dept.budget,
    reservedBudget: dept.reservedBudget,
    committedBudget: dept.committedBudget,
    spentBudget: dept.spentBudget,
    available: calculateAvailableBudget(
      dept.budget,
      dept.reservedBudget,
      dept.committedBudget,
      dept.spentBudget
    ),
  };
}

export async function getDepartmentBudget(
  departmentId: number
) {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
  });

  if (!dept) {
    return null;
  }

  return snapshotFromDepartment(dept);
}

export async function checkBudgetAvailability(
  departmentId: number,
  amount: number
) {
  const snapshot =
    await getDepartmentBudget(departmentId);

  if (!snapshot) {
    return {
      allowed: false,
      message: "Department not found",
    };
  }

  if (amount > snapshot.available) {
    return {
      allowed: false,
      department: snapshot,
      message: `Budget exceeded. ${snapshot.name} has ${snapshot.available.toFixed(0)} available of ${snapshot.budget.toFixed(0)} total budget (${snapshot.reservedBudget.toFixed(0)} reserved, ${snapshot.committedBudget.toFixed(0)} committed, ${snapshot.spentBudget.toFixed(0)} spent).`,
    };
  }

  return {
    allowed: true,
    department: snapshot,
  };
}

/* --- BUDGET MUTATIONS --- */

export async function reserveBudget(
  departmentId: number,
  amount: number,
  actor: string,
  requestId: number
) {
  const check = await checkBudgetAvailability(
    departmentId,
    amount
  );

  if (!check.allowed) {
    throw new Error(
      check.message ?? "Budget exceeded"
    );
  }

  const before =
    await getDepartmentBudget(departmentId);

  const dept = await prisma.department.update({
    where: { id: departmentId },
    data: {
      reservedBudget: { increment: amount },
    },
  });

  await recordAuditLog(
    "Department",
    departmentId,
    "Budget Reserved",
    actor,
    {
      oldValue: {
        reservedBudget: before?.reservedBudget,
      },
      newValue: {
        reservedBudget: dept.reservedBudget,
      },
      metadata: { requestId, amount },
    }
  );

  return snapshotFromDepartment(dept);
}

export async function releaseBudget(
  departmentId: number,
  amount: number,
  actor: string,
  requestId: number
) {
  const before =
    await getDepartmentBudget(departmentId);

  const dept = await prisma.department.update({
    where: { id: departmentId },
    data: {
      reservedBudget: { decrement: amount },
    },
  });

  await recordAuditLog(
    "Department",
    departmentId,
    "Budget Released",
    actor,
    {
      oldValue: {
        reservedBudget: before?.reservedBudget,
      },
      newValue: {
        reservedBudget: dept.reservedBudget,
      },
      metadata: { requestId, amount },
    }
  );

  return snapshotFromDepartment(dept);
}

export async function commitBudget(
  departmentId: number,
  amount: number,
  actor: string,
  requestId: number
) {
  const before =
    await getDepartmentBudget(departmentId);

  const dept = await prisma.department.update({
    where: { id: departmentId },
    data: {
      reservedBudget: { decrement: amount },
      committedBudget: { increment: amount },
    },
  });

  await recordAuditLog(
    "Department",
    departmentId,
    "Budget Committed",
    actor,
    {
      oldValue: {
        reservedBudget: before?.reservedBudget,
        committedBudget: before?.committedBudget,
      },
      newValue: {
        reservedBudget: dept.reservedBudget,
        committedBudget: dept.committedBudget,
      },
      metadata: { requestId, amount },
    }
  );

  return snapshotFromDepartment(dept);
}

export async function reserveAndCommitBudget(
  departmentId: number,
  amount: number,
  actor: string,
  requestId: number
) {
  const check = await checkBudgetAvailability(
    departmentId,
    amount
  );

  if (!check.allowed) {
    throw new Error(
      check.message ?? "Budget exceeded"
    );
  }

  const before =
    await getDepartmentBudget(departmentId);

  const dept = await prisma.department.update({
    where: { id: departmentId },
    data: {
      committedBudget: { increment: amount },
    },
  });

  await recordAuditLog(
    "Department",
    departmentId,
    "Budget Committed",
    actor,
    {
      oldValue: {
        committedBudget: before?.committedBudget,
      },
      newValue: {
        committedBudget: dept.committedBudget,
      },
      metadata: {
        requestId,
        amount,
        catalogAuto: true,
      },
    }
  );

  return snapshotFromDepartment(dept);
}

export async function recordBudgetSpend(
  departmentId: number,
  amount: number,
  actor: string,
  metadata?: Record<string, unknown>
) {
  const before =
    await getDepartmentBudget(departmentId);

  const dept = await prisma.department.update({
    where: { id: departmentId },
    data: {
      committedBudget: { decrement: amount },
      spentBudget: { increment: amount },
    },
  });

  await recordAuditLog(
    "Department",
    departmentId,
    "Budget Spent",
    actor,
    {
      oldValue: {
        committedBudget: before?.committedBudget,
        spentBudget: before?.spentBudget,
      },
      newValue: {
        committedBudget: dept.committedBudget,
        spentBudget: dept.spentBudget,
      },
      metadata: { amount, ...metadata },
    }
  );

  return snapshotFromDepartment(dept);
}

/* --- RECONCILIATION --- */

export async function reconcileBudgetReservations() {
  const departments =
    await prisma.department.findMany();

  for (const dept of departments) {
    const [submitted, approved] =
      await Promise.all([
        prisma.purchaseRequest.aggregate({
          where: {
            departmentId: dept.id,
            status: "SUBMITTED",
          },
          _sum: { estimatedAmount: true },
        }),
        prisma.purchaseRequest.aggregate({
          where: {
            departmentId: dept.id,
            status: {
              in: ["APPROVED", "CONVERTED_TO_PO"],
            },
          },
          _sum: { estimatedAmount: true },
        }),
      ]);

    const expectedReserved =
      submitted._sum.estimatedAmount ?? 0;
    const expectedCommitted =
      approved._sum.estimatedAmount ?? 0;

    if (
      dept.reservedBudget !== expectedReserved ||
      dept.committedBudget !== expectedCommitted
    ) {
      await prisma.department.update({
        where: { id: dept.id },
        data: {
          reservedBudget: expectedReserved,
          committedBudget: expectedCommitted,
        },
      });
    }
  }
}

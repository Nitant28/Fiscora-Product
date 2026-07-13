import prisma from "../../db";
import {
  checkBudgetAvailability,
  snapshotFromDepartment,
} from "../../services/budgetEngine";
import {
  ENTERPRISE_DEPARTMENTS,
  seedEnterpriseDepartments,
} from "../../lib/seed/enterpriseDemo";

export type BudgetCheckResult = {
  allowed: boolean;
  department?: {
    id: number;
    name: string;
    budget: number;
    reservedBudget: number;
    committedBudget: number;
    spentBudget: number;
    available: number;
    remaining: number;
  };
  message?: string;
};

export async function listDepartments() {
  const departments =
    await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { requests: true } },
      },
    });

  return departments.map((d) => ({
    ...d,
    available: snapshotFromDepartment(d).available,
  }));
}

export async function getDepartment(id: number) {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      requests: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!dept) {
    return null;
  }

  return {
    ...dept,
    available: snapshotFromDepartment(dept).available,
  };
}

export async function checkBudget(
  departmentId: number,
  amount: number
): Promise<BudgetCheckResult> {
  const result =
    await checkBudgetAvailability(
      departmentId,
      amount
    );

  if (!result.department) {
    return {
      allowed: false,
      message: result.message,
    };
  }

  const dept = result.department;

  return {
    allowed: result.allowed,
    department: {
      ...dept,
      remaining: dept.available,
    },
    message: result.message,
  };
}

export async function seedDepartmentsIfEmpty() {
  const count =
    await prisma.department.count();

  if (count > 0) {
    return;
  }

  await seedEnterpriseDepartments();
}

export { ENTERPRISE_DEPARTMENTS };

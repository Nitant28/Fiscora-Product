/**
 * Import Center — CSV bulk import for vendors, users, departments, budgets.
 */
import type { UserRole, VendorStatus } from "@prisma/client";
import prisma from "../db";
import { hashPassword } from "../lib/auth";
import { parseCsv, pick } from "../lib/csvParser";
import { getTenantId } from "../lib/tenantContext";
import { recordAuditLog } from "../lib/audit";

const USER_ROLES = new Set<string>([
  "EMPLOYEE",
  "MANAGER",
  "DIRECTOR",
  "PROCUREMENT",
  "FINANCE",
  "CFO",
  "AUDITOR",
  "ADMIN",
]);

export type ImportRowIssue = {
  row: number;
  message: string;
};

export type ImportResult = {
  imported: number;
  warnings: number;
  failed: number;
  errors: ImportRowIssue[];
  warningsList: ImportRowIssue[];
  jobId?: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parsePaymentTerms(raw: string): { terms: string; days: number } {
  const value = raw.trim();
  if (!value) {
    return { terms: "Net 30", days: 30 };
  }

  const netMatch = value.match(/net\s*(\d+)/i);
  if (netMatch) {
    const days = Number(netMatch[1]);
    return { terms: `Net ${days}`, days: Number.isFinite(days) ? days : 30 };
  }

  const digits = value.replace(/\D/g, "");
  const days = digits ? Number(digits) : 30;
  return { terms: value, days: Number.isFinite(days) ? days : 30 };
}

async function recordImportJob(input: {
  fileName: string;
  entity: string;
  successCount: number;
  warningCount: number;
  failedCount: number;
  actorUserId?: number;
}) {
  return prisma.importJob.create({
    data: {
      fileName: input.fileName,
      entity: input.entity,
      successCount: input.successCount,
      warningCount: input.warningCount,
      failedCount: input.failedCount,
      actorUserId: input.actorUserId,
    },
  });
}

export async function importVendorsFromCsv(
  csvText: string,
  fileName: string,
  actorUserId?: number
): Promise<ImportResult> {
  const { rows } = parseCsv(csvText);
  const errors: ImportRowIssue[] = [];
  const warningsList: ImportRowIssue[] = [];
  let imported = 0;
  let failed = 0;

  const existingNames = new Set(
    (
      await prisma.vendor.findMany({
        select: { name: true },
      })
    ).map((v) => v.name.toLowerCase())
  );

  const seenInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i]!;
    const name = pick(row, "name");
    const email = pick(row, "email");
    const paymentTermsRaw = pick(row, "paymentterms", "payment_terms");

    if (!name) {
      failed++;
      errors.push({ row: rowNum, message: "Name is required" });
      continue;
    }

    const nameKey = name.toLowerCase();
    if (seenInFile.has(nameKey)) {
      failed++;
      errors.push({ row: rowNum, message: `Duplicate vendor name in file: ${name}` });
      continue;
    }
    seenInFile.add(nameKey);

    if (email && !EMAIL_RE.test(email)) {
      failed++;
      errors.push({ row: rowNum, message: `Invalid email: ${email}` });
      continue;
    }

    if (existingNames.has(nameKey)) {
      failed++;
      errors.push({ row: rowNum, message: `Vendor already exists: ${name}` });
      continue;
    }

    const { terms, days } = parsePaymentTerms(paymentTermsRaw);

    if (!paymentTermsRaw) {
      warningsList.push({
        row: rowNum,
        message: `Default payment terms applied for ${name}`,
      });
    }

    await prisma.vendor.create({
      data: {
        name,
        email: email || null,
        paymentTerms: terms,
        paymentTermsDays: days,
        status: "ACTIVE" as VendorStatus,
      },
    });

    existingNames.add(nameKey);
    imported++;
  }

  const job = await recordImportJob({
    fileName,
    entity: "vendors",
    successCount: imported,
    warningCount: warningsList.length,
    failedCount: failed,
    actorUserId,
  });

  await recordAuditLog("ImportJob", job.id, "VENDORS_IMPORTED", "Import Center", {
    actorContext: actorUserId ? { userId: actorUserId } : undefined,
    metadata: { imported, failed, warnings: warningsList.length, fileName },
  });

  return {
    imported,
    warnings: warningsList.length,
    failed,
    errors,
    warningsList,
    jobId: job.id,
  };
}

export async function importDepartmentsFromCsv(
  csvText: string,
  fileName: string,
  actorUserId?: number
): Promise<ImportResult> {
  const { rows } = parseCsv(csvText);
  const errors: ImportRowIssue[] = [];
  const warningsList: ImportRowIssue[] = [];
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i]!;
    const name = pick(row, "name", "department");
    const budgetRaw = pick(row, "budget");

    if (!name) {
      failed++;
      errors.push({ row: rowNum, message: "Department name is required" });
      continue;
    }

    const budget = budgetRaw ? Number(budgetRaw.replace(/,/g, "")) : 0;
    if (budgetRaw && (!Number.isFinite(budget) || budget < 0)) {
      failed++;
      errors.push({ row: rowNum, message: `Invalid budget for ${name}` });
      continue;
    }

    const existing = await prisma.department.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (existing) {
      await prisma.department.update({
        where: { id: existing.id },
        data: { budget: budget || existing.budget },
      });
      warningsList.push({
        row: rowNum,
        message: `Updated existing department: ${name}`,
      });
      imported++;
      continue;
    }

    await prisma.department.create({
      data: {
        name,
        budget: budget || 0,
      },
    });
    imported++;
  }

  const job = await recordImportJob({
    fileName,
    entity: "departments",
    successCount: imported,
    warningCount: warningsList.length,
    failedCount: failed,
    actorUserId,
  });

  await recordAuditLog("ImportJob", job.id, "DEPARTMENTS_IMPORTED", "Import Center", {
    actorContext: actorUserId ? { userId: actorUserId } : undefined,
    metadata: { imported, failed, fileName },
  });

  return {
    imported,
    warnings: warningsList.length,
    failed,
    errors,
    warningsList,
    jobId: job.id,
  };
}

export async function importBudgetsFromCsv(
  csvText: string,
  fileName: string,
  actorUserId?: number
): Promise<ImportResult> {
  const { rows } = parseCsv(csvText);
  const errors: ImportRowIssue[] = [];
  const warningsList: ImportRowIssue[] = [];
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i]!;
    const name = pick(row, "name", "department");
    const budgetRaw = pick(row, "budget");

    if (!name) {
      failed++;
      errors.push({ row: rowNum, message: "Department name is required" });
      continue;
    }

    const budget = Number(budgetRaw.replace(/,/g, ""));
    if (!Number.isFinite(budget) || budget <= 0) {
      failed++;
      errors.push({ row: rowNum, message: "Budget must be greater than 0" });
      continue;
    }

    const dept = await prisma.department.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (!dept) {
      failed++;
      errors.push({ row: rowNum, message: `Department not found: ${name}` });
      continue;
    }

    await prisma.department.update({
      where: { id: dept.id },
      data: { budget },
    });
    imported++;
  }

  const job = await recordImportJob({
    fileName,
    entity: "budgets",
    successCount: imported,
    warningCount: warningsList.length,
    failedCount: failed,
    actorUserId,
  });

  return {
    imported,
    warnings: warningsList.length,
    failed,
    errors,
    warningsList,
    jobId: job.id,
  };
}

export async function importUsersFromCsv(
  csvText: string,
  fileName: string,
  actorUserId?: number,
  options?: { defaultPassword?: string }
): Promise<ImportResult> {
  const { rows } = parseCsv(csvText);
  const errors: ImportRowIssue[] = [];
  const warningsList: ImportRowIssue[] = [];
  let imported = 0;
  let failed = 0;

  const defaultPassword = hashPassword(options?.defaultPassword ?? "Welcome@123");

  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
  });
  const deptByName = new Map(
    departments.map((d) => [d.name.toLowerCase(), d.id])
  );

  const existingEmails = new Set(
    (
      await prisma.user.findMany({ select: { email: true } })
    ).map((u) => u.email.toLowerCase())
  );

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i]!;
    const name = pick(row, "name");
    const email = pick(row, "email").toLowerCase();
    const roleRaw = pick(row, "role").toUpperCase();
    const departmentName = pick(row, "department");

    if (!name) {
      failed++;
      errors.push({ row: rowNum, message: "Name is required" });
      continue;
    }

    if (!email || !EMAIL_RE.test(email)) {
      failed++;
      errors.push({ row: rowNum, message: "Valid email is required" });
      continue;
    }

    if (existingEmails.has(email)) {
      failed++;
      errors.push({ row: rowNum, message: `User already exists: ${email}` });
      continue;
    }

    if (!roleRaw || !USER_ROLES.has(roleRaw)) {
      failed++;
      errors.push({
        row: rowNum,
        message: `Invalid role: ${roleRaw || "(empty)"}`,
      });
      continue;
    }

    let departmentId: number | undefined;
    if (departmentName) {
      departmentId = deptByName.get(departmentName.toLowerCase());
      if (!departmentId) {
        failed++;
        errors.push({
          row: rowNum,
          message: `Department not found: ${departmentName}`,
        });
        continue;
      }
    } else {
      warningsList.push({
        row: rowNum,
        message: `${email} created without department`,
      });
    }

    await prisma.user.create({
      data: {
        name,
        email,
        role: roleRaw as UserRole,
        passwordHash: defaultPassword,
        departmentId,
      },
    });

    existingEmails.add(email);
    imported++;
  }

  const job = await recordImportJob({
    fileName,
    entity: "users",
    successCount: imported,
    warningCount: warningsList.length,
    failedCount: failed,
    actorUserId,
  });

  await recordAuditLog("ImportJob", job.id, "USERS_IMPORTED", "Import Center", {
    actorContext: actorUserId ? { userId: actorUserId } : undefined,
    metadata: { imported, failed, fileName },
  });

  return {
    imported,
    warnings: warningsList.length,
    failed,
    errors,
    warningsList,
    jobId: job.id,
  };
}

export async function listImportJobs(limit = 20) {
  return prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getImportSummary() {
  const tenantId = getTenantId();
  const [departments, users, vendors, rules, jobs] = await Promise.all([
    prisma.department.count(),
    prisma.user.count(),
    prisma.vendor.count({ where: { deletedAt: null } }),
    prisma.approvalRule.count({ where: { active: true } }),
    prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const budgetAgg = await prisma.department.aggregate({
    _sum: { budget: true },
  });

  return {
    tenantId,
    departments,
    users,
    vendors,
    rules,
    totalBudget: budgetAgg._sum.budget ?? 0,
    recentJobs: jobs,
  };
}

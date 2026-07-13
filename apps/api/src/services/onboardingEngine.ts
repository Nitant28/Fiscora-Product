/**
 * Customer onboarding wizard — company setup through go-live.
 */
import prisma, { prismaRaw } from "../db";
import { getTenantId } from "../lib/tenantContext";
import { hashPassword } from "../lib/auth";
import {
  importUsersFromCsv,
  getImportSummary,
} from "./importCenter";

export type OnboardingStep =
  | "company"
  | "departments"
  | "budgets"
  | "users"
  | "rules"
  | "complete";

export const APPROVAL_TEMPLATES = {
  small: [
    { name: "Manager approval", minAmount: 0, maxAmount: 10000, approver: "Manager", priority: 20 },
    { name: "Director approval", minAmount: 10000, approver: "Director", priority: 10 },
  ],
  medium: [
    { name: "Manager approval", minAmount: 0, maxAmount: 10000, approver: "Manager", priority: 30 },
    { name: "Director approval", minAmount: 10000, maxAmount: 50000, approver: "Director", priority: 20 },
    { name: "CFO approval", minAmount: 50000, approver: "CFO", priority: 10 },
  ],
  enterprise: [
    { name: "Manager approval", minAmount: 0, maxAmount: 10000, approver: "Manager", priority: 40 },
    { name: "Director approval", minAmount: 10000, maxAmount: 50000, approver: "Director", priority: 30 },
    { name: "VP Finance approval", minAmount: 50000, maxAmount: 100000, approver: "VP Finance", priority: 20 },
    { name: "CFO approval", minAmount: 100000, approver: "CFO", priority: 10 },
  ],
} as const;

export async function getOnboardingStatus() {
  const tenantId = getTenantId();
  const tenant = await prismaRaw.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    return null;
  }

  const summary = await getImportSummary();
  const hasCompany = Boolean(tenant.name && tenant.name !== "Default Company");
  const hasDepartments = summary.departments > 0;
  const hasBudgets = summary.totalBudget > 0;
  const hasUsers = summary.users > 1;
  const hasRules = summary.rules > 0;

  let currentStep: OnboardingStep = "company";
  if (hasCompany || tenant.industry) currentStep = "departments";
  if (hasDepartments) currentStep = "budgets";
  if (hasBudgets) currentStep = "users";
  if (hasUsers) currentStep = "rules";
  if (hasRules) currentStep = "complete";

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      industry: tenant.industry,
      currency: tenant.currency,
      timezone: tenant.timezone,
      onboardingComplete: tenant.onboardingComplete,
    },
    currentStep,
    summary,
    checklist: {
      company: hasCompany || Boolean(tenant.industry),
      departments: hasDepartments,
      budgets: hasBudgets,
      users: hasUsers,
      rules: hasRules,
    },
  };
}

export async function updateCompanyProfile(input: {
  name: string;
  industry?: string;
  currency?: string;
  timezone?: string;
}) {
  const tenantId = getTenantId();
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `tenant-${tenantId}`;

  return prismaRaw.tenant.update({
    where: { id: tenantId },
    data: {
      name: input.name.trim(),
      slug: tenantId === 1 ? "default" : slug,
      industry: input.industry?.trim() || null,
      currency: input.currency?.trim() || "INR",
      timezone: input.timezone?.trim() || "Asia/Kolkata",
    },
  });
}

export async function createDepartment(input: {
  name: string;
  budget?: number;
}) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Department name is required");
  }

  const existing = await prisma.department.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    return existing;
  }

  return prisma.department.create({
    data: {
      name,
      budget: input.budget && input.budget > 0 ? input.budget : 0,
    },
  });
}

export async function updateDepartmentBudget(
  departmentId: number,
  budget: number
) {
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error("Budget must be greater than 0");
  }

  return prisma.department.update({
    where: { id: departmentId },
    data: { budget },
  });
}

export async function applyApprovalTemplate(
  template: keyof typeof APPROVAL_TEMPLATES
) {
  const rules = APPROVAL_TEMPLATES[template];

  await prisma.approvalRule.updateMany({
    where: { active: true },
    data: { active: false },
  });

  await prisma.approvalRule.createMany({
    data: rules.map((rule) => ({
      name: rule.name,
      minAmount: rule.minAmount,
      maxAmount: "maxAmount" in rule ? rule.maxAmount : null,
      approver: rule.approver,
      priority: rule.priority,
      active: true,
    })),
  });

  return prisma.approvalRule.findMany({
    where: { active: true },
    orderBy: { priority: "desc" },
  });
}

export async function completeOnboarding() {
  const tenantId = getTenantId();

  return prismaRaw.tenant.update({
    where: { id: tenantId },
    data: { onboardingComplete: true },
  });
}

export async function createTenantWithAdmin(input: {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  industry?: string;
  currency?: string;
  timezone?: string;
}) {
  const slug = input.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const existing = await prismaRaw.user.findFirst({
    where: { email: input.adminEmail.toLowerCase() },
  });

  if (existing) {
    throw new Error("Email already registered");
  }

  const tenant = await prismaRaw.tenant.create({
    data: {
      name: input.companyName.trim(),
      slug: `${slug}-${Date.now().toString(36)}`,
      industry: input.industry?.trim(),
      currency: input.currency ?? "INR",
      timezone: input.timezone ?? "Asia/Kolkata",
      onboardingComplete: false,
    },
  });

  const user = await prismaRaw.user.create({
    data: {
      tenantId: tenant.id,
      name: input.adminName.trim(),
      email: input.adminEmail.toLowerCase().trim(),
      passwordHash: hashPassword(input.adminPassword),
      role: "ADMIN",
    },
  });

  return { tenant, user };
}

export { importUsersFromCsv };

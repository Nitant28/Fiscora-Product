/**
 * Domain: Approval Matrix — selects the approving role for spend requests.
 */
import type { ApprovalRule, UserRole } from "@prisma/client";
import prisma from "../db";

export type ApprovalDecision = {
  role: UserRole;
  approver: string;
  ruleId: number | null;
};

const APPROVER_ROLE_BY_TITLE: Record<string, UserRole> = {
  Manager: "MANAGER",
  Director: "DIRECTOR",
  "VP Finance": "DIRECTOR",
  CFO: "CFO",
  "Procurement Head": "PROCUREMENT",
  "Marketing Head": "DIRECTOR",
  "IT Director": "DIRECTOR",
};

function sameValue(
  left?: string | null,
  right?: string | null
) {
  return (
    left?.trim().toLowerCase() ===
    right?.trim().toLowerCase()
  );
}

function specificity(
  rule: ApprovalRule
) {
  if (rule.department && rule.category) {
    return 4;
  }

  if (rule.department) {
    return 3;
  }

  if (rule.category) {
    return 2;
  }

  return 1;
}

function matchesRule(
  rule: ApprovalRule,
  input: {
    amount: number;
    department?: string | null;
    category?: string | null;
  }
) {
  if (input.amount < rule.minAmount) {
    return false;
  }

  if (
    rule.maxAmount != null &&
    input.amount > rule.maxAmount
  ) {
    return false;
  }

  if (
    rule.department &&
    !sameValue(rule.department, input.department)
  ) {
    return false;
  }

  if (
    rule.category &&
    !sameValue(rule.category, input.category)
  ) {
    return false;
  }

  return true;
}

export async function determineApprover(
  amount: number,
  department?: string | null,
  category?: string | null
): Promise<ApprovalDecision> {
  const rules = await prisma.approvalRule.findMany({
    where: { active: true },
  });

  const [selected] = rules
    .filter((rule) =>
      matchesRule(rule, {
        amount,
        department,
        category,
      })
    )
    .sort((a, b) => {
      const specificityDelta =
        specificity(b) - specificity(a);
      if (specificityDelta !== 0) {
        return specificityDelta;
      }

      const priorityDelta =
        b.priority - a.priority;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return b.minAmount - a.minAmount;
    });

  if (!selected) {
    return {
      role: "MANAGER",
      approver: "Manager",
      ruleId: null,
    };
  }

  return {
    role:
      APPROVER_ROLE_BY_TITLE[selected.approver] ??
      "ADMIN",
    approver: selected.approver,
    ruleId: selected.id,
  };
}

/**
 * Domain: Approval SLAs — due dates, escalation chain, and periodic overdue processing.
 * Main exports: computeSlaDueAt, getInitialApproverContext, assignSlaOnRequest, processSlaEscalations, startSlaEngine.
 * Called by: purchase-request.service.ts, server.ts (startSlaEngine), lib/seed.ts.
 */
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";
import {
  notifyEscalation,
  notifyApprovalRequired,
} from "./notifications";

const MANAGER_SLA_HOURS = 24;
const DIRECTOR_SLA_HOURS = 48;

const ESCALATION_CHAIN = [
  { level: 0, approver: "Manager", hours: MANAGER_SLA_HOURS },
  { level: 1, approver: "Director", hours: DIRECTOR_SLA_HOURS },
  { level: 2, approver: "CFO", hours: DIRECTOR_SLA_HOURS },
];

export function computeSlaDueAt(
  escalationLevel: number
) {
  const config =
    ESCALATION_CHAIN[escalationLevel] ??
    ESCALATION_CHAIN[ESCALATION_CHAIN.length - 1]!;

  const due = new Date();
  due.setHours(due.getHours() + config.hours);
  return due;
}

export function getInitialApproverContext(
  assignedApprover: string
) {
  const isManagerTier = [
    "Manager",
    "Marketing Head",
    "IT Director",
    "Procurement Head",
  ].includes(assignedApprover);

  if (isManagerTier) {
    return { level: 0, approver: assignedApprover };
  }

  if (
    assignedApprover === "Director" ||
    assignedApprover === "VP Finance"
  ) {
    return { level: 1, approver: assignedApprover };
  }

  return { level: 2, approver: assignedApprover };
}

/* --- ASSIGNMENT & ESCALATION --- */

export async function assignSlaOnRequest(
  requestId: number,
  assignedApprover: string
) {
  const ctx =
    getInitialApproverContext(assignedApprover);

  await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: {
      assignedApprover: ctx.approver,
      slaEscalationLevel: ctx.level,
      slaDueAt: computeSlaDueAt(ctx.level),
    },
  });
}

export async function processSlaEscalations() {
  const overdue =
    await prisma.purchaseRequest.findMany({
      where: {
        status: "SUBMITTED",
        slaDueAt: { lt: new Date() },
      },
    });

  for (const req of overdue) {
    const currentLevel = req.slaEscalationLevel;
    const nextLevel = currentLevel + 1;

    if (nextLevel >= ESCALATION_CHAIN.length) {
      continue;
    }

    const next =
      ESCALATION_CHAIN[nextLevel]!;

    if (!next) {
      continue;
    }

    const previous =
      req.assignedApprover ?? "Unknown";

    await prisma.purchaseRequest.update({
      where: { id: req.id },
      data: {
        assignedApprover: next.approver,
        slaEscalationLevel: next.level,
        slaDueAt: computeSlaDueAt(next.level),
      },
    });

    await recordAuditLog(
      "PurchaseRequest",
      req.id,
      "SLA Escalated",
      "System",
      {
        oldValue: {
          approver: previous,
          level: currentLevel,
        },
        newValue: {
          approver: next.approver,
          level: next.level,
        },
      }
    );

    await notifyEscalation(
      req.id,
      req.title,
      previous,
      next.approver
    );
  }

  return overdue.length;
}

/* --- BACKGROUND ENGINE --- */

export function startSlaEngine() {
  const intervalMs = 60 * 1000;

  setInterval(() => {
    processSlaEscalations().catch((err) => {
      console.error("SLA engine error:", err);
    });
  }, intervalMs);

  console.log("SLA engine started (60s interval)");
}

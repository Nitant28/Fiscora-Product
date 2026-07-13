/**
 * Immutable audit trail writes, approver resolution from rules, and audit log queries.
 */
import prisma from "../db";
import type { Prisma, UserRole } from "@prisma/client";
import { determineApprover } from "../services/approvalMatrix";
import {
  getRequestId,
  getRequestIp,
  getRequestUserAgent,
} from "./requestContext";

/* --- TYPES --- */
export type AuditActorContext = {
  userId?: number;
  role?: UserRole;
  permission?: string;
};

/* --- AUDIT LOG WRITES --- */
export async function recordAuditLog(
  entityType: string,
  entityId: number,
  action: string,
  actor: string,
  options?: {
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    actorContext?: AuditActorContext;
    reason?: string;
  }
) {
  await prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      actor,
      actorUserId: options?.actorContext?.userId,
      actorRole: options?.actorContext?.role,
      permission: options?.actorContext?.permission,
      requestId: getRequestId(),
      ipAddress: getRequestIp(),
      userAgent: getRequestUserAgent(),
      reason: options?.reason,
      oldValue: options?.oldValue as
        | Prisma.InputJsonValue
        | undefined,
      newValue: options?.newValue as
        | Prisma.InputJsonValue
        | undefined,
      metadata: options?.metadata as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
}

/** @deprecated use recordAuditLog */
export const recordAuditEvent = recordAuditLog;

/** Builds actor context from an authenticated request for recordAuditLog. */
export function auditContextFromRequest(input: {
  user?: {
    id: number;
    role: UserRole;
    name: string;
  } | null;
  permission?: string;
}): AuditActorContext | undefined {
  if (!input.user) {
    return undefined;
  }

  return {
    userId: input.user.id,
    role: input.user.role,
    permission: input.permission,
  };
}

/* --- APPROVAL RULE RESOLUTION --- */
/** @deprecated use determineApprover from services/approvalMatrix */
export async function resolveApprover(input: {
  amount: number;
  department?: string | null;
  category?: string | null;
}): Promise<string | null> {
  const decision = await determineApprover(
    input.amount,
    input.department,
    input.category
  );

  return decision.approver;
}

/* --- AUDIT LOG QUERIES --- */
export async function listAuditLogs(limit = 50) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

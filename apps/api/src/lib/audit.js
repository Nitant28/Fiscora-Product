/**
 * Immutable audit trail writes, approver resolution from rules, and audit log queries.
 */
import prisma from "../db";
import { determineApprover } from "../services/approvalMatrix";
/* --- AUDIT LOG WRITES --- */
export async function recordAuditLog(entityType, entityId, action, actor, options) {
    await prisma.auditLog.create({
        data: {
            entityType,
            entityId,
            action,
            actor,
            actorUserId: options?.actorContext?.userId,
            actorRole: options?.actorContext?.role,
            permission: options?.actorContext?.permission,
            oldValue: options?.oldValue,
            newValue: options?.newValue,
            metadata: options?.metadata,
        },
    });
}
/** @deprecated use recordAuditLog */
export const recordAuditEvent = recordAuditLog;
/** Builds actor context from an authenticated request for recordAuditLog. */
export function auditContextFromRequest(input) {
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
export async function resolveApprover(input) {
    const decision = await determineApprover(input.amount, input.department, input.category);
    return decision.approver;
}
/* --- AUDIT LOG QUERIES --- */
export async function listAuditLogs(limit = 50) {
    return prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}

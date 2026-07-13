/**
 * Domain: In-app notifications — user notification records and role-based approver alerts.
 * Sprint 18C.1: Universal Notification Center with type, severity, entity links, and action URLs.
 */
import type { NotificationSeverity } from "@prisma/client";
import prisma from "../db";
import type { UserRole } from "@prisma/client";
import { APPROVER_ROLE_MAP } from "../lib/auth";
import { getTenantId } from "../lib/tenantContext";

export type NotificationPayload = {
  userId: number;
  title: string;
  message: string;
  type?: string;
  severity?: NotificationSeverity;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
};

function resolvePayload(
  input: NotificationPayload | number,
  title?: string,
  message?: string
): NotificationPayload {
  if (typeof input === "number") {
    return {
      userId: input,
      title: title ?? "",
      message: message ?? "",
    };
  }
  return input;
}

export async function createNotification(
  input: NotificationPayload | number,
  title?: string,
  message?: string
) {
  const payload = resolvePayload(input, title, message);

  return prisma.notification.create({
    data: {
      tenantId: getTenantId(),
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type ?? "GENERAL",
      severity: payload.severity ?? "INFO",
      entityType: payload.entityType ?? null,
      entityId: payload.entityId ?? null,
      actionUrl: payload.actionUrl ?? null,
    },
  });
}

export async function notifyUsersByRoles(
  roles: UserRole[],
  title: string,
  message: string,
  extras?: Omit<NotificationPayload, "userId" | "title" | "message">
) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles } },
    select: { id: true },
  });

  if (!users.length) {
    return [];
  }

  const tenantId = getTenantId();

  await prisma.notification.createMany({
    data: users.map((u) => ({
      tenantId,
      userId: u.id,
      title,
      message,
      type: extras?.type ?? "GENERAL",
      severity: extras?.severity ?? "INFO",
      entityType: extras?.entityType ?? null,
      entityId: extras?.entityId ?? null,
      actionUrl: extras?.actionUrl ?? null,
    })),
  });

  return users;
}

export async function notifyApprover(
  approverTitle: string,
  title: string,
  message: string,
  extras?: Omit<NotificationPayload, "userId" | "title" | "message">
) {
  const roles =
    APPROVER_ROLE_MAP[approverTitle] ?? ["ADMIN"];

  return notifyUsersByRoles(roles, title, message, extras);
}

/* --- INBOX --- */

export async function listNotifications(
  userId: number,
  options?: { limit?: number; unreadOnly?: boolean }
) {
  const limit = options?.limit ?? 50;

  return prisma.notification.findMany({
    where: {
      userId,
      ...(options?.unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(
  userId: number,
  notificationId: number
) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

export async function markAllNotificationsRead(userId: number) {
  return prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

export async function getUnreadCount(userId: number) {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

/* --- WORKFLOW ALERTS --- */

export async function notifyApprovalRequired(
  requestId: number,
  title: string,
  amount: number,
  approverTitle: string
) {
  return notifyApprover(
    approverTitle,
    "Approval required",
    `${title} (₹${amount.toLocaleString()}) awaiting your approval`,
    {
      type: "APPROVAL_REQUIRED",
      severity: "WARNING",
      entityType: "PurchaseRequest",
      entityId: requestId,
      actionUrl: `/requests/${requestId}`,
    }
  );
}

export async function notifyEscalation(
  requestId: number,
  title: string,
  fromApprover: string,
  toApprover: string
) {
  return notifyApprover(
    toApprover,
    "SLA escalation",
    `${title} escalated from ${fromApprover} — approval overdue`,
    {
      type: "SLA_ESCALATION",
      severity: "CRITICAL",
      entityType: "PurchaseRequest",
      entityId: requestId,
      actionUrl: `/requests/${requestId}`,
    }
  );
}

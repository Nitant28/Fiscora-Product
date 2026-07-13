/**
 * Identity Service — the bridge between an external identity provider (Clerk) and
 * the Fiscora User record.
 *
 * Strict boundary:
 *   - This service resolves and links identity ONLY.
 *   - It NEVER assigns or mutates role, tenantId, departmentId, or permissions.
 *     Those are owned by Fiscora and managed elsewhere.
 *
 * Uses prismaRaw (tenant-isolation bypass) because identity resolution happens
 * BEFORE a tenant context exists — we are figuring out *who* the user is, and
 * the user row itself carries the tenantId.
 */
import { prismaRaw } from "../db";
import type { ClerkProfile } from "../lib/clerk";
import type { Prisma, UserRole } from "@prisma/client";
import {
  getRequestId,
  getRequestIp,
  getRequestUserAgent,
} from "../lib/requestContext";

/* --- IDENTITY AUDIT EVENTS --- */
// LoginHistory answers "who logged in"; AuditLog is the forensic action trail.
// These run pre-tenant-context (login), so we write via prismaRaw with explicit tenantId.
export type IdentityAuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_REACTIVATED"
  | "ACCOUNT_DELETED"
  | "INVITATION_SENT"
  | "INVITATION_ACCEPTED"
  | "INVITATION_CANCELLED"
  | "CLERK_LINKED"
  | "FORCE_LOGOUT"
  | "TENANT_SUSPENDED_LOGIN_BLOCKED";

export async function recordIdentityAudit(input: {
  tenantId: number;
  userId?: number;
  actor: string;
  action: IdentityAuditAction;
  role?: UserRole;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prismaRaw.auditLog.create({
      data: {
        tenantId: input.tenantId,
        entityType: "User",
        entityId: input.userId ?? 0,
        action: input.action,
        actor: input.actor,
        actorUserId: input.userId,
        actorRole: input.role,
        reason: input.reason,
        requestId: getRequestId(),
        ipAddress: getRequestIp(),
        userAgent: getRequestUserAgent(),
        metadata: input.metadata as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  } catch (error) {
    console.warn(
      "[identity] recordIdentityAudit failed:",
      error instanceof Error
        ? error.message
        : error
    );
  }
}

const userWithDepartment = {
  include: { department: true },
} as const;

export async function findUserByClerkId(
  clerkId: string
) {
  if (!clerkId) {
    return null;
  }

  return prismaRaw.user.findUnique({
    where: { clerkId },
    ...userWithDepartment,
  });
}

export async function findUserByEmail(
  email: string
) {
  if (!email) {
    return null;
  }

  return prismaRaw.user.findFirst({
    where: { email: email.toLowerCase() },
    ...userWithDepartment,
  });
}

/**
 * Links a Clerk identity to an existing Fiscora user (by email).
 * One-time migration bridge: email → clerkId.
 * Does NOT create users and does NOT touch role/tenant/department.
 */
export async function linkClerkUser(
  email: string,
  clerkId: string
) {
  const user = await findUserByEmail(email);

  if (!user) {
    return {
      ok: false as const,
      reason: "USER_NOT_FOUND" as const,
    };
  }

  // Already linked to a different Clerk account — refuse to silently overwrite.
  if (user.clerkId && user.clerkId !== clerkId) {
    return {
      ok: false as const,
      reason: "ALREADY_LINKED_DIFFERENT" as const,
    };
  }

  // Ensure this Clerk id isn't already claimed by another user.
  const existing = await findUserByClerkId(clerkId);
  if (existing && existing.id !== user.id) {
    return {
      ok: false as const,
      reason: "CLERK_ID_IN_USE" as const,
    };
  }

  // Activate an invited user the moment their identity is established.
  const nextStatus =
    user.status === "INVITED" ? "ACTIVE" : user.status;

  const updated = await prismaRaw.user.update({
    where: { id: user.id },
    data: { clerkId, status: nextStatus },
    ...userWithDepartment,
  });

  // Close out any pending invitation for this user.
  const inv = await markInvitationAccepted(updated.id);

  await recordIdentityAudit({
    tenantId: updated.tenantId,
    userId: updated.id,
    actor: updated.name,
    role: updated.role,
    action: "CLERK_LINKED",
    metadata: { clerkId },
  });

  if (inv.updated > 0) {
    await recordIdentityAudit({
      tenantId: updated.tenantId,
      userId: updated.id,
      actor: updated.name,
      role: updated.role,
      action: "INVITATION_ACCEPTED",
    });
  }

  return { ok: true as const, user: updated };
}

/**
 * Flips this user's pending invitation(s) to ACCEPTED. Idempotent.
 * Matches by userId first, falling back to email so invites created before the
 * user row was linked still close out.
 */
export async function markInvitationAccepted(
  userId: number
) {
  const user = await prismaRaw.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return { updated: 0 };
  }

  const result =
    await prismaRaw.invitation.updateMany({
      where: {
        status: "PENDING",
        OR: [
          { userId: user.id },
          { email: user.email },
        ],
      },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        userId: user.id,
      },
    });

  return { updated: result.count };
}

export type LoginHistoryInput = {
  userId: number;
  tenantId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
  failureReason?: string | null;
};

/**
 * Invalidates all existing sessions/JWTs for a user by stamping sessionsValidFrom
 * to now and deleting legacy session rows. Used by suspend / force-logout.
 */
export async function forceLogout(userId: number) {
  const now = new Date();

  await prismaRaw.user.update({
    where: { id: userId },
    data: { sessionsValidFrom: now },
  });

  await prismaRaw.session.deleteMany({
    where: { userId },
  });

  return { invalidatedAt: now };
}

/**
 * Marks PENDING invitations whose expiresAt has passed as EXPIRED.
 * Designed to be called from a periodic job. Returns the count expired.
 */
export async function expireStaleInvitations() {
  const result =
    await prismaRaw.invitation.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });

  if (result.count > 0) {
    console.log(
      `[identity] Expired ${result.count} stale invitation(s).`
    );
  }

  return { expired: result.count };
}

/** Background job: sweep expired invitations hourly. */
export function startIdentityJobs() {
  const intervalMs = 60 * 60 * 1000;

  // Run once shortly after boot, then hourly.
  setTimeout(() => {
    expireStaleInvitations().catch((err) =>
      console.error("[identity] invitation sweep error:", err)
    );
  }, 10 * 1000);

  setInterval(() => {
    expireStaleInvitations().catch((err) =>
      console.error("[identity] invitation sweep error:", err)
    );
  }, intervalMs);

  console.log("Identity jobs started (invitation expiry, hourly)");
}

/** Appends a login-history record. Best-effort; never throws to the caller. */
export async function recordLoginHistory(
  input: LoginHistoryInput
) {
  try {
    await prismaRaw.loginHistory.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        success: input.success ?? true,
        failureReason: input.failureReason ?? null,
      },
    });
  } catch (error) {
    console.warn(
      "[identity] recordLoginHistory failed:",
      error instanceof Error
        ? error.message
        : error
    );
  }
}

/**
 * Syncs mutable profile fields from the identity provider.
 * Identity fields ONLY (name, email). Never role/tenant/department/permissions.
 */
export async function syncProfile(
  clerkId: string,
  profile: Pick<ClerkProfile, "name" | "email">
) {
  const user = await findUserByClerkId(clerkId);
  if (!user) {
    return null;
  }

  const data: { name?: string; email?: string } = {};

  if (profile.name && profile.name !== user.name) {
    data.name = profile.name;
  }

  if (
    profile.email &&
    profile.email.toLowerCase() !==
      user.email.toLowerCase()
  ) {
    data.email = profile.email.toLowerCase();
  }

  if (Object.keys(data).length === 0) {
    return user;
  }

  return prismaRaw.user.update({
    where: { id: user.id },
    data,
    ...userWithDepartment,
  });
}

/** Records the most recent login time for a user. */
export async function syncLastLogin(userId: number) {
  return prismaRaw.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
    select: { id: true, lastLoginAt: true },
  });
}

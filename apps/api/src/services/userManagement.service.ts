/**
 * Enterprise User Management (Sprint 18B).
 *
 * The system of record for PEOPLE is Fiscora — a User row is created first
 * (with tenant, role, department, approval limit), then Clerk delivers the
 * invitation email and provisions identity. Authorization (role/permissions)
 * is never owned by Clerk.
 *
 * All reads/writes use the tenant-scoped `prisma` client, so a caller can only
 * ever see/manage users within their own tenant. Invitation rows are not in the
 * tenant-extension set, so we scope those explicitly with tenantId.
 */
import crypto from "crypto";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import prisma, { prismaRaw } from "../db";
import { recordAuditLog } from "../lib/audit";
import { createNotification } from "../services/notifications";
import {
  createClerkInvitation,
  revokeClerkInvitation,
} from "../lib/clerk";
import {
  forceLogout as invalidateSessions,
  recordIdentityAudit,
} from "./identityService";
import { getTenantId } from "../lib/tenantContext";

const INVITE_EXPIRY_DAYS = 7;

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  employeeId: true,
  jobTitle: true,
  phone: true,
  approvalLimit: true,
  costCenter: true,
  language: true,
  timezone: true,
  avatarUrl: true,
  departmentId: true,
  managerId: true,
  clerkId: true,
  lastLoginAt: true,
  failedLoginAttempts: true,
  createdAt: true,
  department: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

export type ActorContext = {
  id: number;
  name: string;
  role: UserRole;
};

export type ListUsersFilters = {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  departmentId?: number;
  managerId?: number;
  neverLoggedIn?: boolean;
};

/* --- READ --- */
export async function listUsers(
  filters: ListUsersFilters = {}
) {
  const where: Prisma.UserWhereInput = {};

  if (filters.role) where.role = filters.role;
  if (filters.status) where.status = filters.status;
  if (filters.departmentId)
    where.departmentId = filters.departmentId;
  if (filters.managerId) where.managerId = filters.managerId;
  if (filters.neverLoggedIn) where.lastLoginAt = null;

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { employeeId: { contains: q, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  // Attach pending-invitation status without an N+1: one scoped query.
  const pending = await prismaRaw.invitation.findMany({
    where: {
      tenantId: getTenantId(),
      status: "PENDING",
    },
    select: { email: true },
  });
  const pendingEmails = new Set(
    pending.map((p) => p.email.toLowerCase())
  );

  return users.map((u) => ({
    ...u,
    invitationStatus: u.clerkId
      ? "ACCEPTED"
      : pendingEmails.has(u.email.toLowerCase())
      ? "PENDING"
      : "NONE",
  }));
}

export async function getUser(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userSelect,
      directReports: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  if (!user) return null;

  const [invitation, recentLogins, recentActions] =
    await Promise.all([
      prismaRaw.invitation.findFirst({
        where: {
          tenantId: getTenantId(),
          email: user.email,
        },
        orderBy: { createdAt: "desc" },
      }),
      prismaRaw.loginHistory.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.auditLog.findMany({
        where: { actorUserId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
        },
      }),
    ]);

  return {
    ...user,
    invitation,
    recentLogins,
    recentActions,
  };
}

/* --- HELPERS --- */
function newInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function assertDepartmentInTenant(
  departmentId?: number | null
) {
  if (departmentId == null) return;
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true },
  });
  if (!dept) {
    throw new Error("Department not found in this tenant");
  }
}

async function assertManagerInTenant(
  managerId?: number | null
) {
  if (managerId == null) return;
  const mgr = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true },
  });
  if (!mgr) {
    throw new Error("Manager not found in this tenant");
  }
}

const VALID_ROLES: UserRole[] = [
  "EMPLOYEE",
  "MANAGER",
  "DIRECTOR",
  "PROCUREMENT",
  "FINANCE",
  "CFO",
  "AUDITOR",
  "ADMIN",
  "VENDOR",
];

/* --- INVITE --- */
export type InviteInput = {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  departmentId?: number | null;
  managerId?: number | null;
  employeeId?: string | null;
  approvalLimit?: number | null;
  costCenter?: string | null;
  language?: string | null;
  timezone?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
};

export async function inviteUser(
  input: InviteInput,
  actor: ActorContext
) {
  const email = input.email.trim().toLowerCase();
  const name = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

  if (!email || !name) {
    throw new Error("Name and email are required");
  }
  if (!VALID_ROLES.includes(input.role)) {
    throw new Error("Invalid role");
  }
  if (
    input.approvalLimit != null &&
    input.approvalLimit < 0
  ) {
    throw new Error("Approval limit must be non-negative");
  }

  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  await assertDepartmentInTenant(input.departmentId);
  await assertManagerInTenant(input.managerId);

  // 1. Create the Fiscora user first (INVITED, no password).
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: input.role,
      status: "INVITED",
      // passwordHash is required by schema; invited users get an unusable
      // random hash (they will authenticate via Clerk, never this value).
      passwordHash: crypto.randomBytes(32).toString("hex"),
      departmentId: input.departmentId ?? null,
      managerId: input.managerId ?? null,
      employeeId: input.employeeId ?? null,
      jobTitle: input.jobTitle ?? null,
      phone: input.phone ?? null,
      approvalLimit: input.approvalLimit ?? null,
      costCenter: input.costCenter ?? null,
      language: input.language ?? "en",
      timezone: input.timezone ?? null,
      invitedById: actor.id,
    },
    select: userSelect,
  });

  // 2. Create the invitation record (source of truth for onboarding).
  const token = newInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  // 3. Ask Clerk to deliver the invitation email.
  const clerkResult = await createClerkInvitation(email);

  const invitation = await prismaRaw.invitation.create({
    data: {
      tenantId: getTenantId(),
      userId: user.id,
      email,
      status: "PENDING",
      token,
      clerkInvitationId: clerkResult.ok
        ? clerkResult.clerkInvitationId
        : null,
      invitedById: actor.id,
      expiresAt,
    },
  });

  // 4. Audit + notify.
  await recordAuditLog("User", user.id, "INVITATION_SENT", actor.name, {
    actorContext: { userId: actor.id, role: actor.role },
    newValue: { email, role: input.role },
    metadata: {
      clerkDelivered: clerkResult.ok,
      clerkInvitationId: clerkResult.ok
        ? clerkResult.clerkInvitationId
        : null,
    },
  });

  await createNotification({
    userId: actor.id,
    title: "Invitation sent",
    message: `Invitation sent to ${name} (${email}) as ${input.role}.`,
    type: "EMPLOYEE_INVITED",
    severity: "INFO",
    entityType: "User",
    entityId: user.id,
    actionUrl: "/settings/users",
  });

  return {
    user,
    invitation,
    clerkDelivered: clerkResult.ok,
    clerkError: clerkResult.ok ? null : clerkResult.reason,
  };
}

/* --- UPDATE PROFILE --- */
export type UpdateUserInput = Partial<{
  name: string;
  jobTitle: string | null;
  phone: string | null;
  employeeId: string | null;
  approvalLimit: number | null;
  costCenter: string | null;
  language: string | null;
  timezone: string | null;
  managerId: number | null;
}>;

export async function updateUser(
  id: number,
  input: UpdateUserInput,
  actor: ActorContext
) {
  const before = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
  if (!before) throw new Error("User not found");

  if (
    input.approvalLimit != null &&
    input.approvalLimit < 0
  ) {
    throw new Error("Approval limit must be non-negative");
  }
  if (input.managerId !== undefined) {
    if (input.managerId === id) {
      throw new Error("A user cannot be their own manager");
    }
    await assertManagerInTenant(input.managerId);
  }

  const user = await prisma.user.update({
    where: { id },
    data: input,
    select: userSelect,
  });

  await recordAuditLog("User", id, "USER_UPDATED", actor.name, {
    actorContext: { userId: actor.id, role: actor.role },
    oldValue: before as unknown as Record<string, unknown>,
    newValue: input as Record<string, unknown>,
  });

  return user;
}

/* --- STATUS LIFECYCLE --- */
export async function changeStatus(
  id: number,
  status: UserStatus,
  actor: ActorContext,
  reason?: string
) {
  const before = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, tenantId: true, role: true },
  });
  if (!before) throw new Error("User not found");

  if (before.id === actor.id && status !== "ACTIVE") {
    throw new Error("You cannot suspend or lock your own account");
  }

  const data: Prisma.UserUpdateInput = { status };

  // Reactivation clears lockout counters.
  if (status === "ACTIVE") {
    data.failedLoginAttempts = 0;
    data.lockedUntil = null;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  // Suspending / locking / deleting must kill existing sessions immediately.
  if (status !== "ACTIVE") {
    await invalidateSessions(id);
  }

  const action =
    status === "ACTIVE"
      ? "ACCOUNT_REACTIVATED"
      : status === "SUSPENDED"
      ? "ACCOUNT_SUSPENDED"
      : status === "DELETED"
      ? "ACCOUNT_DELETED"
      : "ACCOUNT_LOCKED";

  await recordIdentityAudit({
    tenantId: before.tenantId,
    userId: id,
    actor: actor.name,
    role: actor.role,
    action,
    reason,
    metadata: { from: before.status, to: status },
  });

  return user;
}

/* --- ROLE --- */
export async function changeRole(
  id: number,
  role: UserRole,
  actor: ActorContext
) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error("Invalid role");
  }

  const before = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true },
  });
  if (!before) throw new Error("User not found");

  if (before.id === actor.id && role !== before.role) {
    throw new Error("You cannot change your own role");
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: userSelect,
  });

  await recordAuditLog("User", id, "ROLE_CHANGED", actor.name, {
    actorContext: { userId: actor.id, role: actor.role },
    oldValue: { role: before.role },
    newValue: { role },
  });

  return user;
}

/* --- DEPARTMENT --- */
export async function changeDepartment(
  id: number,
  departmentId: number | null,
  actor: ActorContext
) {
  await assertDepartmentInTenant(departmentId);

  const before = await prisma.user.findUnique({
    where: { id },
    select: { id: true, departmentId: true },
  });
  if (!before) throw new Error("User not found");

  const user = await prisma.user.update({
    where: { id },
    data: { departmentId },
    select: userSelect,
  });

  await recordAuditLog("User", id, "DEPARTMENT_CHANGED", actor.name, {
    actorContext: { userId: actor.id, role: actor.role },
    oldValue: { departmentId: before.departmentId },
    newValue: { departmentId },
  });

  return user;
}

/* --- RESEND INVITATION --- */
export async function resendInvitation(
  id: number,
  actor: ActorContext
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, status: true, clerkId: true },
  });
  if (!user) throw new Error("User not found");
  if (user.clerkId || user.status !== "INVITED") {
    throw new Error("User has already accepted their invitation");
  }

  const clerkResult = await createClerkInvitation(user.email);
  const token = newInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  // Supersede any older pending invite, then create a fresh one.
  await prismaRaw.invitation.updateMany({
    where: {
      tenantId: getTenantId(),
      email: user.email,
      status: "PENDING",
    },
    data: { status: "CANCELLED" },
  });

  const invitation = await prismaRaw.invitation.create({
    data: {
      tenantId: getTenantId(),
      userId: user.id,
      email: user.email,
      status: "PENDING",
      token,
      clerkInvitationId: clerkResult.ok
        ? clerkResult.clerkInvitationId
        : null,
      invitedById: actor.id,
      expiresAt,
    },
  });

  await recordAuditLog("User", id, "INVITATION_RESENT", actor.name, {
    actorContext: { userId: actor.id, role: actor.role },
    metadata: { clerkDelivered: clerkResult.ok },
  });

  return {
    invitation,
    clerkDelivered: clerkResult.ok,
    clerkError: clerkResult.ok ? null : clerkResult.reason,
  };
}

/* --- CANCEL INVITATION --- */
export async function cancelInvitation(
  id: number,
  actor: ActorContext
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, status: true, clerkId: true },
  });
  if (!user) throw new Error("User not found");

  const pending = await prismaRaw.invitation.findMany({
    where: {
      tenantId: getTenantId(),
      email: user.email,
      status: "PENDING",
    },
  });

  for (const inv of pending) {
    if (inv.clerkInvitationId) {
      await revokeClerkInvitation(inv.clerkInvitationId);
    }
  }

  await prismaRaw.invitation.updateMany({
    where: {
      tenantId: getTenantId(),
      email: user.email,
      status: "PENDING",
    },
    data: { status: "REVOKED" },
  });

  await recordAuditLog("User", id, "INVITATION_CANCELLED", actor.name, {
    actorContext: { userId: actor.id, role: actor.role },
  });

  return { revoked: pending.length };
}

/* --- FORCE LOGOUT --- */
export async function forceLogout(
  id: number,
  actor: ActorContext
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, tenantId: true },
  });
  if (!user) throw new Error("User not found");

  const result = await invalidateSessions(id);

  await recordIdentityAudit({
    tenantId: user.tenantId,
    userId: id,
    actor: actor.name,
    role: actor.role,
    action: "FORCE_LOGOUT",
  });

  return result;
}

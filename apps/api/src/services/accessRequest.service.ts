/**
 * Access Requests — self-service provisioning workflow (Sprint 18C).
 *
 * Separates AUTHENTICATION (Clerk: "who are you?") from PROVISIONING
 * (Fiscora: "do you belong to this workspace, and with what role?").
 *
 * Flow:
 *   1. A signed-in Clerk identity with no Fiscora user submits a request.
 *   2. Admins are notified + the request is audited.
 *   3. An admin approves (choosing role + department) → a Fiscora User is created
 *      and linked to the requester's clerkId, so their next request resolves.
 *   4. Or an admin rejects.
 *
 * Uses prismaRaw because requesters have no tenant context yet; requests are
 * attached to the default/active tenant explicitly.
 */
import crypto from "crypto";
import type { UserRole } from "@prisma/client";
import { prismaRaw } from "../db";
import { recordAuditLog } from "../lib/audit";
import { createNotification } from "./notifications";
import { recordIdentityAudit } from "./identityService";

const VALID_ROLES: UserRole[] = [
  "ADMIN",
  "CFO",
  "DIRECTOR",
  "PROCUREMENT",
  "MANAGER",
  "FINANCE",
  "AUDITOR",
  "EMPLOYEE",
];

/** Resolves the tenant a new requester should be attached to (single-tenant for now). */
async function resolveDefaultTenantId(): Promise<number> {
  const tenant = await prismaRaw.tenant.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!tenant) {
    throw new Error("No tenant configured");
  }
  return tenant.id;
}

/* --- CREATE (public: Clerk-verified, no Fiscora user required) --- */
export async function createAccessRequest(input: {
  email: string;
  name: string;
  clerkId?: string | null;
  requestedDepartment?: string | null;
  reason?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error("Email is required");
  }

  // If they're already a Fiscora user, there's nothing to request.
  const existingUser = await prismaRaw.user.findFirst({
    where: { email },
    select: { id: true, status: true },
  });
  if (existingUser && existingUser.status !== "DELETED") {
    return { ok: false as const, reason: "ALREADY_PROVISIONED" as const };
  }

  const tenantId = await resolveDefaultTenantId();

  // Collapse duplicate pending requests for the same email.
  const pending = await prismaRaw.accessRequest.findFirst({
    where: { email, status: "PENDING" },
  });
  if (pending) {
    return { ok: true as const, request: pending, duplicate: true as const };
  }

  const request = await prismaRaw.accessRequest.create({
    data: {
      tenantId,
      email,
      name: input.name?.trim() || email,
      clerkId: input.clerkId ?? null,
      requestedDepartment: input.requestedDepartment?.trim() || null,
      reason: input.reason?.trim() || null,
      status: "PENDING",
    },
  });

  // Notify admins of THIS tenant. Requester has no tenant context, so resolve
  // recipients + write notifications via prismaRaw with an explicit tenantId.
  const admins = await prismaRaw.user.findMany({
    where: { tenantId, role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  if (admins.length) {
    await prismaRaw.notification
      .createMany({
        data: admins.map((a) => ({
          tenantId,
          userId: a.id,
          title: "New access request",
          message: `${request.name} (${request.email}) requested access to Fiscora.`,
          type: "ACCESS_REQUEST",
          severity: "WARNING" as const,
          entityType: "AccessRequest",
          entityId: request.id,
          actionUrl: "/settings/access-requests",
        })),
      })
      .catch(() => {});
  }

  // Requester has no tenant context yet → write audit via prismaRaw with explicit tenantId.
  await prismaRaw.auditLog
    .create({
      data: {
        tenantId,
        entityType: "AccessRequest",
        entityId: request.id,
        action: "ACCESS_REQUESTED",
        actor: request.name,
        metadata: { email: request.email },
      },
    })
    .catch(() => {});

  return { ok: true as const, request, duplicate: false as const };
}

/* --- LIST (admin) --- */
export async function listAccessRequests(filters?: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
}) {
  return prismaRaw.accessRequest.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
  });
}

export async function getAccessRequestCounts() {
  const grouped = await prismaRaw.accessRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const g of grouped) {
    counts[g.status] = g._count._all;
  }
  return counts;
}

/* --- APPROVE (admin) --- */
export async function approveAccessRequest(
  id: number,
  input: {
    role: UserRole;
    departmentId?: number | null;
    approvalLimit?: number | null;
  },
  actor: { id: number; name: string; role: UserRole }
) {
  if (!VALID_ROLES.includes(input.role)) {
    throw new Error("Invalid role");
  }

  const request = await prismaRaw.accessRequest.findUnique({
    where: { id },
  });
  if (!request) {
    throw new Error("Access request not found");
  }
  if (request.status !== "PENDING") {
    throw new Error(`Request already ${request.status.toLowerCase()}`);
  }

  // Guard against a user having been created in the meantime.
  const existing = await prismaRaw.user.findFirst({
    where: { email: request.email },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== "DELETED") {
    throw new Error("A user with this email already exists");
  }

  if (input.departmentId != null) {
    const dept = await prismaRaw.department.findFirst({
      where: { id: input.departmentId, tenantId: request.tenantId },
      select: { id: true },
    });
    if (!dept) {
      throw new Error("Department not found in this workspace");
    }
  }

  // Ensure the requester's clerkId isn't already bound elsewhere.
  let clerkId = request.clerkId;
  if (clerkId) {
    const claimed = await prismaRaw.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (claimed) {
      clerkId = null; // fall back to email auto-link on next login
    }
  }

  const user = await prismaRaw.user.create({
    data: {
      tenantId: request.tenantId,
      email: request.email,
      name: request.name,
      role: input.role,
      status: "ACTIVE",
      clerkId,
      departmentId: input.departmentId ?? null,
      approvalLimit: input.approvalLimit ?? null,
      // Schema requires passwordHash; Clerk owns auth, so this is unusable.
      passwordHash: crypto.randomBytes(32).toString("hex"),
      invitedById: actor.id,
    },
    include: { department: true },
  });

  const updated = await prismaRaw.accessRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedById: actor.id,
      reviewedAt: new Date(),
      createdUserId: user.id,
    },
  });

  await recordIdentityAudit({
    tenantId: request.tenantId,
    userId: user.id,
    actor: actor.name,
    role: actor.role,
    action: "INVITATION_ACCEPTED",
    reason: "Access request approved",
    metadata: {
      accessRequestId: id,
      grantedRole: input.role,
      autoLinked: Boolean(clerkId),
    },
  });

  await createNotification({
    userId: actor.id,
    title: "Access request approved",
    message: `${user.name} (${user.email}) was granted ${input.role} access.`,
    type: "ACCESS_REQUEST",
    severity: "INFO",
    entityType: "User",
    entityId: user.id,
    actionUrl: "/settings/users",
  });

  return { request: updated, user };
}

/* --- REJECT (admin) --- */
export async function rejectAccessRequest(
  id: number,
  actor: { id: number; name: string; role: UserRole },
  reason?: string
) {
  const request = await prismaRaw.accessRequest.findUnique({
    where: { id },
  });
  if (!request) {
    throw new Error("Access request not found");
  }
  if (request.status !== "PENDING") {
    throw new Error(`Request already ${request.status.toLowerCase()}`);
  }

  const updated = await prismaRaw.accessRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
  });

  await recordAuditLog(
    "AccessRequest",
    id,
    "ACCESS_REJECTED",
    actor.name,
    {
      actorContext: { userId: actor.id, role: actor.role },
      reason,
      metadata: { email: request.email },
    }
  ).catch(() => {});

  return { request: updated };
}

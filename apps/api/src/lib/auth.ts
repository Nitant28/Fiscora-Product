/**
 * Session-based authentication: password hashing, login/logout, and approval helpers.
 * Permissions are resolved via rbac service and exposed on the session user object.
 */
import crypto from "crypto";
import prisma, { prismaRaw } from "../db";
import type { UserRole } from "@prisma/client";
import {
  getPermissionsForRole,
  hasPermission as rbacHasPermission,
} from "../services/rbac";
import { PERMISSION_KEYS } from "./permissions";
import { verifyClerkToken, getClerkUser } from "./clerk";
import {
  findUserByClerkId,
  linkClerkUser,
  recordLoginHistory,
  recordIdentityAudit,
  syncLastLogin,
} from "../services/identityService";
import {
  getRequestIp,
  getRequestUserAgent,
} from "./requestContext";

/* --- PASSWORD & SESSION CONSTANTS --- */
const SESSION_DAYS = 7;
const SALT = "fiscora-auth-v1";

/* --- LOCKOUT POLICY --- */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

/* Accounts in these states cannot authenticate via any path. */
const BLOCKED_STATUSES = [
  "SUSPENDED",
  "LOCKED",
  "DELETED",
] as const;

function isBlockedStatus(status: string): boolean {
  return (BLOCKED_STATUSES as readonly string[]).includes(
    status
  );
}

/* --- DEVELOPMENT IDENTITY OVERRIDE (DEV ONLY) --- */
/**
 * Demo accounts that may sign in via /dev-login without Clerk/OTP.
 * Real users (any other email) MUST authenticate through Clerk.
 */
export const DEV_DEMO_EMAILS = new Set<string>([
  "admin@fiscora.com",
  "cfo@fiscora.com",
  "director@fiscora.com",
  "procurement@fiscora.com",
  "manager@fiscora.com",
  "finance@fiscora.com",
  "auditor@fiscora.com",
  "employee@fiscora.com",
]);

/**
 * Double-guarded dev switch: the route disappears in production even if the
 * flag leaks into a prod environment.
 */
export function isDevAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.FISCORA_DEV_AUTH === "true"
  );
}

/* --- PASSWORD HASHING --- */
export function hashPassword(password: string) {
  return crypto
    .pbkdf2Sync(password, SALT, 100000, 64, "sha512")
    .toString("hex");
}

export function verifyPassword(
  password: string,
  passwordHash: string
) {
  return hashPassword(password) === passwordHash;
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* --- SESSION LIFECYCLE --- */
export async function loginUser(
  email: string,
  password: string
) {
  const user = await prismaRaw.user.findFirst({
    where: { email: email.toLowerCase() },
    include: { department: true, tenant: true },
  });

  // Unknown email — nothing to record, generic failure.
  if (!user) {
    return null;
  }

  const ipAddress = getRequestIp();
  const userAgent = getRequestUserAgent();

  // 1. Tenant must be active.
  if (user.tenant.status === "SUSPENDED") {
    await recordLoginHistory({
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress,
      userAgent,
      success: false,
      failureReason: "TENANT_SUSPENDED",
    });
    await recordIdentityAudit({
      tenantId: user.tenantId,
      userId: user.id,
      actor: user.name,
      role: user.role,
      action: "TENANT_SUSPENDED_LOGIN_BLOCKED",
    });
    return { blocked: true as const, status: "TENANT_SUSPENDED" };
  }

  // 2. Auto-unlock if the lock window has elapsed.
  let effectiveUser = user;
  if (
    user.status === "LOCKED" &&
    user.lockedUntil &&
    user.lockedUntil < new Date()
  ) {
    effectiveUser = await prismaRaw.user.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      include: { department: true, tenant: true },
    });
    await recordIdentityAudit({
      tenantId: user.tenantId,
      userId: user.id,
      actor: user.name,
      role: user.role,
      action: "ACCOUNT_REACTIVATED",
      reason: "lockout window elapsed",
    });
  }

  // 3. Still locked? Reject.
  if (
    effectiveUser.status === "LOCKED" &&
    effectiveUser.lockedUntil &&
    effectiveUser.lockedUntil >= new Date()
  ) {
    await recordLoginHistory({
      userId: effectiveUser.id,
      tenantId: effectiveUser.tenantId,
      ipAddress,
      userAgent,
      success: false,
      failureReason: "ACCOUNT_LOCKED",
    });
    return {
      blocked: true as const,
      status: "LOCKED",
      lockedUntil: effectiveUser.lockedUntil,
    };
  }

  // 4. Wrong password / no password → count the failure, maybe lock.
  if (
    !effectiveUser.passwordHash ||
    !verifyPassword(password, effectiveUser.passwordHash)
  ) {
    const attempts =
      effectiveUser.failedLoginAttempts + 1;
    const willLock = attempts >= MAX_FAILED_ATTEMPTS;

    const lockedUntil = willLock
      ? new Date(
          Date.now() + LOCKOUT_MINUTES * 60 * 1000
        )
      : null;

    await prismaRaw.user.update({
      where: { id: effectiveUser.id },
      data: {
        failedLoginAttempts: attempts,
        ...(willLock
          ? { status: "LOCKED", lockedUntil }
          : {}),
      },
    });

    await recordLoginHistory({
      userId: effectiveUser.id,
      tenantId: effectiveUser.tenantId,
      ipAddress,
      userAgent,
      success: false,
      failureReason: willLock
        ? "INVALID_CREDENTIALS_LOCKED"
        : "INVALID_CREDENTIALS",
    });

    if (willLock) {
      await recordIdentityAudit({
        tenantId: effectiveUser.tenantId,
        userId: effectiveUser.id,
        actor: effectiveUser.name,
        role: effectiveUser.role,
        action: "ACCOUNT_LOCKED",
        reason: `${attempts} consecutive failed logins`,
        metadata: { lockedUntil },
      });
      return {
        blocked: true as const,
        status: "LOCKED",
        lockedUntil,
      };
    }

    return null;
  }

  // 5. Block suspended/deleted (and any residual locked) accounts.
  if (isBlockedStatus(effectiveUser.status)) {
    await recordLoginHistory({
      userId: effectiveUser.id,
      tenantId: effectiveUser.tenantId,
      ipAddress,
      userAgent,
      success: false,
      failureReason: `STATUS_${effectiveUser.status}`,
    });
    return {
      blocked: true as const,
      status: effectiveUser.status,
    };
  }

  // 6. Success — issue session, reset counters, stamp login.
  const token = newToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.session.create({
    data: {
      userId: effectiveUser.id,
      token,
      expiresAt,
    },
  });

  await prismaRaw.user.update({
    where: { id: effectiveUser.id },
    data: {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await recordLoginHistory({
    userId: effectiveUser.id,
    tenantId: effectiveUser.tenantId,
    ipAddress,
    userAgent,
    success: true,
  });

  await recordIdentityAudit({
    tenantId: effectiveUser.tenantId,
    userId: effectiveUser.id,
    actor: effectiveUser.name,
    role: effectiveUser.role,
    action: "LOGIN_SUCCESS",
  });

  const {
    passwordHash: _ph,
    tenant: _tenant,
    ...safeUser
  } = effectiveUser;
  const permissions = getPermissionsForRole(
    effectiveUser.role
  );

  return {
    token,
    user: { ...safeUser, permissions },
  };
}

/**
 * DEV ONLY: issues a legacy session for a demo account with no password/OTP.
 * Refuses unless isDevAuthEnabled() and the email is in the demo allowlist.
 * Production identity is unaffected — this never runs when NODE_ENV=production.
 */
export async function loginDevUser(email: string) {
  if (!isDevAuthEnabled()) {
    return { ok: false as const, reason: "DISABLED" };
  }

  const normalized = email.toLowerCase().trim();
  if (!DEV_DEMO_EMAILS.has(normalized)) {
    return { ok: false as const, reason: "NOT_A_DEMO_ACCOUNT" };
  }

  const user = await prismaRaw.user.findFirst({
    where: { email: normalized },
    include: { department: true, tenant: true },
  });

  if (!user) {
    return { ok: false as const, reason: "USER_NOT_FOUND" };
  }
  if (isBlockedStatus(user.status)) {
    return { ok: false as const, reason: "ACCOUNT_BLOCKED" };
  }
  if (user.tenant.status === "SUSPENDED") {
    return { ok: false as const, reason: "TENANT_SUSPENDED" };
  }

  const token = newToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.session.create({
    data: { userId: user.id, token, expiresAt },
  });

  await prismaRaw.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordIdentityAudit({
    tenantId: user.tenantId,
    userId: user.id,
    actor: user.name,
    role: user.role,
    action: "LOGIN_SUCCESS",
    metadata: { authSource: "dev" },
  });

  const {
    passwordHash: _ph,
    tenant: _tenant,
    ...safeUser
  } = user;
  const permissions = getPermissionsForRole(user.role);

  return {
    ok: true as const,
    token,
    user: { ...safeUser, permissions },
  };
}

export async function logoutUser(token: string) {
  const session = await prismaRaw.session.findUnique({
    where: { token },
    include: { user: true },
  });

  await prisma.session.deleteMany({
    where: { token },
  });

  if (session?.user) {
    await recordIdentityAudit({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      actor: session.user.name,
      role: session.user.role,
      action: "LOGOUT",
    });
  }
}

export async function getSessionUser(token: string) {
  const session = await prismaRaw.session.findUnique({
    where: { token },
    include: {
      user: {
        include: { department: true, tenant: true },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    // Eager cleanup of expired sessions on access
    if (session) {
      await prismaRaw.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  // Suspended/locked/deleted users cannot use an existing session.
  if (isBlockedStatus(session.user.status)) {
    return null;
  }

  // Tenant must be active.
  if (session.user.tenant.status === "SUSPENDED") {
    return null;
  }

  // Session invalidation: sessions created before sessionsValidFrom are dead.
  if (
    session.user.sessionsValidFrom &&
    session.createdAt < session.user.sessionsValidFrom
  ) {
    await prismaRaw.session.delete({
      where: { id: session.id },
    });
    return null;
  }

  const {
    passwordHash: _ph,
    tenant: _tenant,
    ...user
  } = session.user;
  const permissions = getPermissionsForRole(user.role);

  return { ...user, permissions };
}

/* --- UNIFIED IDENTITY RESOLUTION (Clerk JWT primary; legacy session deprecated) --- */
type ResolvedAuth = {
  user: NonNullable<
    Awaited<ReturnType<typeof getSessionUser>>
  >;
  source: "session" | "clerk";
};

export type IdentityResolution =
  | { ok: true; auth: ResolvedAuth }
  | {
      ok: false;
      reason:
        | "INVALID_TOKEN"
        | "ACCOUNT_NOT_PROVISIONED"
        | "ACCOUNT_BLOCKED"
        | "TENANT_SUSPENDED";
      detail?: string;
    };

function isJwt(token: string): boolean {
  return token.split(".").length === 3;
}

/**
 * Resolves a Fiscora user from a verified Clerk identity.
 * Auto-links by email on first login, then loads role + permissions from DB.
 */
async function resolveClerkFiscoraUser(
  identity: NonNullable<
    Awaited<ReturnType<typeof verifyClerkToken>>
  >
): Promise<IdentityResolution> {
  let dbUser = await findUserByClerkId(identity.clerkId);

  if (!dbUser) {
    const profile = await getClerkUser(identity.clerkId);
    if (!profile?.email) {
      return {
        ok: false,
        reason: "ACCOUNT_NOT_PROVISIONED",
        detail: "Clerk account has no email to match",
      };
    }

    const linked = await linkClerkUser(
      profile.email,
      identity.clerkId
    );

    if (!linked.ok) {
      console.warn(
        "[identity] Clerk link failed:",
        linked.reason,
        profile.email
      );
      return {
        ok: false,
        reason: "ACCOUNT_NOT_PROVISIONED",
        detail: linked.reason,
      };
    }

    dbUser = linked.user;

    await syncLastLogin(dbUser.id);
    await recordLoginHistory({
      userId: dbUser.id,
      tenantId: dbUser.tenantId,
      ipAddress: getRequestIp(),
      userAgent: getRequestUserAgent(),
      success: true,
    });
    await recordIdentityAudit({
      tenantId: dbUser.tenantId,
      userId: dbUser.id,
      actor: dbUser.name,
      role: dbUser.role,
      action: "LOGIN_SUCCESS",
      metadata: { authSource: "clerk", firstLink: true },
    });
  }

  if (isBlockedStatus(dbUser.status)) {
    return {
      ok: false,
      reason: "ACCOUNT_BLOCKED",
      detail: dbUser.status,
    };
  }

  if (
    dbUser.sessionsValidFrom &&
    typeof identity.issuedAt === "number" &&
    identity.issuedAt * 1000 <
      dbUser.sessionsValidFrom.getTime()
  ) {
    return {
      ok: false,
      reason: "INVALID_TOKEN",
      detail: "Session invalidated",
    };
  }

  const tenant = await prismaRaw.tenant.findUnique({
    where: { id: dbUser.tenantId },
    select: { status: true },
  });

  if (!tenant || tenant.status === "SUSPENDED") {
    return {
      ok: false,
      reason: "TENANT_SUSPENDED",
    };
  }

  const { passwordHash: _ph, ...safe } = dbUser;
  const permissions = getPermissionsForRole(dbUser.role);

  return {
    ok: true,
    auth: {
      user: { ...safe, permissions },
      source: "clerk",
    },
  };
}

/**
 * Resolves the authenticated user from a Bearer token.
 * Clerk JWTs are verified first; legacy session tokens are only accepted for
 * non-JWT shapes (migration rollback — remove once legacy auth is deleted).
 */
export async function resolveIdentity(
  token: string
): Promise<IdentityResolution> {
  if (!token?.trim()) {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  // Clerk JWT — never fall through to legacy if shape is JWT.
  if (isJwt(token)) {
    const identity = await verifyClerkToken(token);
    if (!identity) {
      return { ok: false, reason: "INVALID_TOKEN" };
    }
    return resolveClerkFiscoraUser(identity);
  }

  // Legacy session token (hex).
  const sessionUser = await getSessionUser(token);
  if (sessionUser) {
    return {
      ok: true,
      auth: { user: sessionUser, source: "session" },
    };
  }

  return { ok: false, reason: "INVALID_TOKEN" };
}

/** @deprecated use resolveIdentity — kept for callers expecting null. */
export async function resolveUserFromToken(
  token: string
): Promise<ResolvedAuth | null> {
  const result = await resolveIdentity(token);
  return result.ok ? result.auth : null;
}

/* --- PURCHASE REQUEST APPROVAL MAPPING --- */
/** Maps workflow approver titles (from approval rules) to roles allowed to act. */
export const APPROVER_ROLE_MAP: Record<string, UserRole[]> = {
  Manager: ["MANAGER", "ADMIN"],
  Director: ["DIRECTOR", "ADMIN"],
  "VP Finance": ["DIRECTOR", "ADMIN"],
  CFO: ["CFO", "ADMIN"],
  "Procurement Head": ["PROCUREMENT", "ADMIN"],
  "Marketing Head": ["DIRECTOR", "ADMIN"],
  "IT Director": ["DIRECTOR", "ADMIN"],
};

export function canApprove(
  userRole: UserRole,
  assignedApprover: string | null
) {
  if (
    !rbacHasPermission(userRole, PERMISSION_KEYS.REQUEST_APPROVE) &&
    !rbacHasPermission(userRole, PERMISSION_KEYS.REQUEST_REJECT)
  ) {
    return false;
  }

  // No specific assignee: any role with REQUEST_APPROVE may approve
  if (!assignedApprover) {
    return true;
  }

  const allowed =
    APPROVER_ROLE_MAP[assignedApprover] ?? ["ADMIN"];

  return allowed.includes(userRole);
}

export function getApproverTitlesForRole(
  role: UserRole
): string[] {
  if (role === "ADMIN") {
    return Object.keys(APPROVER_ROLE_MAP);
  }

  return Object.entries(APPROVER_ROLE_MAP)
    .filter(([, roles]) => roles.includes(role))
    .map(([title]) => title);
}

/* --- PERMISSION HELPERS (RBAC DELEGATION) --- */
/** @deprecated use PERMISSION_KEYS and hasPermission(role, key) */
export const PERMISSIONS = {
  approveRequests: ["MANAGER", "DIRECTOR", "CFO", "PROCUREMENT", "ADMIN"],
  manageVendors: ["PROCUREMENT", "ADMIN"],
  manageContracts: ["PROCUREMENT", "CFO", "ADMIN"],
  viewControlTower: ["DIRECTOR", "CFO", "PROCUREMENT", "ADMIN"],
  manageCatalog: ["PROCUREMENT", "ADMIN"],
  inviteVendors: ["PROCUREMENT", "ADMIN"],
} as const;

export function hasPermission(
  role: UserRole,
  permission: string
) {
  return rbacHasPermission(role, permission);
}

export function canViewCfoDashboard(
  role: UserRole
) {
  return hasPermission(role, PERMISSION_KEYS.CASHFORECAST_VIEW);
}

export { getPermissionsForRole };

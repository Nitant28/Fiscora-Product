/**
 * Fastify auth hooks: Bearer token extraction, optional/required auth, and RBAC gates.
 */
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { UserRole } from "@prisma/client";
import {
  getSessionUser,
  hasPermission,
  resolveIdentity,
} from "./auth";
import { normalizePermissionKey } from "./permissions";
import { setRequestUserId } from "./requestContext";
import { setTenantId } from "./tenantContext";

/* --- TYPES & FASTIFY AUGMENTATION --- */
export type AuthUser = Awaited<
  ReturnType<typeof getSessionUser>
>;

declare module "fastify" {
  interface FastifyRequest {
    user?: NonNullable<AuthUser>;
    permissionUsed?: string;
    authSource?: "session" | "clerk";
  }
}

/* --- TOKEN EXTRACTION --- */
function extractToken(request: FastifyRequest) {
  const header =
    request.headers.authorization;

  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }

  return null;
}

function attachUser(
  request: FastifyRequest,
  user: NonNullable<AuthUser>,
  source: "session" | "clerk"
) {
  request.user = user;
  request.authSource = source;
  setRequestUserId(user.id);

  if (typeof user.tenantId === "number") {
    setTenantId(user.tenantId);
  }
}

function provisioningMessage(detail?: string) {
  if (detail === "USER_NOT_FOUND") {
    return "Your account has not been provisioned. Please contact your administrator to receive an invitation.";
  }
  return "Your account has not been provisioned. Please contact your administrator.";
}

/* --- AUTH HOOKS --- */
/** Attaches user when a valid Bearer token is present; does not reject anonymous requests. */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  const token = extractToken(request);

  if (!token) {
    return;
  }

  const resolved = await resolveIdentity(token);

  if (resolved.ok) {
    attachUser(
      request,
      resolved.auth.user,
      resolved.auth.source
    );
  }
}

/** Requires a valid session; responds 401/403 otherwise. */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = extractToken(request);

  if (!token) {
    return reply.status(401).send({
      success: false,
      error: "Authentication required",
    });
  }

  const resolved = await resolveIdentity(token);

  if (!resolved.ok) {
    if (resolved.reason === "ACCOUNT_NOT_PROVISIONED") {
      return reply.status(403).send({
        success: false,
        code: "ACCOUNT_NOT_PROVISIONED",
        error: provisioningMessage(resolved.detail),
        detail: resolved.detail,
      });
    }

    if (resolved.reason === "ACCOUNT_BLOCKED") {
      return reply.status(403).send({
        success: false,
        code: "ACCOUNT_BLOCKED",
        error: `Account ${resolved.detail?.toLowerCase() ?? "blocked"}. Contact your administrator.`,
      });
    }

    if (resolved.reason === "TENANT_SUSPENDED") {
      return reply.status(403).send({
        success: false,
        code: "TENANT_SUSPENDED",
        error: "Your organization has been suspended. Contact support.",
      });
    }

    return reply.status(401).send({
      success: false,
      error: "Invalid or expired session",
    });
  }

  attachUser(
    request,
    resolved.auth.user,
    resolved.auth.source
  );
}

/* --- PERMISSION HOOKS --- */
export function requirePermission(permission: string) {
  const normalized = normalizePermissionKey(permission);

  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    await requireAuth(request, reply);

    if (reply.sent || !request.user) {
      return;
    }

    if (
      !hasPermission(
        request.user.role as UserRole,
        normalized
      )
    ) {
      return reply.status(403).send({
        success: false,
        error: "Insufficient permissions",
        required: normalized,
      });
    }

    request.permissionUsed = normalized;
  };
}

/** Passes if the user has any one of the listed permissions. */
export function requireAnyPermission(
  ...permissions: string[]
) {
  const normalized = permissions.map(normalizePermissionKey);

  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    await requireAuth(request, reply);

    if (reply.sent || !request.user) {
      return;
    }

    const role = request.user.role as UserRole;
    const allowed = normalized.find((key) =>
      hasPermission(role, key)
    );

    if (!allowed) {
      return reply.status(403).send({
        success: false,
        error: "Insufficient permissions",
        requiredAny: normalized,
      });
    }

    request.permissionUsed = allowed;
  };
}

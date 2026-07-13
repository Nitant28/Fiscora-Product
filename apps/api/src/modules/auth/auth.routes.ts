/**
 * Module: Auth
 * Purpose: Session authentication — login, logout, current user, and role permissions.
 * Endpoints:
 *   POST /auth/login
 *   POST /auth/logout
 *   GET  /auth/me
 *   GET  /auth/permissions
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import {
  getSessionUser,
  getPermissionsForRole,
  loginUser,
  loginDevUser,
  isDevAuthEnabled,
  logoutUser,
  resolveIdentity,
} from "../../lib/auth";
import { requireAuth } from "../../lib/authMiddleware";
import {
  verifyClerkToken,
  getClerkUser,
  isClerkConfigured,
} from "../../lib/clerk";
import {
  linkClerkUser,
  syncLastLogin,
  recordLoginHistory,
} from "../../services/identityService";

function extractBearer(
  request: FastifyRequest
): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return null;
}

export async function authRoutes(app: FastifyInstance) {
  // --- Login ---
  app.post(
    "/auth/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, password } =
          request.body as {
            email?: string;
            password?: string;
          };

        if (!email?.trim() || !password) {
          return reply.status(400).send({
            success: false,
            error: "Email and password required",
          });
        }

        const result = await loginUser(
          email.trim(),
          password
        );

        if (!result) {
          return reply.status(401).send({
            success: false,
            error: "Invalid credentials",
          });
        }

        if ("blocked" in result) {
          return reply.status(403).send({
            success: false,
            error: `Account ${result.status.toLowerCase()}. Contact your administrator.`,
          });
        }

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Login failed",
        });
      }
    }
  );

  // --- Dev-only one-click role login (no Clerk/OTP) ---
  // Disabled entirely unless NODE_ENV!=production AND FISCORA_DEV_AUTH=true.
  app.post(
    "/auth/dev-login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!isDevAuthEnabled()) {
        return reply.status(404).send({
          success: false,
          error: "Not found",
        });
      }

      const { email } = request.body as { email?: string };
      if (!email?.trim()) {
        return reply.status(400).send({
          success: false,
          error: "email is required",
        });
      }

      const result = await loginDevUser(email.trim());
      if (!result.ok) {
        const status = /NOT_FOUND/.test(result.reason)
          ? 404
          : result.reason === "DISABLED"
            ? 404
            : 400;
        return reply.status(status).send({
          success: false,
          error: result.reason,
        });
      }

      return reply.send({
        success: true,
        token: result.token,
        user: result.user,
      });
    }
  );

  // --- Logout ---
  app.post(
    "/auth/logout",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const header =
        request.headers.authorization;

      if (header?.startsWith("Bearer ")) {
        await logoutUser(header.slice(7));
      }

      return reply.send({ success: true });
    }
  );

  // --- Identity bootstrap (Clerk → Fiscora link + full user) ---
  app.post(
    "/auth/bootstrap",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = extractBearer(request);
      if (!token) {
        return reply.status(401).send({
          success: false,
          error: "Missing bearer token",
        });
      }

      const resolved = await resolveIdentity(token);

      if (!resolved.ok) {
        if (resolved.reason === "ACCOUNT_NOT_PROVISIONED") {
          return reply.status(403).send({
            success: false,
            code: "ACCOUNT_NOT_PROVISIONED",
            error:
              "Your account has not been provisioned. Please contact your administrator.",
            detail: resolved.detail,
          });
        }
        return reply.status(401).send({
          success: false,
          error: "Invalid session",
        });
      }

      const permissions =
        resolved.auth.user.permissions ??
        getPermissionsForRole(resolved.auth.user.role);

      return reply.send({
        success: true,
        authSource: resolved.auth.source,
        user: {
          ...resolved.auth.user,
          permissions,
        },
      });
    }
  );

  // --- Current user ---
  app.get(
    "/auth/me",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const permissions =
        request.user?.permissions ??
        getPermissionsForRole(request.user!.role);

      return reply.send({
        success: true,
        authSource: request.authSource ?? "session",
        user: {
          ...request.user,
          permissions,
        },
      });
    }
  );

  // --- Clerk token smoke test (no DB) ---
  // Verifies a Clerk session JWT and echoes the identity. Proves backend trusts
  // Clerk. Safe to keep during migration; remove once /auth/me is Clerk-backed.
  app.post(
    "/auth/test-clerk",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!isClerkConfigured()) {
        return reply.status(503).send({
          success: false,
          error: "Clerk is not configured on the server",
        });
      }

      const token = extractBearer(request);
      if (!token) {
        return reply.status(401).send({
          success: false,
          error: "Missing Clerk bearer token",
        });
      }

      const identity = await verifyClerkToken(token);
      if (!identity) {
        return reply.status(401).send({
          success: false,
          error: "Invalid Clerk token",
        });
      }

      const profile = await getClerkUser(
        identity.clerkId
      );

      return reply.send({
        success: true,
        clerkId: identity.clerkId,
        email: profile?.email ?? null,
        name: profile?.name ?? null,
        imageUrl: profile?.imageUrl ?? null,
      });
    }
  );

  // --- One-time Clerk linking (email → clerkId) ---
  // Migration bridge: authenticate with a Clerk token, match the Clerk email to
  // an existing Fiscora user, and store the clerkId. Identity only — never role/
  // tenant/permissions. Remove after all users are linked.
  app.post(
    "/auth/link-clerk",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!isClerkConfigured()) {
        return reply.status(503).send({
          success: false,
          error: "Clerk is not configured on the server",
        });
      }

      const token = extractBearer(request);
      if (!token) {
        return reply.status(401).send({
          success: false,
          error: "Missing Clerk bearer token",
        });
      }

      const identity = await verifyClerkToken(token);
      if (!identity) {
        return reply.status(401).send({
          success: false,
          error: "Invalid Clerk token",
        });
      }

      const profile = await getClerkUser(
        identity.clerkId
      );

      if (!profile?.email) {
        return reply.status(422).send({
          success: false,
          error:
            "Clerk account has no email to match against",
        });
      }

      const result = await linkClerkUser(
        profile.email,
        identity.clerkId
      );

      if (!result.ok) {
        const status =
          result.reason === "USER_NOT_FOUND"
            ? 404
            : 409;
        return reply.status(status).send({
          success: false,
          error: result.reason,
        });
      }

      await syncLastLogin(result.user.id);
      await recordLoginHistory({
        userId: result.user.id,
        tenantId: result.user.tenantId,
        success: true,
      });

      return reply.send({
        success: true,
        linked: {
          userId: result.user.id,
          email: result.user.email,
          clerkId: result.user.clerkId,
          role: result.user.role,
          tenantId: result.user.tenantId,
          status: result.user.status,
        },
      });
    }
  );

  // --- Role permissions ---
  app.get(
    "/auth/permissions",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        role: request.user!.role,
        permissions:
          request.user?.permissions ??
          getPermissionsForRole(request.user!.role),
      });
    }
  );
}

export { getSessionUser };

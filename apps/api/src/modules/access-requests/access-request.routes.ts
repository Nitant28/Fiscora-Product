/**
 * Module: Access Requests — self-service provisioning workflow (Sprint 18C).
 * Endpoints:
 *   POST  /access-request                  (Clerk-verified; no Fiscora user required)
 *   GET   /access-requests                 (admin: user.manage)
 *   POST  /access-requests/:id/approve      (admin: user.manage)
 *   POST  /access-requests/:id/reject       (admin: user.manage)
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { UserRole } from "@prisma/client";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import { verifyClerkToken, getClerkUser } from "../../lib/clerk";
import {
  createAccessRequest,
  listAccessRequests,
  getAccessRequestCounts,
  approveAccessRequest,
  rejectAccessRequest,
} from "../../services/accessRequest.service";

function extractBearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return null;
}

export async function accessRequestRoutes(app: FastifyInstance) {
  // --- Submit an access request (signed in via Clerk, not yet provisioned) ---
  app.post(
    "/access-request",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = extractBearer(request);
      if (!token) {
        return reply.status(401).send({
          success: false,
          error: "Sign in before requesting access",
        });
      }

      const identity = await verifyClerkToken(token);
      if (!identity) {
        return reply.status(401).send({
          success: false,
          error: "Invalid session",
        });
      }

      const profile = await getClerkUser(identity.clerkId);
      if (!profile?.email) {
        return reply.status(422).send({
          success: false,
          error: "Your account has no email to request access with",
        });
      }

      const body = (request.body ?? {}) as {
        department?: string;
        reason?: string;
      };

      try {
        const result = await createAccessRequest({
          email: profile.email,
          name: profile.name ?? profile.email,
          clerkId: identity.clerkId,
          requestedDepartment: body.department,
          reason: body.reason,
        });

        if (!result.ok) {
          return reply.status(409).send({
            success: false,
            code: result.reason,
            error:
              "An account already exists for this email. Try signing in.",
          });
        }

        return reply.send({
          success: true,
          duplicate: result.duplicate,
          request: {
            id: result.request.id,
            status: result.request.status,
          },
        });
      } catch (error) {
        console.error("[access-request] create failed:", error);
        return reply.status(500).send({
          success: false,
          error: "Could not submit access request",
        });
      }
    }
  );

  // --- List access requests (admin) ---
  app.get(
    "/access-requests",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { status } = request.query as {
        status?: "PENDING" | "APPROVED" | "REJECTED";
      };

      const [requests, counts] = await Promise.all([
        listAccessRequests(status ? { status } : undefined),
        getAccessRequestCounts(),
      ]);

      return reply.send({ success: true, requests, counts });
    }
  );

  // --- Approve (admin) ---
  app.post(
    "/access-requests/:id/approve",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as {
        role?: UserRole;
        departmentId?: number | null;
        approvalLimit?: number | null;
      };

      if (!body.role) {
        return reply.status(400).send({
          success: false,
          error: "A role is required to approve",
        });
      }

      try {
        const result = await approveAccessRequest(
          Number.parseInt(id, 10),
          {
            role: body.role,
            departmentId: body.departmentId ?? null,
            approvalLimit: body.approvalLimit ?? null,
          },
          {
            id: request.user!.id,
            name: request.user!.name,
            role: request.user!.role as UserRole,
          }
        );

        return reply.send({ success: true, ...result });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Approval failed";
        const status = /not found/i.test(message) ? 404 : 400;
        return reply.status(status).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // --- Reject (admin) ---
  app.post(
    "/access-requests/:id/reject",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { reason?: string };

      try {
        const result = await rejectAccessRequest(
          Number.parseInt(id, 10),
          {
            id: request.user!.id,
            name: request.user!.name,
            role: request.user!.role as UserRole,
          },
          body.reason
        );

        return reply.send({ success: true, ...result });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Rejection failed";
        const status = /not found/i.test(message) ? 404 : 400;
        return reply.status(status).send({
          success: false,
          error: message,
        });
      }
    }
  );
}

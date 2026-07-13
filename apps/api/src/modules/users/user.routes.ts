/**
 * Module: Users — Enterprise User Management (Sprint 18B).
 * Endpoints:
 *   GET   /users
 *   GET   /users/:id
 *   POST  /users/invite
 *   PATCH /users/:id
 *   PATCH /users/:id/status
 *   PATCH /users/:id/role
 *   PATCH /users/:id/department
 *   POST  /users/:id/resend
 *   POST  /users/:id/cancel-invitation
 *   POST  /users/:id/force-logout
 * Authorization: user.manage (admin). Role changes additionally require role.manage.
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { UserRole, UserStatus } from "@prisma/client";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  listUsers,
  getUser,
  inviteUser,
  updateUser,
  changeStatus,
  changeRole,
  changeDepartment,
  resendInvitation,
  cancelInvitation,
  forceLogout,
  type ActorContext,
} from "../../services/userManagement.service";

function actorOf(request: FastifyRequest): ActorContext {
  return {
    id: request.user!.id,
    name: request.user!.name,
    role: request.user!.role as UserRole,
  };
}

function parseId(request: FastifyRequest): number {
  const { id } = request.params as { id: string };
  return Number.parseInt(id, 10);
}

function fail(
  reply: FastifyReply,
  error: unknown,
  fallbackStatus = 400
) {
  const message =
    error instanceof Error ? error.message : "Request failed";
  const status = /not found/i.test(message)
    ? 404
    : fallbackStatus;
  return reply
    .status(status)
    .send({ success: false, error: message });
}

export async function userRoutes(app: FastifyInstance) {
  // 1. List ------------------------------------------------------------------
  app.get(
    "/users",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (request, reply) => {
      const q = request.query as Record<string, string>;
      const users = await listUsers({
        search: q.search,
        role: q.role as UserRole | undefined,
        status: q.status as UserStatus | undefined,
        departmentId: q.departmentId
          ? Number.parseInt(q.departmentId, 10)
          : undefined,
        managerId: q.managerId
          ? Number.parseInt(q.managerId, 10)
          : undefined,
        neverLoggedIn: q.neverLoggedIn === "true",
      });
      return reply.send({ success: true, users });
    }
  );

  // 2. Detail ----------------------------------------------------------------
  app.get(
    "/users/:id",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (request, reply) => {
      const user = await getUser(parseId(request));
      if (!user) {
        return reply
          .status(404)
          .send({ success: false, error: "User not found" });
      }
      return reply.send({ success: true, user });
    }
  );

  // 3. Invite ----------------------------------------------------------------
  app.post(
    "/users/invite",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (request, reply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const result = await inviteUser(
          {
            firstName: String(body.firstName ?? ""),
            lastName: String(body.lastName ?? ""),
            email: String(body.email ?? ""),
            role: body.role as UserRole,
            departmentId:
              body.departmentId != null
                ? Number(body.departmentId)
                : null,
            managerId:
              body.managerId != null
                ? Number(body.managerId)
                : null,
            employeeId: (body.employeeId as string) ?? null,
            approvalLimit:
              body.approvalLimit != null
                ? Number(body.approvalLimit)
                : null,
            costCenter: (body.costCenter as string) ?? null,
            language: (body.language as string) ?? null,
            timezone: (body.timezone as string) ?? null,
            jobTitle: (body.jobTitle as string) ?? null,
            phone: (body.phone as string) ?? null,
          },
          actorOf(request)
        );
        return reply.send({ success: true, ...result });
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // 4. Update profile --------------------------------------------------------
  app.patch(
    "/users/:id",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (request, reply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const user = await updateUser(
          parseId(request),
          {
            name: body.name as string | undefined,
            jobTitle: body.jobTitle as string | null | undefined,
            phone: body.phone as string | null | undefined,
            employeeId: body.employeeId as
              | string
              | null
              | undefined,
            approvalLimit:
              body.approvalLimit !== undefined
                ? body.approvalLimit === null
                  ? null
                  : Number(body.approvalLimit)
                : undefined,
            costCenter: body.costCenter as
              | string
              | null
              | undefined,
            language: body.language as string | null | undefined,
            timezone: body.timezone as string | null | undefined,
            managerId:
              body.managerId !== undefined
                ? body.managerId === null
                  ? null
                  : Number(body.managerId)
                : undefined,
          },
          actorOf(request)
        );
        return reply.send({ success: true, user });
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // 5. Change status ---------------------------------------------------------
  app.patch(
    "/users/:id/status",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (request, reply) => {
      try {
        const body = request.body as {
          status: UserStatus;
          reason?: string;
        };
        const user = await changeStatus(
          parseId(request),
          body.status,
          actorOf(request),
          body.reason
        );
        return reply.send({ success: true, user });
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // 6. Change role (also requires role.manage) -------------------------------
  app.patch(
    "/users/:id/role",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.ROLE_MANAGE),
      ],
    },
    async (request, reply) => {
      try {
        const body = request.body as { role: UserRole };
        const user = await changeRole(
          parseId(request),
          body.role,
          actorOf(request)
        );
        return reply.send({ success: true, user });
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // 7. Change department -----------------------------------------------------
  app.patch(
    "/users/:id/department",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (request, reply) => {
      try {
        const body = request.body as {
          departmentId: number | null;
        };
        const user = await changeDepartment(
          parseId(request),
          body.departmentId != null
            ? Number(body.departmentId)
            : null,
          actorOf(request)
        );
        return reply.send({ success: true, user });
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // 8. Resend invitation -----------------------------------------------------
  app.post(
    "/users/:id/resend",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (request, reply) => {
      try {
        const result = await resendInvitation(
          parseId(request),
          actorOf(request)
        );
        return reply.send({ success: true, ...result });
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // 9. Cancel invitation -----------------------------------------------------
  app.post(
    "/users/:id/cancel-invitation",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (request, reply) => {
      try {
        const result = await cancelInvitation(
          parseId(request),
          actorOf(request)
        );
        return reply.send({ success: true, ...result });
      } catch (error) {
        return fail(reply, error);
      }
    }
  );

  // 10. Force logout ---------------------------------------------------------
  app.post(
    "/users/:id/force-logout",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (request, reply) => {
      try {
        const result = await forceLogout(
          parseId(request),
          actorOf(request)
        );
        return reply.send({ success: true, ...result });
      } catch (error) {
        return fail(reply, error);
      }
    }
  );
}

/**
 * Module: Admin — production monitoring (system health, errors, queues).
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import { listErrors } from "../../services/errorTracking";
import { getSystemStatus } from "../../services/opsHealth";
import { getQueueDashboard } from "../../services/queueMetrics";
import {
  getBackupCenterStatus,
  runManualBackup,
} from "../../services/backupEngine";
import {
  getPermissionMatrix,
  setRolePermission,
} from "../../services/rbac";
import type { UserRole } from "@prisma/client";
import { getIdentityDashboard } from "../../services/identityDashboard";

export async function adminRoutes(app: FastifyInstance) {
  app.get(
    "/admin/identity",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.USER_MANAGE),
      ],
    },
    async (_request, reply: FastifyReply) => {
      try {
        const data = await getIdentityDashboard();
        return reply.send({
          success: true,
          ...data,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load identity dashboard",
        });
      }
    }
  );

  app.get(
    "/admin/rbac/matrix",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.ROLE_MANAGE),
      ],
    },
    async (_request, reply: FastifyReply) => {
      try {
        const matrix = await getPermissionMatrix();
        return reply.send({
          success: true,
          ...matrix,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load permission matrix",
        });
      }
    }
  );

  app.post(
    "/admin/rbac/matrix/toggle",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.ROLE_MANAGE),
      ],
    },
    async (request, reply: FastifyReply) => {
      const { role, permissionKey, enabled } =
        (request.body ?? {}) as {
          role?: string;
          permissionKey?: string;
          enabled?: boolean;
        };

      if (!role || !permissionKey || typeof enabled !== "boolean") {
        return reply.status(400).send({
          success: false,
          error: "role, permissionKey, and enabled are required",
        });
      }

      try {
        const result = await setRolePermission({
          role: role as UserRole,
          permissionKey,
          enabled,
          actor: {
            id: request.user!.id,
            name: request.user!.name,
            role: request.user!.role as UserRole,
          },
        });
        return reply.send({ success: true, ...result });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Toggle failed",
        });
      }
    }
  );

  app.get(
    "/admin/system",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.SYSTEM_VIEW),
      ],
    },
    async () => getSystemStatus()
  );

  app.get(
    "/admin/errors",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.SYSTEM_VIEW),
      ],
    },
    async (request) => {
      const query = request.query as {
        limit?: string;
        cursor?: string;
      };

      const limit = query.limit
        ? Number.parseInt(query.limit, 10)
        : 50;

      const cursor = query.cursor ?? undefined;

      return listErrors({
        limit: Number.isFinite(limit) ? limit : 50,
        cursor,
      });
    }
  );

  app.get(
    "/admin/queues",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.SYSTEM_VIEW),
      ],
    },
    async () => getQueueDashboard()
  );

  app.get(
    "/admin/backups",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.SYSTEM_VIEW),
      ],
    },
    async () => getBackupCenterStatus()
  );

  app.post(
    "/admin/backups/run",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.SYSTEM_VIEW),
      ],
    },
    async (request, reply: FastifyReply) => {
      try {
        const actor = request.user
          ? {
              id: request.user.id,
              name: request.user.name,
              role: request.user.role,
            }
          : undefined;

        return await runManualBackup(actor);
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Backup failed",
        });
      }
    }
  );
}

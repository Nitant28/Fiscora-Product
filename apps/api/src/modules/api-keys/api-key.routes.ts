/**
 * Module: API Platform (Sprint 27).
 * Endpoints:
 *   GET    /settings/api-keys          — list keys (secrets never returned)
 *   GET    /settings/api-keys/scopes   — available scopes
 *   POST   /settings/api-keys          — create key (secret returned once)
 *   DELETE /settings/api-keys/:id      — revoke key
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import { getTenantId } from "../../lib/tenantContext";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listAvailableScopes,
} from "../../services/apiKey.service";

export async function apiKeyRoutes(app: FastifyInstance) {
  app.get(
    "/settings/api-keys",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.API_KEY_MANAGE),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.user!.tenantId ?? getTenantId();
      const keys = await listApiKeys(tenantId);
      return reply.send({ success: true, keys });
    }
  );

  app.get(
    "/settings/api-keys/scopes",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.API_KEY_MANAGE),
      ],
    },
    async (_request, reply: FastifyReply) => {
      return reply.send({
        success: true,
        scopes: listAvailableScopes(),
      });
    }
  );

  app.post(
    "/settings/api-keys",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.API_KEY_MANAGE),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.user!.tenantId ?? getTenantId();
      const body = (request.body ?? {}) as {
        name?: string;
        scopes?: string[];
        expiresAt?: string;
      };

      if (!body.name || !body.name.trim()) {
        return reply.status(400).send({
          success: false,
          error: "A key name is required",
        });
      }

      const created = await createApiKey({
        tenantId,
        name: body.name,
        scopes: Array.isArray(body.scopes) ? body.scopes : [],
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        actor: {
          id: request.user!.id,
          name: request.user!.name,
          role: request.user!.role,
        },
      });

      return reply.send({ success: true, key: created });
    }
  );

  app.delete(
    "/settings/api-keys/:id",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.API_KEY_MANAGE),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.user!.tenantId ?? getTenantId();
      const { id } = request.params as { id: string };

      try {
        const result = await revokeApiKey({
          tenantId,
          keyId: Number.parseInt(id, 10),
          actor: {
            id: request.user!.id,
            name: request.user!.name,
            role: request.user!.role,
          },
        });
        return reply.send({ success: true, ...result });
      } catch (error) {
        return reply.status(404).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Revoke failed",
        });
      }
    }
  );
}

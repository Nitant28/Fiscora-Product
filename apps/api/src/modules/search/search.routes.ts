/**
 * Module: Enterprise Search (Sprint 22).
 * Endpoints:
 *   GET /search?q=... — RBAC-filtered, tenant-scoped, ranked, grouped results.
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { UserRole } from "@prisma/client";
import { requireAuth } from "../../lib/authMiddleware";
import { runSearch } from "../../services/search.service";

export async function searchRoutes(app: FastifyInstance) {
  app.get(
    "/search",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { q } = (request.query ?? {}) as { q?: string };
      const result = await runSearch(
        request.user!.role as UserRole,
        q ?? ""
      );
      return reply.send({ success: true, ...result });
    }
  );
}

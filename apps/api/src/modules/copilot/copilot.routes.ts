/**
 * Module: AI Copilot.
 * Endpoints:
 *   POST /copilot/ask   — grounded, RBAC-scoped answer + optional navigation.
 *   GET  /copilot/pages — pages the current user may be navigated to.
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../../lib/authMiddleware";
import { askCopilot } from "../../services/copilot/copilot.service";
import { accessiblePages } from "../../services/copilot/navigation";

const askSchema = z.object({
  message: z.string().min(1).max(1000),
});

export async function copilotRoutes(app: FastifyInstance) {
  app.post(
    "/copilot/ask",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = askSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: "A non-empty 'message' is required.",
        });
      }

      const u = request.user!;
      const response = await askCopilot(
        {
          id: u.id,
          name: u.name,
          role: u.role as UserRole,
          tenantId: u.tenantId as number,
        },
        parsed.data.message
      );

      return reply.send({ success: true, ...response });
    }
  );

  app.get(
    "/copilot/pages",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const pages = accessiblePages(request.user!.role as UserRole).map(
        (p) => ({ id: p.id, label: p.label, path: p.path })
      );
      return reply.send({ success: true, pages });
    }
  );
}

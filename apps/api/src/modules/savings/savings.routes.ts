import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import { getSavingsIntelligenceDashboard } from "../../services/savingsIntelligence";

export async function savingsRoutes(app: FastifyInstance) {
  app.get(
    "/savings/dashboard",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.CONTROL_VIEW),
      ],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const dashboard =
          await getSavingsIntelligenceDashboard();

        return reply.send({
          success: true,
          ...dashboard,
        });
      } catch (error) {
        console.error("Savings dashboard failed:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load savings intelligence",
        });
      }
    }
  );
}

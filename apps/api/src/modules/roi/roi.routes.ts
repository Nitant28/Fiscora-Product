import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import { getRoiDashboard } from "../../services/roiIntelligence";

export async function roiRoutes(app: FastifyInstance) {
  app.get(
    "/roi/dashboard",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.CONTROL_VIEW),
      ],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const dashboard = await getRoiDashboard();

        return reply.send({
          success: true,
          ...dashboard,
        });
      } catch (error) {
        console.error("ROI dashboard failed:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load ROI dashboard",
        });
      }
    }
  );
}

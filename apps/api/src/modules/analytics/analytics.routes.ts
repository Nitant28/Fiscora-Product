/**
 * Module: Analytics
 * Sprint 16 — Procurement Intelligence endpoints added.
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type {
  CfoDashboardResponse,
  VendorRiskResponse,
} from "../../types/analytics";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import { getCfoDashboardData } from "../../services/cfoDashboard";
import { getVendorRiskAnalysis } from "../../services/vendorRisk";
import {
  getProcurementIntelligenceDashboard,
  getSpendAnalytics,
} from "../../services/procurementIntelligence";

export async function analyticsRoutes(
  app: FastifyInstance
) {
  app.get(
    "/analytics/spend",
    { preHandler: requirePermission(PERMISSION_KEYS.CONTROL_VIEW) },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await getSpendAnalytics();
        return reply.send({ success: true, ...data });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load spend analytics",
        });
      }
    }
  );

  app.get(
    "/analytics/procurement",
    { preHandler: requirePermission(PERMISSION_KEYS.CONTROL_VIEW) },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await getProcurementIntelligenceDashboard();
        return reply.send({ success: true, ...data });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load procurement intelligence",
        });
      }
    }
  );

  app.get(
    "/analytics/cfo",
    { preHandler: requirePermission(PERMISSION_KEYS.CASHFORECAST_VIEW) },
    async (
      _request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        const data = await getCfoDashboardData();

        const response: CfoDashboardResponse = {
          success: true,
          data,
        };

        return reply.send(response);
      } catch (error) {
        console.error(error);

        return reply.status(500).send({
          success: false,
          error: "Failed to load CFO dashboard",
        });
      }
    }
  );

  app.get(
    "/analytics/vendor-risk",
    { preHandler: requirePermission(PERMISSION_KEYS.CONTROL_VIEW) },
    async (
      _request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        const analysis =
          await getVendorRiskAnalysis();

        const response: VendorRiskResponse = {
          success: true,
          ...analysis,
        };

        return reply.send(response);
      } catch (error) {
        console.error(error);

        return reply.status(500).send({
          success: false,
          error: "Failed to load vendor risk analysis",
        });
      }
    }
  );
}

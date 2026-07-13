/**
 * Static contract routes — must register before /contracts/:id.
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { getExpiringContracts } from "../../services/contractAlerts";
import { getRenewalQueue } from "../../services/contractRisk";
import { getContractIntelligenceDashboard } from "../../services/contractIntelligence";
import {
  VENDOR_CONTRACT_ACTIONS,
  executeVendorContractAction,
  type VendorContractAction,
} from "../../services/contractActions";
import { getExecutiveRecommendations } from "../../services/executiveRecommendations";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";

export async function contractStaticRoutes(
  app: FastifyInstance
) {
  app.get(
    "/contracts/intelligence",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.CONTRACT_VIEW),
      ],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const dashboard =
          await getContractIntelligenceDashboard();

        return reply.send({
          success: true,
          ...dashboard,
        });
      } catch (error) {
        console.error("Contract intelligence failed:", error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load contract intelligence",
        });
      }
    }
  );

  app.get(
    "/contracts/renewals",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.CONTRACT_VIEW),
      ],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const queue = await getRenewalQueue();

        return reply.send({
          success: true,
          queue,
        });
      } catch (error) {
        console.error("Renewal queue failed:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load renewal queue",
        });
      }
    }
  );

  app.get(
    "/contracts/expiring",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.CONTRACT_VIEW),
      ],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const contracts = await getExpiringContracts();

        return reply.send({
          success: true,
          contracts,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load expiring contracts",
        });
      }
    }
  );

  app.get(
    "/executive/recommendations",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.CONTRACT_VIEW),
      ],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await getExecutiveRecommendations();

        return reply.send({
          success: true,
          ...data,
        });
      } catch (error) {
        console.error("Executive recommendations failed:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load executive recommendations",
        });
      }
    }
  );

  app.post(
    "/vendors/:id/contract-action/:action",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.CONTRACT_MANAGE),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, action } = request.params as {
          id: string;
          action: string;
        };

        if (!/^\d+$/.test(id)) {
          return reply.status(404).send({
            success: false,
            error: "Vendor not found",
          });
        }

        if (
          !VENDOR_CONTRACT_ACTIONS.includes(
            action as VendorContractAction
          )
        ) {
          return reply.status(400).send({
            success: false,
            error: "Invalid vendor contract action",
          });
        }

        const result = await executeVendorContractAction(
          Number(id),
          action as VendorContractAction,
          request.user!.name,
          request.user!.id
        );

        return reply.send(result);
      } catch (error) {
        console.error("Vendor contract action failed:", error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Vendor contract action failed",
        });
      }
    }
  );
}

/**
 * Module: Contracts
 * Purpose: Vendor contract lifecycle — list, detail, expiring alerts, create, and update.
 * Endpoints:
 *   GET   /contracts
 *   GET   /contracts/expiring
 *   GET   /contracts/:id
 *   POST  /contracts
 *   PATCH /contracts/:id
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import {
  createContract,
  getContractById,
  listContracts,
  updateContract,
} from "../../services/contracts";
import {
  CONTRACT_ACTIONS,
  executeContractAction,
  type ContractAction,
} from "../../services/contractActions";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";

export async function contractRoutes(
  app: FastifyInstance
) {
  // --- List contracts ---
  app.get(
    "/contracts",
    { preHandler: requirePermission(PERMISSION_KEYS.CONTRACT_VIEW) },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const contracts = await listContracts();
        return reply.send({ success: true, contracts });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to list contracts",
        });
      }
    }
  );

  // --- Contract actions (Action Center) ---
  app.post(
    "/contracts/:id/:action",
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
            error: "Contract not found",
          });
        }

        if (
          !CONTRACT_ACTIONS.includes(
            action as ContractAction
          )
        ) {
          return reply.status(400).send({
            success: false,
            error: "Invalid contract action",
          });
        }

        const result = await executeContractAction(
          Number(id),
          action as ContractAction,
          request.user!.name,
          request.user!.id
        );

        return reply.send(result);
      } catch (error) {
        console.error("Contract action failed:", error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Contract action failed",
        });
      }
    }
  );

  // --- Get contract by id ---
  app.get(
    "/contracts/:id",
    { preHandler: requirePermission(PERMISSION_KEYS.CONTRACT_VIEW) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const rawId = (request.params as { id: string }).id;

        if (!/^\d+$/.test(rawId)) {
          return reply.status(404).send({
            success: false,
            error: "Contract not found",
          });
        }

        const id = Number(rawId);

        if (Number.isNaN(id)) {
          return reply.status(400).send({
            success: false,
            error: "Invalid contract id",
          });
        }

        const contract =
          await getContractById(id);

        if (!contract) {
          return reply.status(404).send({
            success: false,
            error: "Contract not found",
          });
        }

        return reply.send({
          success: true,
          contract,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load contract",
        });
      }
    }
  );

  // --- Create contract ---
  app.post(
    "/contracts",
    { preHandler: requirePermission(PERMISSION_KEYS.CONTRACT_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body =
          request.body as {
            contractNumber?: string;
            title?: string;
            vendorId?: number;
            startDate?: string;
            endDate?: string;
            renewalDate?: string | null;
            value?: number;
            autoRenew?: boolean;
            documentUrl?: string | null;
            status?: "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED";
          };

        if (
          !body.vendorId ||
          !body.startDate ||
          !body.endDate ||
          body.value == null
        ) {
          return reply.status(400).send({
            success: false,
            error: "vendorId, startDate, endDate, value required",
          });
        }

        const contract = await createContract({
          contractNumber: body.contractNumber,
          title: body.title,
          vendorId: body.vendorId,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          renewalDate: body.renewalDate
            ? new Date(body.renewalDate)
            : null,
          value: body.value,
          autoRenew: body.autoRenew,
          documentUrl: body.documentUrl,
          status: body.status,
          actor: request.user!.name,
        });

        return reply.status(201).send({
          success: true,
          contract,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to create contract",
        });
      }
    }
  );

  // --- Update contract ---
  app.patch(
    "/contracts/:id",
    { preHandler: requirePermission(PERMISSION_KEYS.CONTRACT_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const id = Number(
          (request.params as { id: string }).id
        );

        if (Number.isNaN(id)) {
          return reply.status(400).send({
            success: false,
            error: "Invalid contract id",
          });
        }

        const body =
          request.body as {
            contractNumber?: string;
            title?: string;
            vendorId?: number;
            startDate?: string;
            endDate?: string;
            renewalDate?: string | null;
            value?: number;
            autoRenew?: boolean;
            documentUrl?: string | null;
            status?: "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED";
          };

        const contract = await updateContract(
          id,
          {
            contractNumber: body.contractNumber,
            title: body.title,
            vendorId: body.vendorId,
            startDate: body.startDate
              ? new Date(body.startDate)
              : undefined,
            endDate: body.endDate
              ? new Date(body.endDate)
              : undefined,
            renewalDate:
              body.renewalDate === undefined
                ? undefined
                : body.renewalDate
                  ? new Date(body.renewalDate)
                  : null,
            value: body.value,
            autoRenew: body.autoRenew,
            documentUrl: body.documentUrl,
            status: body.status,
            actor: request.user!.name,
          }
        );

        if (!contract) {
          return reply.status(404).send({
            success: false,
            error: "Contract not found",
          });
        }

        return reply.send({
          success: true,
          contract,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to update contract",
        });
      }
    }
  );
}

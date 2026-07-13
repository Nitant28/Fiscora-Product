/**
 * Module: Email Approvals — token-based approve/reject without login.
 */
import type { FastifyInstance } from "fastify";
import {
  approveViaEmailToken,
  getEmailApprovalPreview,
  rejectViaEmailToken,
} from "./email-approval.service";

export async function emailApprovalRoutes(
  app: FastifyInstance
) {
  app.get(
    "/email-approvals/preview/:token",
    async (request, reply) => {
      const { token } = request.params as {
        token: string;
      };

      const preview =
        await getEmailApprovalPreview(token);

      if (!preview) {
        return reply.status(404).send({
          success: false,
          error: "Approval link not found",
        });
      }

      return preview;
    }
  );

  app.post(
    "/email-approvals/approve/:token",
    async (request, reply) => {
      const { token } = request.params as {
        token: string;
      };

      try {
        const result =
          await approveViaEmailToken(token);
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Approval failed";

        return reply.status(400).send({
          success: false,
          error: message,
        });
      }
    }
  );

  app.post(
    "/email-approvals/reject/:token",
    async (request, reply) => {
      const { token } = request.params as {
        token: string;
      };

      try {
        const result =
          await rejectViaEmailToken(token);
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Rejection failed";

        return reply.status(400).send({
          success: false,
          error: message,
        });
      }
    }
  );
}

/**
 * Module: Billing — commercial layer (Sprint 19).
 * Endpoints:
 *   GET  /billing/plans
 *   GET  /billing/subscription
 *   GET  /billing/invoices
 *   POST /billing/subscription/change-plan
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { requireAuth, requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import { getTenantId } from "../../lib/tenantContext";
import {
  listPlans,
  getSubscriptionSummary,
  listBillingInvoices,
  changePlan,
  seedBillingCatalog,
} from "../../services/billing.service";

export async function billingRoutes(app: FastifyInstance) {
  app.get(
    "/billing/plans",
    { preHandler: requireAuth },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      await seedBillingCatalog().catch(() => {});
      const plans = await listPlans();
      return reply.send({ success: true, plans });
    }
  );

  app.get(
    "/billing/subscription",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.user!.tenantId ?? getTenantId();
      const subscription = await getSubscriptionSummary(tenantId);
      return reply.send({ success: true, subscription });
    }
  );

  app.get(
    "/billing/invoices",
    {
      preHandler: requirePermission(PERMISSION_KEYS.BILLING_VIEW),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.user!.tenantId ?? getTenantId();
      const invoices = await listBillingInvoices(tenantId);
      return reply.send({ success: true, invoices });
    }
  );

  app.post(
    "/billing/subscription/change-plan",
    {
      preHandler: requirePermission(PERMISSION_KEYS.BILLING_MANAGE),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { planSlug } = (request.body ?? {}) as {
        planSlug?: string;
      };
      if (!planSlug?.trim()) {
        return reply.status(400).send({
          success: false,
          error: "planSlug is required",
        });
      }

      try {
        const tenantId = request.user!.tenantId ?? getTenantId();
        const subscription = await changePlan(
          tenantId,
          planSlug.trim().toLowerCase(),
          {
            id: request.user!.id,
            name: request.user!.name,
          }
        );
        return reply.send({ success: true, subscription });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Plan change failed",
        });
      }
    }
  );
}

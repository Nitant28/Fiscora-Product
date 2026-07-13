/**
 * Feature gate — blocks routes when the tenant's plan doesn't include a feature.
 * Use alongside requireAuth/requirePermission on premium endpoints.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  BILLING_FEATURES,
  isFeatureEnabled,
  type BillingFeatureKey,
} from "../services/billing.service";
import { getTenantId } from "./tenantContext";

export { BILLING_FEATURES };

export function requireFeature(featureKey: BillingFeatureKey | string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.user?.tenantId ?? getTenantId();
    const enabled = await isFeatureEnabled(tenantId, featureKey);

    if (!enabled) {
      return reply.status(403).send({
        success: false,
        code: "FEATURE_NOT_AVAILABLE",
        feature: featureKey,
        error:
          "This feature is not included in your current plan. Upgrade to unlock it.",
        upgradeUrl: "/settings/billing",
      });
    }
  };
}

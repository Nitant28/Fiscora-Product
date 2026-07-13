/**
 * Tenant resolution for API requests.
 * Sprint 14A: hardcoded default; later resolved from session user.
 */
import type { FastifyRequest } from "fastify";
import { getTenantId, setTenantId } from "../lib/tenantContext";

export { getTenantId, setTenantId, runWithTenantId, tenantWhere } from "../lib/tenantContext";

/** Attach tenant context before route handlers run. */
export async function resolveTenant(request: FastifyRequest) {
  const fromUser = request.user?.tenantId;
  setTenantId(typeof fromUser === "number" ? fromUser : 1);
}

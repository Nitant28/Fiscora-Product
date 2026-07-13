/**
 * Request-scoped tenant context for multi-tenant data isolation.
 */
import { AsyncLocalStorage } from "async_hooks";

type TenantContext = {
  tenantId: number;
};

const storage = new AsyncLocalStorage<TenantContext>();

/** Default tenant until auth resolves tenant from session user. */
const DEFAULT_TENANT_ID = 1;

export async function runWithTenantId<T>(
  tenantId: number,
  fn: () => Promise<T> | T
): Promise<T> {
  return storage.run({ tenantId }, async () => await fn());
}

export function setTenantId(tenantId: number) {
  storage.enterWith({ tenantId });
}

export function getTenantId(): number {
  return storage.getStore()?.tenantId ?? DEFAULT_TENANT_ID;
}

export function tenantWhere<T extends Record<string, unknown>>(
  where: T = {} as T
): T & { tenantId: number } {
  return { ...where, tenantId: getTenantId() };
}

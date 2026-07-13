/**
 * Request-scoped context for correlation IDs (audit, errors, logs).
 */
import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";

export type RequestContext = {
  requestId: string;
  userId?: number;
  route?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function formatRequestId(raw?: string): string {
  if (!raw) {
    return `REQ-${cryptoRandom()}`;
  }

  if (raw.startsWith("REQ-")) {
    return raw;
  }

  return `REQ-${raw}`;
}

function cryptoRandom(): string {
  return crypto.randomUUID();
}

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function getRequestUserId(): number | undefined {
  return storage.getStore()?.userId;
}

export function getRequestIp(): string | undefined {
  return storage.getStore()?.ip;
}

export function getRequestUserAgent(): string | undefined {
  return storage.getStore()?.userAgent;
}

export function setRequestContext(context: RequestContext) {
  storage.enterWith(context);
}

export function setRequestUserId(userId: number) {
  const current = storage.getStore();

  if (current) {
    storage.enterWith({ ...current, userId });
  }
}

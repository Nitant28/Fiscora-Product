/**
 * Operations endpoints — health, readiness, version probes.
 */
import prisma from "../db";
import {
  getInvoiceQueueStats,
  getWorkerHeartbeat,
  pingRedis,
} from "../queue";
import { isRbacCacheLoaded } from "../services/rbac";

export const FISCORA_VERSION =
  process.env.FISCORA_VERSION ?? "0.8.5";

export const FISCORA_BUILD =
  process.env.FISCORA_BUILD ?? "2026-06-14";

const startedAt = Date.now();

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function getHealthStatus() {
  const [database, redis] = await Promise.all([
    checkDatabase(),
    pingRedis(),
  ]);

  return {
    status: database ? "ok" : "degraded",
    database,
    redis,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
}

export async function getReadyStatus() {
  const [database, redis, rbacLoaded] =
    await Promise.all([
      checkDatabase(),
      pingRedis(),
      Promise.resolve(isRbacCacheLoaded()),
    ]);

  const ready = database && redis && rbacLoaded;

  return {
    ready,
    database,
    redis,
    rbacLoaded,
  };
}

export function getVersionInfo() {
  return {
    version: FISCORA_VERSION,
    build: FISCORA_BUILD,
    environment:
      process.env.NODE_ENV ?? "development",
  };
}

export type SystemComponentStatus =
  | "healthy"
  | "warning"
  | "critical";

export type SystemComponent = {
  id: string;
  label: string;
  status: SystemComponentStatus;
  detail: string;
};

function componentStatus(
  ok: boolean,
  warn = false
): SystemComponentStatus {
  if (!ok) {
    return "critical";
  }

  if (warn) {
    return "warning";
  }

  return "healthy";
}

export async function getSystemStatus(): Promise<{
  overall: SystemComponentStatus;
  uptime: number;
  version: ReturnType<typeof getVersionInfo>;
  components: SystemComponent[];
  timestamp: string;
}> {
  const [
    database,
    redis,
    rbacLoaded,
    worker,
    invoiceQueueStats,
  ] = await Promise.all([
    checkDatabase(),
    pingRedis(),
    Promise.resolve(isRbacCacheLoaded()),
    getWorkerHeartbeat(),
    getInvoiceQueueStats(),
  ]);

  const queueBacklog =
    invoiceQueueStats.waiting + invoiceQueueStats.active;

  const components: SystemComponent[] = [
    {
      id: "api",
      label: "API",
      status: "healthy",
      detail: `Uptime ${Math.floor((Date.now() - startedAt) / 1000)}s`,
    },
    {
      id: "database",
      label: "Database",
      status: componentStatus(database),
      detail: database ? "PostgreSQL connected" : "Connection failed",
    },
    {
      id: "redis",
      label: "Redis",
      status: componentStatus(redis),
      detail: redis ? "PING ok" : "Unreachable",
    },
    {
      id: "worker",
      label: "Worker",
      status: componentStatus(
        worker.alive,
        !worker.alive && queueBacklog === 0
      ),
      detail: worker.alive
        ? `Last heartbeat ${worker.lastSeen ?? "—"}`
        : "Invoice OCR worker not detected",
    },
    {
      id: "queue",
      label: "Queue",
      status: componentStatus(
        redis,
        invoiceQueueStats.failed > 0 || queueBacklog > 20
      ),
      detail: redis
        ? `${queueBacklog} active/waiting, ${invoiceQueueStats.failed} failed`
        : "Redis required for BullMQ",
    },
  ];

  if (!rbacLoaded) {
    components.push({
      id: "rbac",
      label: "RBAC Cache",
      status: "warning",
      detail: "Permission cache not loaded",
    });
  }

  const overall: SystemComponentStatus = components.some(
    (c) => c.status === "critical"
  )
    ? "critical"
    : components.some((c) => c.status === "warning")
      ? "warning"
      : "healthy";

  return {
    overall,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    version: getVersionInfo(),
    components,
    timestamp: new Date().toISOString(),
  };
}

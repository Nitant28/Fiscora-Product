/**
 * BullMQ job queue for async invoice processing (worker consumes this queue).
 *
 * Redis is treated as an OPTIONAL dependency: if it is unavailable the API still
 * boots and serves traffic. Queue operations degrade gracefully (callers wrap
 * them in try/catch and return safe defaults). This avoids a hard production
 * coupling on Redis just to start the process and prevents log flooding when
 * Redis is down.
 */
import { Queue } from "bullmq";
import IORedis from "ioredis";

// Docker maps Redis to host port 6380 (non-default) to avoid colliding with any
// other local Redis on the default 6379. Keep this fallback in sync with .env.
const REDIS_URL =
  process.env.REDIS_URL ?? "redis://localhost:6380";

// Cap reconnection attempts and back off so a missing Redis doesn't flood logs.
// `enableOfflineQueue: false` makes commands fail fast instead of buffering.
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy(times) {
    // Stop retrying after ~10 attempts; reconnect later via explicit ping.
    if (times > 10) {
      return null;
    }
    return Math.min(times * 500, 5000);
  },
  reconnectOnError() {
    return false;
  },
});

// Throttle Redis error logging to a single warning instead of a stack-trace storm.
let redisErrorLogged = false;
connection.on("error", (err: Error & { code?: string }) => {
  if (!redisErrorLogged) {
    redisErrorLogged = true;
    console.warn(
      `[queue] Redis unavailable (${err.code ?? err.message}). ` +
        "Async invoice processing is disabled until Redis is reachable."
    );
  }
});
connection.on("ready", () => {
  redisErrorLogged = false;
  console.log("[queue] Redis connection ready.");
});

// Kick off a connection attempt without blocking startup.
connection.connect().catch(() => {
  /* handled by the 'error' listener above */
});

/* --- INVOICE PROCESSING QUEUE --- */
export const invoiceQueue = new Queue(
  "invoice-processing",
  {
    connection: connection as any,
  }
);

export async function pingRedis(): Promise<boolean> {
  try {
    const result = await connection.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

export const WORKER_HEARTBEAT_KEY =
  "worker:invoice-processing:heartbeat";

export const WORKER_HEARTBEAT_MAX_AGE_MS = 90_000;

export async function getWorkerHeartbeat(): Promise<{
  alive: boolean;
  lastSeen: string | null;
  ageMs: number | null;
}> {
  try {
    const val = await connection.get(WORKER_HEARTBEAT_KEY);

    if (!val) {
      return { alive: false, lastSeen: null, ageMs: null };
    }

    const ts = Number.parseInt(val, 10);
    const ageMs = Date.now() - ts;

    return {
      alive: ageMs < WORKER_HEARTBEAT_MAX_AGE_MS,
      lastSeen: new Date(ts).toISOString(),
      ageMs,
    };
  } catch {
    return { alive: false, lastSeen: null, ageMs: null };
  }
}

export async function getInvoiceQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}> {
  try {
    const counts = await invoiceQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused"
    );

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    };
  } catch {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };
  }
}

/**
 * Domain: Queue monitoring — BullMQ + DB-backed job pipelines for admin dashboard.
 */
import prisma from "../db";
import {
  getInvoiceQueueStats,
  getWorkerHeartbeat,
} from "../queue";

export type QueueMetricCounts = {
  pending: number;
  running: number;
  failed: number;
  completed: number;
};

export type QueueDashboardRow = {
  id: string;
  label: string;
  type: "bullmq" | "database" | "sync";
  status: "healthy" | "warning" | "critical";
  metrics: QueueMetricCounts;
  detail?: string;
};

function deriveStatus(
  metrics: QueueMetricCounts,
  opts?: { failedCritical?: number; pendingWarning?: number }
): "healthy" | "warning" | "critical" {
  const failedCritical = opts?.failedCritical ?? 5;
  const pendingWarning = opts?.pendingWarning ?? 25;

  if (metrics.failed >= failedCritical) {
    return "critical";
  }

  if (metrics.failed > 0 || metrics.pending >= pendingWarning) {
    return "warning";
  }

  return "healthy";
}

export async function getNotificationQueueMetrics(): Promise<QueueDashboardRow> {
  const [pending, failed, completed] = await Promise.all([
    prisma.notificationQueue.count({
      where: { status: "PENDING" },
    }),
    prisma.notificationQueue.count({
      where: { status: "FAILED" },
    }),
    prisma.notificationQueue.count({
      where: { status: "SENT" },
    }),
  ]);

  const metrics: QueueMetricCounts = {
    pending,
    running: 0,
    failed,
    completed,
  };

  return {
    id: "notifications",
    label: "Notifications",
    type: "database",
    status: deriveStatus(metrics),
    metrics,
    detail: "Email and in-app notification dispatch queue",
  };
}

export async function getEmailApprovalQueueMetrics(): Promise<QueueDashboardRow> {
  const now = new Date();

  const [pending, completed, failed] = await Promise.all([
    prisma.approvalToken.count({
      where: {
        usedAt: null,
        expiresAt: { gt: now },
      },
    }),
    prisma.approvalToken.count({
      where: { usedAt: { not: null } },
    }),
    prisma.approvalToken.count({
      where: {
        usedAt: null,
        expiresAt: { lte: now },
      },
    }),
  ]);

  const metrics: QueueMetricCounts = {
    pending,
    running: 0,
    failed,
    completed,
  };

  return {
    id: "email-approvals",
    label: "Email Approvals",
    type: "database",
    status: deriveStatus(metrics, { pendingWarning: 50 }),
    metrics,
    detail: "Token-based approve/reject links sent via email",
  };
}

export async function getInvoiceOcrQueueMetrics(): Promise<QueueDashboardRow> {
  const [bullCounts, worker, docCounts] = await Promise.all([
    getInvoiceQueueStats(),
    getWorkerHeartbeat(),
    Promise.all([
      prisma.document.count({ where: { status: "queued" } }),
      prisma.document.count({ where: { status: "processing" } }),
      prisma.document.count({ where: { status: "failed" } }),
      prisma.document.count({ where: { status: "processed" } }),
    ]),
  ]);

  const [queuedDocs, processingDocs, failedDocs, processedDocs] =
    docCounts;

  const metrics: QueueMetricCounts = {
    pending: bullCounts.waiting + queuedDocs,
    running: bullCounts.active + processingDocs,
    failed: bullCounts.failed + failedDocs,
    completed: bullCounts.completed + processedDocs,
  };

  let status: "healthy" | "warning" | "critical" = deriveStatus(metrics);

  if (!worker.alive && metrics.pending > 0) {
    status = "critical";
  } else if (!worker.alive) {
    status = "warning";
  }

  return {
    id: "invoice-ocr",
    label: "Invoice OCR",
    type: "bullmq",
    status,
    metrics,
    detail: worker.alive
      ? `Worker alive (last seen ${worker.lastSeen ?? "—"})`
      : "Worker heartbeat not detected — start apps/worker",
  };
}

export async function getExportQueueMetrics(): Promise<QueueDashboardRow> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const completed = await prisma.auditLog.count({
    where: {
      action: "TALLY_EXPORT",
      createdAt: { gte: since },
    },
  });

  const metrics: QueueMetricCounts = {
    pending: 0,
    running: 0,
    failed: 0,
    completed,
  };

  return {
    id: "exports",
    label: "Tally Exports",
    type: "sync",
    status: "healthy",
    metrics,
    detail: "Synchronous CSV exports (last 24h count)",
  };
}

export async function getQueueDashboard(): Promise<{
  queues: QueueDashboardRow[];
  updatedAt: string;
}> {
  const queues = await Promise.all([
    getNotificationQueueMetrics(),
    getEmailApprovalQueueMetrics(),
    getInvoiceOcrQueueMetrics(),
    getExportQueueMetrics(),
  ]);

  return {
    queues,
    updatedAt: new Date().toISOString(),
  };
}

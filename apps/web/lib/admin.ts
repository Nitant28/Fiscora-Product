import { apiFetch } from "./api";

export type SystemComponentStatus =
  | "healthy"
  | "warning"
  | "critical";

export type SystemStatus = {
  overall: SystemComponentStatus;
  uptime: number;
  version: {
    version: string;
    build: string;
    environment: string;
  };
  components: {
    id: string;
    label: string;
    status: SystemComponentStatus;
    detail: string;
  }[];
  timestamp: string;
};

export type ErrorLogRow = {
  id: string;
  requestId: string | null;
  userId: string | null;
  route: string;
  method: string;
  error: string;
  stack: string | null;
  createdAt: string;
};

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
  status: SystemComponentStatus;
  metrics: QueueMetricCounts;
  detail?: string;
};

export async function getSystemStatus(): Promise<SystemStatus> {
  const res = await apiFetch("/admin/system");

  if (!res.ok) {
    throw new Error("Failed to load system status");
  }

  return res.json();
}

export async function getAdminErrors(limit = 50): Promise<{
  errors: ErrorLogRow[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const res = await apiFetch(`/admin/errors?limit=${limit}`);

  if (!res.ok) {
    throw new Error("Failed to load error logs");
  }

  return res.json();
}

export type BackupCenterStatus = {
  status: "healthy" | "warning" | "critical";
  database: {
    label: string;
    sizeBytes: number;
    sizeLabel: string;
    status: "healthy" | "warning" | "critical";
  };
  backup: {
    status: "healthy" | "warning" | "critical";
    lastBackupAt: string | null;
    lastBackupSizeBytes: number | null;
    lastBackupSizeLabel: string | null;
    retentionDays: number;
    storageProvider: string;
    restoreTested: boolean;
    lastRestoreTestAt: string | null;
    restoreStatus: string;
  };
  recovery: {
    rpoHours: number;
    rtoHours: number;
    rpoLabel: string;
    rtoLabel: string;
  };
  environment: {
    api: string;
    storage: string;
    worker: string;
    database: string;
  };
  activeRun: boolean;
  recentRuns: {
    id: string;
    startedAt: string;
    completedAt: string | null;
    sizeBytes: number | null;
    sizeLabel: string | null;
    status: string;
    storageProvider: string;
    restoreVerified: boolean;
    triggeredBy: string | null;
    errorMessage: string | null;
  }[];
};

export async function getBackupCenterStatus(): Promise<BackupCenterStatus> {
  const res = await apiFetch("/admin/backups");

  if (!res.ok) {
    throw new Error("Failed to load backup center");
  }

  return res.json();
}

export async function getQueueDashboard(): Promise<{
  queues: QueueDashboardRow[];
  updatedAt: string;
}> {
  const res = await apiFetch("/admin/queues");

  if (!res.ok) {
    throw new Error("Failed to load queue dashboard");
  }

  return res.json();
}

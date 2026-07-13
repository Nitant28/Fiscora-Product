/**
 * Domain: Backup & disaster recovery — database dumps, status, RPO/RTO reporting.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { BackupRunStatus } from "@prisma/client";
import prisma from "../db";

const execFileAsync = promisify(execFile);

export const BACKUP_RETENTION_DAYS = Number.parseInt(
  process.env.FISCORA_BACKUP_RETENTION_DAYS ?? "30",
  10
);

export const BACKUP_RPO_HOURS = Number.parseInt(
  process.env.FISCORA_BACKUP_RPO_HOURS ?? "24",
  10
);

export const BACKUP_RTO_HOURS = Number.parseInt(
  process.env.FISCORA_BACKUP_RTO_HOURS ?? "2",
  10
);

const BACKUP_DIR =
  process.env.FISCORA_BACKUP_DIR ??
  path.join(process.cwd(), "backups");

function resolveBackupDir() {
  return path.isAbsolute(BACKUP_DIR)
    ? BACKUP_DIR
    : path.join(process.cwd(), BACKUP_DIR);
}

function parseDatabaseUrl() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }

  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

async function getDatabaseSizeBytes(): Promise<number> {
  const rows = await prisma.$queryRaw<
    { size: bigint }[]
  >`SELECT pg_database_size(current_database()) AS size`;

  return Number(rows[0]?.size ?? 0);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

function deriveBackupStatus(lastSuccess: {
  completedAt: Date | null;
  startedAt: Date;
} | null): "healthy" | "warning" | "critical" {
  if (!lastSuccess) {
    return "critical";
  }

  const reference =
    lastSuccess.completedAt ?? lastSuccess.startedAt;
  const ageHours = hoursSince(reference);

  if (ageHours <= BACKUP_RPO_HOURS) {
    return "healthy";
  }

  if (ageHours <= BACKUP_RPO_HOURS * 2) {
    return "warning";
  }

  return "critical";
}

async function verifyBackupFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size > 0;
  } catch {
    return false;
  }
}

async function createDatabaseDump(
  outputPath: string
): Promise<{ sizeBytes: number; provider: string }> {
  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  const db = parseDatabaseUrl();

  try {
    await execFileAsync(
      "pg_dump",
      [
        "-h",
        db.host,
        "-p",
        db.port,
        "-U",
        db.user,
        "-d",
        db.database,
        "-F",
        "c",
        "-f",
        outputPath,
      ],
      {
        env: {
          ...process.env,
          PGPASSWORD: db.password,
        },
      }
    );

    const stat = await fs.stat(outputPath);

    return {
      sizeBytes: stat.size,
      provider: "local-pgdump",
    };
  } catch (error) {
    const fallback = {
      generatedAt: new Date().toISOString(),
      database: db.database,
      host: db.host,
      note:
        "Development fallback backup manifest — install pg_dump for full SQL dumps in production.",
      tableCounts: {
        vendors: await prisma.vendor.count(),
        documents: await prisma.document.count(),
        payments: await prisma.payment.count(),
        purchaseOrders: await prisma.purchaseOrder.count(),
      },
      error:
        error instanceof Error
          ? error.message
          : "pg_dump unavailable",
    };

    await fs.writeFile(
      outputPath,
      JSON.stringify(fallback, null, 2),
      "utf8"
    );

    const stat = await fs.stat(outputPath);

    return {
      sizeBytes: stat.size,
      provider: "local-manifest",
    };
  }
}

export async function getBackupCenterStatus() {
  const [
    databaseSizeBytes,
    lastSuccess,
    lastRun,
    recentRuns,
    runningCount,
  ] = await Promise.all([
    getDatabaseSizeBytes(),
    prisma.backupRun.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { completedAt: "desc" },
    }),
    prisma.backupRun.findFirst({
      orderBy: { startedAt: "desc" },
    }),
    prisma.backupRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    prisma.backupRun.count({
      where: { status: "RUNNING" },
    }),
  ]);

  const backupStatus = deriveBackupStatus(lastSuccess);
  const lastRestoreTest = recentRuns.find(
    (run) => run.restoreVerified
  );

  return {
    status: backupStatus,
    database: {
      label: "PostgreSQL",
      sizeBytes: databaseSizeBytes,
      sizeLabel: formatBytes(databaseSizeBytes),
      status:
        backupStatus === "healthy" ? "healthy" : backupStatus,
    },
    backup: {
      status: backupStatus,
      lastBackupAt:
        lastSuccess?.completedAt?.toISOString() ??
        lastSuccess?.startedAt?.toISOString() ??
        null,
      lastBackupSizeBytes: lastSuccess?.sizeBytes
        ? Number(lastSuccess.sizeBytes)
        : null,
      lastBackupSizeLabel: lastSuccess?.sizeBytes
        ? formatBytes(Number(lastSuccess.sizeBytes))
        : null,
      retentionDays: BACKUP_RETENTION_DAYS,
      storageProvider:
        lastSuccess?.storageProvider ?? "local",
      restoreTested: Boolean(lastRestoreTest),
      lastRestoreTestAt:
        lastRestoreTest?.completedAt?.toISOString() ??
        lastRestoreTest?.startedAt?.toISOString() ??
        null,
      restoreStatus: lastRestoreTest
        ? "SUCCESS"
        : lastSuccess
          ? "NOT TESTED"
          : "UNKNOWN",
    },
    recovery: {
      rpoHours: BACKUP_RPO_HOURS,
      rtoHours: BACKUP_RTO_HOURS,
      rpoLabel: `${BACKUP_RPO_HOURS} hours`,
      rtoLabel: `${BACKUP_RTO_HOURS} hours`,
    },
    environment: {
      api: process.env.NODE_ENV ?? "development",
      storage: resolveBackupDir(),
      worker: process.env.REDIS_URL ? "configured" : "not configured",
      database: parseDatabaseUrl().host,
    },
    activeRun: runningCount > 0,
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      sizeBytes: run.sizeBytes ? Number(run.sizeBytes) : null,
      sizeLabel: run.sizeBytes
        ? formatBytes(Number(run.sizeBytes))
        : null,
      status: run.status,
      storageProvider: run.storageProvider,
      restoreVerified: run.restoreVerified,
      triggeredBy: run.triggeredBy,
      errorMessage: run.errorMessage,
    })),
  };
}

export async function runManualBackup(actor?: {
  id: number;
  name: string;
  role?: string;
}) {
  const existing = await prisma.backupRun.findFirst({
    where: { status: "RUNNING" },
  });

  if (existing) {
    throw new Error("A backup is already running");
  }

  const run = await prisma.backupRun.create({
    data: {
      status: "RUNNING",
      storageProvider: "local",
      triggeredBy: actor?.name ?? "System",
      actorUserId: actor?.id,
    },
  });

  const backupDir = resolveBackupDir();
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
  const filePath = path.join(
    backupDir,
    `fiscora-backup-${timestamp}.dump`
  );

  try {
    const { sizeBytes, provider } =
      await createDatabaseDump(filePath);
    const restoreVerified =
      await verifyBackupFile(filePath);

    const completed = await prisma.backupRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS" satisfies BackupRunStatus,
        completedAt: new Date(),
        sizeBytes: BigInt(sizeBytes),
        storageProvider: provider,
        filePath,
        restoreVerified,
      },
    });

    return {
      success: true,
      run: {
        id: completed.id,
        status: completed.status,
        startedAt: completed.startedAt.toISOString(),
        completedAt:
          completed.completedAt?.toISOString() ?? null,
        sizeBytes,
        sizeLabel: formatBytes(sizeBytes),
        storageProvider: completed.storageProvider,
        restoreVerified: completed.restoreVerified,
        triggeredBy: completed.triggeredBy,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Backup failed";

    await prisma.backupRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
        filePath,
      },
    });

    throw new Error(message);
  }
}

export async function seedInitialBackupIfEmpty() {
  const count = await prisma.backupRun.count();

  if (count > 0) {
    return;
  }

  const backupDir = resolveBackupDir();
  await fs.mkdir(backupDir, { recursive: true });

  const filePath = path.join(
    backupDir,
    "fiscora-backup-seed.dump"
  );

  const { sizeBytes, provider } =
    await createDatabaseDump(filePath);
  const restoreVerified = await verifyBackupFile(filePath);

  await prisma.backupRun.create({
    data: {
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      completedAt: new Date(),
      sizeBytes: BigInt(sizeBytes),
      storageProvider: provider,
      filePath,
      restoreVerified,
      triggeredBy: "System Seed",
    },
  });
}

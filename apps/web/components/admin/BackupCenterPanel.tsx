"use client";

import { useState } from "react";
import type { BackupCenterStatus } from "../../lib/admin";
import { StatusPill } from "./ErrorCenterPanel";

type Props = {
  initial: BackupCenterStatus;
};

export default function BackupCenterPanel({ initial }: Props) {
  const [status, setStatus] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runBackup() {
    setRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/proxy/admin/backups/run", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Backup failed");
      }

      const refresh = await fetch("/api/proxy/admin/backups");
      const next = await refresh.json();
      setStatus(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Backup failed"
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Backup status
            </p>
            <div className="mt-2">
              <StatusPill status={mapStatus(status.status)} />
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Enterprise recovery posture for pilot and production
              deployments. RPO {status.recovery.rpoLabel} · RTO{" "}
              {status.recovery.rtoLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={runBackup}
            disabled={running || status.activeRun}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running || status.activeRun
              ? "Running backup..."
              : "Run backup now"}
          </button>
        </div>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Last backup"
          value={
            status.backup.lastBackupAt
              ? new Date(
                  status.backup.lastBackupAt
                ).toLocaleString()
              : "Never"
          }
          detail={
            status.backup.lastBackupSizeLabel
              ? `${status.backup.lastBackupSizeLabel} · ${status.backup.storageProvider}`
              : "No successful backup yet"
          }
        />
        <MetricCard
          label="Database size"
          value={status.database.sizeLabel}
          detail={status.database.label}
        />
        <MetricCard
          label="Restore tested"
          value={status.backup.restoreTested ? "YES" : "NO"}
          detail={`Status: ${status.backup.restoreStatus}`}
        />
        <MetricCard
          label="Retention"
          value={`${status.backup.retentionDays} days`}
          detail="Local backup retention policy"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">
            Recovery objectives
          </h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="RPO" value={status.recovery.rpoLabel} />
            <Row label="RTO" value={status.recovery.rtoLabel} />
            <Row
              label="Last restore test"
              value={
                status.backup.lastRestoreTestAt
                  ? new Date(
                      status.backup.lastRestoreTestAt
                    ).toLocaleString()
                  : "Not recorded"
              }
            />
          </dl>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Environment</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="API" value={status.environment.api} />
            <Row
              label="Database"
              value={status.environment.database}
            />
            <Row
              label="Storage"
              value={status.environment.storage}
            />
            <Row
              label="Worker / Redis"
              value={status.environment.worker}
            />
          </dl>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Backup history</h3>
        {status.recentRuns.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No backup runs recorded yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {status.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {run.status} · {run.storageProvider}
                  </p>
                  <p className="text-gray-500">
                    {run.triggeredBy ?? "System"} ·{" "}
                    {run.sizeLabel ?? "—"} · Restore verified:{" "}
                    {run.restoreVerified ? "YES" : "NO"}
                  </p>
                </div>
                <p className="text-gray-500">
                  {new Date(run.startedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function mapStatus(
  status: BackupCenterStatus["status"]
): "healthy" | "warning" | "critical" {
  if (status === "healthy") return "healthy";
  if (status === "warning") return "warning";
  return "critical";
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

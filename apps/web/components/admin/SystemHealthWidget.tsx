"use client";

import type { SystemComponentStatus } from "../../lib/admin";

const STATUS_STYLES: Record<
  SystemComponentStatus,
  { dot: string; badge: string; label: string }
> = {
  healthy: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    label: "Healthy",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    label: "Warning",
  },
  critical: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-800 ring-red-200",
    label: "Critical",
  },
};

type Props = {
  label: string;
  status: SystemComponentStatus;
  detail: string;
};

export default function SystemHealthWidget({
  label,
  status,
  detail,
}: Props) {
  const styles = STATUS_STYLES[status];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {label}
          </p>
          <span
            className={`mt-2 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles.badge}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${styles.dot}`}
            />
            {styles.label}
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

export function OverallStatusBanner({
  status,
  uptime,
  version,
}: {
  status: SystemComponentStatus;
  uptime: number;
  version: string;
}) {
  const styles = STATUS_STYLES[status];

  return (
    <div
      className={`rounded-2xl border p-6 ring-1 ring-inset ${styles.badge}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium opacity-80">
            Overall system status
          </p>
          <p className="mt-1 text-2xl font-bold">
            {styles.label}
          </p>
        </div>
        <div className="text-right text-sm opacity-80">
          <p>Uptime: {Math.floor(uptime / 60)}m {uptime % 60}s</p>
          <p>Version: {version}</p>
        </div>
      </div>
    </div>
  );
}

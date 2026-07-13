"use client";

import type { SystemComponentStatus } from "../../lib/admin";

const STATUS_LABELS: Record<SystemComponentStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
};

const STATUS_BADGE: Record<SystemComponentStatus, string> = {
  healthy: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  critical: "bg-red-50 text-red-800",
};

type Props = {
  errors: {
    id: string;
    requestId: string | null;
    route: string;
    method: string;
    error: string;
    stack: string | null;
    createdAt: string;
  }[];
};

export default function ErrorCenterPanel({ errors }: Props) {
  if (errors.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
        No errors recorded yet. When API exceptions occur, they
        appear here with request ID correlation.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errors.map((row) => (
        <details
          key={row.id}
          className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-red-700">
                  {row.error}
                </p>
                <p className="mt-1 font-mono text-xs text-gray-500">
                  {row.method} {row.route}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>
                  {new Date(row.createdAt).toLocaleString()}
                </p>
                {row.requestId && (
                  <p className="mt-1 font-mono">
                    {row.requestId}
                  </p>
                )}
              </div>
            </div>
          </summary>

          {row.stack && (
            <pre className="mt-4 overflow-x-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">
              {row.stack}
            </pre>
          )}
        </details>
      ))}
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: SystemComponentStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

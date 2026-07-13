"use client";

import type { QueueDashboardRow } from "../../lib/admin";
import { StatusPill } from "./ErrorCenterPanel";

type Props = {
  queues: QueueDashboardRow[];
  updatedAt: string;
};

export default function QueueDashboardPanel({
  queues,
  updatedAt,
}: Props) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Last updated {new Date(updatedAt).toLocaleString()}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {queues.map((queue) => (
          <div
            key={queue.id}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">
                  {queue.label}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
                  {queue.type}
                </p>
              </div>
              <StatusPill status={queue.status} />
            </div>

            {queue.detail && (
              <p className="mt-3 text-sm text-gray-500">
                {queue.detail}
              </p>
            )}

            <div className="mt-4 grid grid-cols-4 gap-3">
              {(
                [
                  ["Pending", queue.metrics.pending],
                  ["Running", queue.metrics.running],
                  ["Failed", queue.metrics.failed],
                  ["Completed", queue.metrics.completed],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-gray-50 px-3 py-2 text-center"
                >
                  <p className="text-xs text-gray-500">
                    {label}
                  </p>
                  <p className="text-lg font-semibold">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

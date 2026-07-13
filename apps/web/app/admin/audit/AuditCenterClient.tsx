"use client";

/**
 * Audit Center client (Sprint 24): filterable table with cursor pagination and
 * CSV export. Filters are applied server-side via /audit/logs.
 */
import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "../../../lib/format";

type AuditLog = {
  id: number;
  createdAt: string;
  actor: string;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: number;
  permission: string | null;
  ipAddress: string | null;
  reason: string | null;
};

type Filters = {
  q: string;
  entityType: string;
  action: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  entityType: "",
  action: "",
  from: "",
  to: "",
};

function actionTone(action: string): string {
  const a = action.toUpperCase();
  if (a.includes("REJECT") || a.includes("REVOK") || a.includes("DELETE"))
    return "bg-red-100 text-red-700";
  if (a.includes("APPROVE") || a.includes("GRANT") || a.includes("CREATE"))
    return "bg-emerald-100 text-emerald-700";
  if (a.includes("UPDATE") || a.includes("CHANGE"))
    return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

export default function AuditCenterClient({
  entityTypes,
  actions,
}: {
  entityTypes: string[];
  actions: string[];
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const buildQuery = useCallback(
    (f: Filters, cur?: number | null) => {
      const params = new URLSearchParams();
      if (f.q) params.set("q", f.q);
      if (f.entityType) params.set("entityType", f.entityType);
      if (f.action) params.set("action", f.action);
      if (f.from) params.set("from", f.from);
      if (f.to) params.set("to", f.to);
      if (cur) params.set("cursor", String(cur));
      return params.toString();
    },
    []
  );

  const load = useCallback(
    async (f: Filters, cur: number | null, append: boolean) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/proxy/audit/logs?${buildQuery(f, cur)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data.success) {
          setLogs((prev) =>
            append ? [...prev, ...data.items] : data.items
          );
          setCursor(data.nextCursor);
          setHasMore(data.hasMore);
        }
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    load(EMPTY_FILTERS, null, false);
  }, [load]);

  function applyFilters() {
    setApplied(filters);
    load(filters, null, false);
  }

  function reset() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    load(EMPTY_FILTERS, null, false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Audit Center</h2>
          <p className="mt-1 text-gray-500">
            Forensic record of every protected action. Search, filter, and
            export for compliance.
          </p>
        </div>
        <a
          href={`/api/proxy/audit/export?${buildQuery(applied)}`}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Export CSV
        </a>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <input
          value={filters.q}
          onChange={(e) =>
            setFilters((f) => ({ ...f, q: e.target.value }))
          }
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          placeholder="Search actor / action / reason"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm lg:col-span-2"
        />
        <select
          value={filters.entityType}
          onChange={(e) =>
            setFilters((f) => ({ ...f, entityType: e.target.value }))
          }
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">All entities</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={(e) =>
            setFilters((f) => ({ ...f, action: e.target.value }))
          }
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) =>
            setFilters((f) => ({ ...f, from: e.target.value }))
          }
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) =>
            setFilters((f) => ({ ...f, to: e.target.value }))
          }
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <div className="flex gap-2 lg:col-span-6">
          <button
            onClick={applyFilters}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Apply filters
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Permission</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  No audit events match these filters.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">
                    {log.actor}
                  </div>
                  {log.actorRole && (
                    <div className="text-xs text-gray-400">
                      {log.actorRole}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionTone(
                      log.action
                    )}`}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {log.entityType} #{log.entityId}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {log.permission ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {log.ipAddress ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-center">
        {hasMore && (
          <button
            disabled={loading}
            onClick={() => load(applied, cursor, true)}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}

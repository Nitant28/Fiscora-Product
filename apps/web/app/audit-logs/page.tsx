/**
 * Audit Explorer
 * Purpose: Forensic, filterable audit trail — who did what, when, from where, old vs new value.
 * Data: GET /audit-logs (filtered + paginated), GET /audit-logs/filters; CSV via /api/proxy/audit-logs/export.
 * Roles: audit.view
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import { apiFetch, getCurrentUser } from "../../lib/api";
import { hasPermission, PERMISSION_KEYS } from "../../lib/permissions";

type AuditLog = {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  actor: string;
  actorUserId: number | null;
  actorRole: string | null;
  permission: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  reason: string | null;
  requestId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
};

type AuditResponse = {
  logs: AuditLog[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

type SearchParams = {
  entityType?: string;
  action?: string;
  actor?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
};

const PAGE_SIZE = 50;

function buildQuery(
  params: SearchParams,
  overrides: Record<string, string | number> = {}
): string {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v) merged[k] = String(v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    merged[k] = String(v);
  }
  const qs = new URLSearchParams(merged).toString();
  return qs ? `?${qs}` : "";
}

async function getLogs(
  params: SearchParams
): Promise<AuditResponse> {
  const query = buildQuery(params, {
    pageSize: PAGE_SIZE,
    page: params.page ?? 1,
  });
  const res = await apiFetch(`/audit-logs${query}`);
  if (!res.ok) return { logs: [] };
  return res.json();
}

async function getFilterOptions(): Promise<{
  entityTypes: string[];
  actions: string[];
}> {
  const res = await apiFetch("/audit-logs/filters");
  if (!res.ok) return { entityTypes: [], actions: [] };
  const data = await res.json();
  return {
    entityTypes: data.entityTypes ?? [],
    actions: data.actions ?? [],
  };
}

function entityLink(
  type: string,
  id: number
): string | null {
  if (type === "PurchaseRequest") return `/requests/${id}`;
  if (type === "PurchaseOrder") return `/purchase-orders/${id}`;
  if (type === "Document") return `/invoices/${id}`;
  if (type === "Vendor") return `/vendors/${id}`;
  if (type === "Contract") return `/contracts/${id}`;
  return null;
}

function summarizeChange(log: AuditLog): string {
  if (log.reason) return log.reason;
  if (log.newValue)
    return JSON.stringify(log.newValue);
  if (log.oldValue)
    return JSON.stringify(log.oldValue);
  return "—";
}

export default async function AuditExplorerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (
    !user ||
    !hasPermission(user, PERMISSION_KEYS.AUDIT_VIEW)
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const [data, options] = await Promise.all([
    getLogs(params),
    getFilterOptions(),
  ]);

  const logs = data.logs ?? [];
  const total = data.total ?? logs.length;
  const page = data.page ?? 1;
  const totalPages = data.totalPages ?? 1;
  const exportHref = `/api/proxy/audit-logs/export${buildQuery(
    params
  )}`;

  return (
    <PageContainer>
      <PageHeader
        title="Audit Explorer"
        description="Forensic activity trail — who, when, where, and what changed"
        actions={
          <a href={exportHref}>
            <Button variant="outline">Export CSV</Button>
          </a>
        }
      />

      {/* --- FILTERS --- */}
      <form
        method="get"
        className="mb-6 grid gap-3 rounded-2xl border bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Search
          </label>
          <input
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="action, user, entity…"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Entity
          </label>
          <select
            name="entityType"
            defaultValue={params.entityType ?? ""}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {options.entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Actor
          </label>
          <input
            name="actor"
            defaultValue={params.actor ?? ""}
            placeholder="user name"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            From
          </label>
          <input
            type="date"
            name="dateFrom"
            defaultValue={params.dateFrom ?? ""}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            To
          </label>
          <input
            type="date"
            name="dateTo"
            defaultValue={params.dateTo ?? ""}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end gap-2 lg:col-span-6">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Apply Filters
          </button>
          <Link
            href="/audit-logs"
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Reset
          </Link>
          <span className="ml-auto self-center text-sm text-gray-500">
            {total} event{total === 1 ? "" : "s"}
          </span>
        </div>
      </form>

      {/* --- TABLE --- */}
      {logs.length === 0 ? (
        <p className="text-gray-400">
          No audit events match these filters
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const href = entityLink(
                  log.entityType,
                  log.entityId
                );
                return (
                  <tr
                    key={log.id}
                    className="border-b last:border-0 align-top"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {new Date(
                        log.createdAt
                      ).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {log.action}
                    </td>
                    <td className="px-4 py-3">
                      {href ? (
                        <Link
                          href={href}
                          className="text-blue-600 hover:underline"
                        >
                          {log.entityType} #
                          {log.entityId}
                        </Link>
                      ) : (
                        `${log.entityType} #${log.entityId}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.actor}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.actorRole ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {log.ipAddress ?? "—"}
                    </td>
                    <td className="max-w-md px-4 py-3 text-gray-500">
                      <span className="line-clamp-2 break-words">
                        {summarizeChange(log)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* --- PAGINATION --- */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/audit-logs${buildQuery(params, {
                  page: page - 1,
                })}`}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/audit-logs${buildQuery(params, {
                  page: page + 1,
                })}`}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

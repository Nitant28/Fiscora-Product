"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@repo/ui/status-badge";
import { EmptyState } from "@repo/ui/empty-state";
import { SkeletonTable } from "@repo/ui/skeleton";

type Department = { id: number; name: string };

type AccessRequest = {
  id: number;
  email: string;
  name: string;
  requestedDepartment: string | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedAt: string | null;
};

const ROLES = [
  "EMPLOYEE",
  "MANAGER",
  "PROCUREMENT",
  "FINANCE",
  "DIRECTOR",
  "CFO",
  "AUDITOR",
  "ADMIN",
] as const;

const TABS = ["PENDING", "APPROVED", "REJECTED"] as const;

export default function AccessRequestsClient({
  departments,
}: {
  departments: Department[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("PENDING");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [counts, setCounts] = useState({
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<AccessRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/access-requests?status=${tab}`
      );
      const data = await res.json();
      setRequests(data.requests ?? []);
      if (data.counts) setCounts(data.counts);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-muted-soft p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.toLowerCase()}
            <span className="ml-2 rounded-full bg-muted-soft px-2 py-0.5 text-xs">
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : requests.length === 0 ? (
        <EmptyState
          title={`No ${tab.toLowerCase()} requests`}
          description={
            tab === "PENDING"
              ? "When someone signs in without a provisioned account, their request appears here."
              : `No requests have been ${tab.toLowerCase()} yet.`
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Requested</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-foreground">
                      {r.name}
                    </p>
                    {r.requestedDepartment && (
                      <p className="text-xs text-muted">
                        Dept: {r.requestedDepartment}
                      </p>
                    )}
                    {r.reason && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-muted">
                        {r.reason}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-muted">{r.email}</td>
                  <td className="px-5 py-4 text-muted">
                    {new Date(r.requestedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    {r.status === "PENDING" ? (
                      <button
                        onClick={() => setReviewing(r)}
                        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-fg hover:bg-primary-hover"
                      >
                        Review
                      </button>
                    ) : (
                      <span className="text-xs text-muted">
                        {r.reviewedAt
                          ? new Date(r.reviewedAt).toLocaleDateString()
                          : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && (
        <ReviewModal
          request={reviewing}
          departments={departments}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ReviewModal({
  request,
  departments,
  onClose,
  onDone,
}: {
  request: AccessRequest;
  departments: Department[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [role, setRole] = useState<string>("EMPLOYEE");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [approvalLimit, setApprovalLimit] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const body =
        action === "approve"
          ? {
              role,
              departmentId: departmentId
                ? Number(departmentId)
                : null,
              approvalLimit: approvalLimit
                ? Number(approvalLimit)
                : null,
            }
          : {};

      const res = await fetch(
        `/api/proxy/access-requests/${request.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return;
      }
      onDone();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">
          Review access request
        </h2>
        <div className="mt-3 rounded-lg border border-border bg-muted-soft px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {request.name}
          </p>
          <p className="text-xs text-muted">{request.email}</p>
          {request.reason && (
            <p className="mt-2 text-xs text-muted">
              &ldquo;{request.reason}&rdquo;
            </p>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Department (optional)
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Approval limit (optional)
            </label>
            <input
              type="number"
              value={approvalLimit}
              onChange={(e) => setApprovalLimit(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-xs text-danger-fg">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            onClick={() => act("reject")}
            disabled={busy}
            className="rounded-lg border border-danger-soft px-4 py-2 text-sm font-medium text-danger-fg hover:bg-danger-soft disabled:opacity-50"
          >
            Reject
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted-soft"
            >
              Cancel
            </button>
            <button
              onClick={() => act("approve")}
              disabled={busy}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? "Working…" : "Approve & create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

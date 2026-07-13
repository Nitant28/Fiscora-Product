/**
 * Identity Dashboard (Sprint 18A hardening).
 * Operational view: user lifecycle, login failures, invitation acceptance,
 * recent login history, and identity audit events.
 * Data: GET /admin/identity (apiFetch).
 * Roles: user.manage (admin).
 */
import { apiFetch } from "../../../lib/api";

type IdentityDashboard = {
  success: boolean;
  users: {
    total: number;
    active: number;
    invited: number;
    suspended: number;
    locked: number;
    deleted: number;
  };
  logins: {
    failedToday: number;
    successfulToday: number;
  };
  invitations: {
    sent: number;
    pending: number;
    accepted: number;
    expired: number;
    acceptanceRate: number;
  };
  recentLogins: {
    id: number;
    name: string;
    email: string;
    success: boolean;
    failureReason: string | null;
    ipAddress: string | null;
    createdAt: string;
  }[];
  recentEvents: {
    id: number;
    action: string;
    actor: string;
    reason: string | null;
    ipAddress: string | null;
    createdAt: string;
  }[];
};

async function getDashboard(): Promise<IdentityDashboard | null> {
  const res = await apiFetch("/admin/identity");
  if (!res.ok) return null;
  return res.json();
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "border-gray-200 bg-white text-gray-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}
    >
      <div className="text-sm font-medium opacity-70">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

export default async function IdentityDashboardPage() {
  const data = await getDashboard();

  if (!data?.success) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-gray-500 shadow-sm">
        Identity dashboard unavailable. This view requires the
        <span className="font-mono"> user.manage </span>
        permission.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Identity Dashboard</h2>
        <p className="mt-1 text-gray-500">
          Operational view of user lifecycle, login security, and
          invitation acceptance — the control plane for enterprise
          identity.
        </p>
      </div>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Users
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Total" value={data.users.total} />
          <MetricCard
            label="Active"
            value={data.users.active}
            tone="success"
          />
          <MetricCard
            label="Invited"
            value={data.users.invited}
            tone="warning"
          />
          <MetricCard
            label="Suspended"
            value={data.users.suspended}
            tone="danger"
          />
          <MetricCard
            label="Locked"
            value={data.users.locked}
            tone="danger"
          />
          <MetricCard
            label="Deleted"
            value={data.users.deleted}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Logins Today
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Successful"
            value={data.logins.successfulToday}
            tone="success"
          />
          <MetricCard
            label="Failed"
            value={data.logins.failedToday}
            tone={data.logins.failedToday > 0 ? "danger" : "default"}
          />
          <MetricCard
            label="Invitations Sent"
            value={data.invitations.sent}
          />
          <MetricCard
            label="Acceptance Rate"
            value={`${data.invitations.acceptanceRate}%`}
            tone={
              data.invitations.acceptanceRate >= 80
                ? "success"
                : "warning"
            }
          />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Invitations
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Pending"
            value={data.invitations.pending}
            tone="warning"
          />
          <MetricCard
            label="Accepted"
            value={data.invitations.accepted}
            tone="success"
          />
          <MetricCard
            label="Expired"
            value={data.invitations.expired}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3">
            <h3 className="font-semibold text-gray-800">
              Recent Logins
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Result</th>
                  <th className="px-4 py-2">IP</th>
                  <th className="px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLogins.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      No login history yet.
                    </td>
                  </tr>
                ) : (
                  data.recentLogins.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium">
                          {row.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {row.email}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.success ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Success
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            {row.failureReason ?? "Failed"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {row.ipAddress ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {formatTime(row.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3">
            <h3 className="font-semibold text-gray-800">
              Identity Audit Events
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Actor</th>
                  <th className="px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      No identity audit events yet.
                    </td>
                  </tr>
                ) : (
                  data.recentEvents.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs">
                          {row.action}
                        </span>
                        {row.reason && (
                          <div className="text-xs text-gray-400">
                            {row.reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">{row.actor}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {formatTime(row.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

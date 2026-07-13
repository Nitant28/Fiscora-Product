"use client";

/**
 * Enterprise User Directory (Sprint 18B).
 * Live search + filters, invite modal, and per-row lifecycle actions.
 * All mutations go through /api/proxy/users/* and re-fetch on success.
 */
import { useCallback, useEffect, useState } from "react";

type Dept = { id: number; name: string };

type DirectoryUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  employeeId: string | null;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  invitationStatus: "ACCEPTED" | "PENDING" | "NONE";
  department: { id: number; name: string } | null;
  manager: { id: number; name: string } | null;
};

const ROLES = [
  "EMPLOYEE",
  "MANAGER",
  "DIRECTOR",
  "PROCUREMENT",
  "FINANCE",
  "CFO",
  "AUDITOR",
  "ADMIN",
  "VENDOR",
];

const STATUSES = [
  "ACTIVE",
  "INVITED",
  "SUSPENDED",
  "LOCKED",
  "DELETED",
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    INVITED: "bg-amber-100 text-amber-700",
    SUSPENDED: "bg-red-100 text-red-700",
    LOCKED: "bg-orange-100 text-orange-700",
    DELETED: "bg-gray-200 text-gray-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

function inviteBadge(s: string) {
  const map: Record<string, string> = {
    ACCEPTED: "bg-emerald-50 text-emerald-600 border-emerald-200",
    PENDING: "bg-amber-50 text-amber-600 border-amber-200",
    NONE: "bg-gray-50 text-gray-400 border-gray-200",
  };
  return map[s] ?? map.NONE;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function UsersClient({
  departments,
  canManageRoles,
}: {
  departments: Dept[];
  canManageRoles: boolean;
}) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (deptFilter) params.set("departmentId", deptFilter);

    try {
      const res = await fetch(
        `/api/proxy/users?${params.toString()}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to load users");
      }
      setUsers(data.users);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load"
      );
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, deptFilter]);

  // Debounced reload on filter change.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function rowAction(
    id: number,
    method: "PATCH" | "POST",
    action: string,
    body?: Record<string, unknown>
  ) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/users/${id}/${action}`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Action failed");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Action failed"
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, employee ID…"
          className="w-72 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Invite Employee
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-600">
              <th className="px-4 py-3 font-semibold">Employee</th>
              <th className="px-4 py-3 font-semibold">Emp ID</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Invitation</th>
              <th className="px-4 py-3 font-semibold">Last Login</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  No users match these filters.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        {initials(u.name)}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {u.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.employeeId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.department?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(
                        u.status
                      )}`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${inviteBadge(
                        u.invitationStatus
                      )}`}
                    >
                      {u.invitationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      user={u}
                      busy={busyId === u.id}
                      departments={departments}
                      canManageRoles={canManageRoles}
                      onAction={rowAction}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <InviteModal
          departments={departments}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* --- ROW ACTIONS --- */
function RowActions({
  user,
  busy,
  departments,
  canManageRoles,
  onAction,
}: {
  user: DirectoryUser;
  busy: boolean;
  departments: Dept[];
  canManageRoles: boolean;
  onAction: (
    id: number,
    method: "PATCH" | "POST",
    action: string,
    body?: Record<string, unknown>
  ) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        {busy ? "…" : "Manage ▾"}
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-56 rounded-xl border bg-white p-1 text-sm shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {user.status === "ACTIVE" ? (
            <MenuItem
              label="Suspend"
              tone="danger"
              onClick={() => {
                setOpen(false);
                onAction(user.id, "PATCH", "status", {
                  status: "SUSPENDED",
                });
              }}
            />
          ) : (
            <MenuItem
              label="Reactivate"
              tone="success"
              onClick={() => {
                setOpen(false);
                onAction(user.id, "PATCH", "status", {
                  status: "ACTIVE",
                });
              }}
            />
          )}

          {canManageRoles && (
            <div className="px-2 py-1.5">
              <label className="mb-1 block text-xs text-gray-400">
                Change role
              </label>
              <select
                defaultValue={user.role}
                onChange={(e) => {
                  setOpen(false);
                  onAction(user.id, "PATCH", "role", {
                    role: e.target.value,
                  });
                }}
                className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="px-2 py-1.5">
            <label className="mb-1 block text-xs text-gray-400">
              Change department
            </label>
            <select
              defaultValue={user.department?.id ?? ""}
              onChange={(e) => {
                setOpen(false);
                onAction(user.id, "PATCH", "department", {
                  departmentId: e.target.value
                    ? Number(e.target.value)
                    : null,
                });
              }}
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {user.invitationStatus === "PENDING" && (
            <>
              <MenuItem
                label="Resend invitation"
                onClick={() => {
                  setOpen(false);
                  onAction(user.id, "POST", "resend");
                }}
              />
              <MenuItem
                label="Cancel invitation"
                tone="danger"
                onClick={() => {
                  setOpen(false);
                  onAction(
                    user.id,
                    "POST",
                    "cancel-invitation"
                  );
                }}
              />
            </>
          )}

          <MenuItem
            label="Force logout"
            onClick={() => {
              setOpen(false);
              onAction(user.id, "POST", "force-logout");
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger" | "success";
}) {
  const tones = {
    default: "text-gray-700 hover:bg-gray-100",
    danger: "text-red-600 hover:bg-red-50",
    success: "text-emerald-600 hover:bg-emerald-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm ${tones[tone]}`}
    >
      {label}
    </button>
  );
}

/* --- INVITE MODAL --- */
function InviteModal({
  departments,
  onClose,
  onInvited,
}: {
  departments: Dept[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "EMPLOYEE",
    departmentId: "",
    employeeId: "",
    approvalLimit: "",
    costCenter: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/proxy/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          role: form.role,
          departmentId: form.departmentId || null,
          employeeId: form.employeeId || null,
          approvalLimit: form.approvalLimit || null,
          costCenter: form.costCenter || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Invite failed");
      }
      if (data.clerkDelivered === false) {
        // User row created; Clerk email not sent (offline/unconfigured).
        setNotice(
          "User created, but the Clerk invitation email could not be sent. You can resend later."
        );
        setTimeout(onInvited, 1800);
      } else {
        onInvited();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invite failed"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Invite Employee</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Last name">
            <input
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Email" full>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className="input"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select
              value={form.departmentId}
              onChange={(e) =>
                set("departmentId", e.target.value)
              }
              className="input"
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Employee ID">
            <input
              value={form.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Approval limit (₹)">
            <input
              type="number"
              min="0"
              value={form.approvalLimit}
              onChange={(e) =>
                set("approvalLimit", e.target.value)
              }
              className="input"
            />
          </Field>
          <Field label="Cost center" full>
            <input
              value={form.costCenter}
              onChange={(e) => set("costCenter", e.target.value)}
              className="input"
            />
          </Field>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {notice}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              submitting ||
              !form.firstName ||
              !form.lastName ||
              !form.email
            }
            onClick={submit}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Inviting…" : "Send Invitation"}
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #d1d5db;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: #818cf8;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}

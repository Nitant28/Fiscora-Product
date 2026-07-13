"use client";

/**
 * Editable Role × Permission matrix (Sprint 21 — Dynamic RBAC).
 * Toggling a cell PATCHes the backend, which audits the change and refreshes
 * the RBAC cache immediately. ADMIN is protected (always full access).
 */
import { Fragment, useMemo, useState } from "react";

type MatrixPermission = {
  key: string;
  description: string;
  grantedTo: string[];
};

const PROTECTED_ROLES = new Set(["ADMIN"]);

function groupKey(key: string): string {
  const [domain] = key.split(".");
  return domain ?? key;
}

export default function PermissionMatrixClient({
  roles,
  permissions: initialPermissions,
  totalPermissions,
  source,
}: {
  roles: string[];
  permissions: MatrixPermission[];
  totalPermissions: number;
  source: string;
}) {
  const [permissions, setPermissions] =
    useState<MatrixPermission[]>(initialPermissions);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, MatrixPermission[]>();
    for (const p of permissions) {
      const g = groupKey(p.key);
      const list = map.get(g) ?? [];
      list.push(p);
      map.set(g, list);
    }
    return [...map.entries()];
  }, [permissions]);

  async function toggle(
    permissionKey: string,
    role: string,
    currentlyGranted: boolean
  ) {
    if (PROTECTED_ROLES.has(role)) return;
    const cellId = `${role}:${permissionKey}`;
    setSaving(cellId);
    setError(null);

    // Optimistic update
    setPermissions((prev) =>
      prev.map((p) =>
        p.key === permissionKey
          ? {
              ...p,
              grantedTo: currentlyGranted
                ? p.grantedTo.filter((r) => r !== role)
                : [...p.grantedTo, role],
            }
          : p
      )
    );

    try {
      const res = await fetch("/api/proxy/admin/rbac/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          permissionKey,
          enabled: !currentlyGranted,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Toggle failed");
      }
    } catch (e) {
      // Revert on failure
      setPermissions((prev) =>
        prev.map((p) =>
          p.key === permissionKey
            ? {
                ...p,
                grantedTo: currentlyGranted
                  ? [...p.grantedTo, role]
                  : p.grantedTo.filter((r) => r !== role),
              }
            : p
        )
      );
      setError(
        e instanceof Error ? e.message : "Could not save change"
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Permission Matrix</h2>
          <p className="mt-1 text-gray-500">
            Click any cell to grant or revoke. Changes are audited and applied
            instantly — no deployment. ADMIN is protected.
          </p>
        </div>
        <div className="rounded-xl border bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
          {totalPermissions} permissions · {roles.length} roles · source:{" "}
          <span className="font-medium">{source}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
                Permission
              </th>
              {roles.map((role) => (
                <th
                  key={role}
                  className="px-3 py-3 text-center font-semibold text-gray-700"
                >
                  {role}
                  {PROTECTED_ROLES.has(role) && (
                    <span className="ml-1 text-xs text-gray-400">🔒</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, perms]) => (
              <Fragment key={`group-${group}`}>
                <tr className="border-b bg-gray-50/60">
                  <td
                    colSpan={roles.length + 1}
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {group}
                  </td>
                </tr>
                {perms.map((p) => (
                  <tr key={p.key} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                      <div className="font-mono text-xs text-gray-800">
                        {p.key}
                      </div>
                      <div className="text-xs text-gray-400">
                        {p.description}
                      </div>
                    </td>
                    {roles.map((role) => {
                      const granted = p.grantedTo.includes(role);
                      const locked = PROTECTED_ROLES.has(role);
                      const cellId = `${role}:${p.key}`;
                      return (
                        <td
                          key={role}
                          className="px-3 py-2.5 text-center"
                        >
                          <button
                            disabled={locked || saving === cellId}
                            onClick={() =>
                              toggle(p.key, role, granted)
                            }
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                              granted
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-gray-100 text-gray-300 hover:bg-gray-200"
                            } ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${
                              saving === cellId ? "animate-pulse" : ""
                            }`}
                            title={
                              locked
                                ? "ADMIN is protected"
                                : granted
                                  ? "Click to revoke"
                                  : "Click to grant"
                            }
                          >
                            {granted ? "✓" : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

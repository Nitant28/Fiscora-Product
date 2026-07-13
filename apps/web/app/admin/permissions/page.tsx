/**
 * Permission Matrix
 * Purpose: Transparent Role × Permission grid — proof that authorization is data-driven (Permission → Role → User), not hardcoded.
 * Data: GET /admin/rbac/matrix (apiFetch).
 * Roles: role.manage (admin).
 */
import { apiFetch } from "../../../lib/api";
import PermissionMatrixClient from "./PermissionMatrixClient";

type MatrixPermission = {
  key: string;
  description: string;
  grantedTo: string[];
};

type MatrixResponse = {
  success: boolean;
  roles: string[];
  permissions: MatrixPermission[];
  totalPermissions: number;
  source: string;
};

async function getMatrix(): Promise<MatrixResponse | null> {
  const res = await apiFetch("/admin/rbac/matrix");
  if (!res.ok) return null;
  return res.json();
}

export default async function PermissionMatrixPage() {
  const data = await getMatrix();

  if (!data || !data.success) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-gray-500 shadow-sm">
        Permission matrix unavailable. This view requires the
        <span className="font-mono"> role.manage </span>
        permission.
      </div>
    );
  }

  return (
    <PermissionMatrixClient
      roles={data.roles}
      permissions={data.permissions}
      totalPermissions={data.totalPermissions}
      source={data.source}
    />
  );
}

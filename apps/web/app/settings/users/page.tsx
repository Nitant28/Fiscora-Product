/**
 * Enterprise User Management — directory (Sprint 18B).
 * Route: /settings/users
 * Data: GET /users, GET /departments (apiFetch).
 * Roles: user.manage (admin). Role changes additionally require role.manage.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/api";
import { apiFetch } from "../../../lib/api";
import {
  hasPermission,
  PERMISSION_KEYS,
} from "../../../lib/permissions";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import UsersClient from "./UsersClient";

async function getDepartments() {
  const res = await apiFetch("/departments");
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data)
    ? data
    : data.departments ?? data.data ?? [];
  return list.map((d: { id: number; name: string }) => ({
    id: d.id,
    name: d.name,
  }));
}

export default async function UserManagementPage() {
  const user = await getCurrentUser();

  if (
    !user ||
    !hasPermission(user, PERMISSION_KEYS.USER_MANAGE)
  ) {
    redirect("/dashboard");
  }

  const departments = await getDepartments();
  const canManageRoles = hasPermission(
    user,
    PERMISSION_KEYS.ROLE_MANAGE
  );

  return (
    <PageContainer rhythm>
      <PageHeader
        title="User Management"
        description="Onboard employees, manage roles and departments, and control account lifecycle. People are created in Fiscora; Clerk handles sign-in."
      />

      <UsersClient
        departments={departments}
        canManageRoles={canManageRoles}
      />
    </PageContainer>
  );
}

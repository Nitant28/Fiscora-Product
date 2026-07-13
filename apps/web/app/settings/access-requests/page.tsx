/**
 * Access Requests — admin review queue (Sprint 18C).
 * Route: /settings/access-requests
 * Data: GET /access-requests, GET /departments (apiFetch).
 * Roles: user.manage (admin).
 */
import { redirect } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { apiFetch, getCurrentUser } from "../../../lib/api";
import {
  hasPermission,
  PERMISSION_KEYS,
} from "../../../lib/permissions";
import AccessRequestsClient from "./AccessRequestsClient";

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

export default async function AccessRequestsPage() {
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, PERMISSION_KEYS.USER_MANAGE)) {
    redirect("/dashboard");
  }

  const departments = await getDepartments();

  return (
    <PageContainer>
      <PageHeader
        title="Access Requests"
        description="Review people who signed in but aren't provisioned yet. Approve to create their account with a role and department, or reject the request."
      />

      <AccessRequestsClient departments={departments} />
    </PageContainer>
  );
}

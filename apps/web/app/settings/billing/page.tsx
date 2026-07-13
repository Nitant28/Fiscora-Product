/**
 * Billing — subscription, plans, and usage (Sprint 19).
 * Route: /settings/billing
 * Roles: billing.view (read), billing.manage (change plan).
 */
import { redirect } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { apiFetch, getCurrentUser } from "../../../lib/api";
import {
  hasPermission,
  PERMISSION_KEYS,
} from "../../../lib/permissions";
import BillingClient from "./BillingClient";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, PERMISSION_KEYS.BILLING_VIEW)) {
    redirect("/dashboard");
  }

  const [subRes, plansRes, invRes] = await Promise.all([
    apiFetch("/billing/subscription"),
    apiFetch("/billing/plans"),
    hasPermission(user, PERMISSION_KEYS.BILLING_MANAGE)
      ? apiFetch("/billing/invoices")
      : Promise.resolve(null),
  ]);

  const subData = subRes.ok ? await subRes.json() : null;
  const plansData = plansRes.ok ? await plansRes.json() : null;
  const invData =
    invRes && invRes.ok ? await invRes.json() : { invoices: [] };

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Billing"
        description="Subscription, plan limits, and usage."
      />

      <BillingClient
        subscription={subData?.subscription ?? null}
        plans={plansData?.plans ?? []}
        invoices={invData.invoices ?? []}
        canManage={hasPermission(user, PERMISSION_KEYS.BILLING_MANAGE)}
      />
    </PageContainer>
  );
}

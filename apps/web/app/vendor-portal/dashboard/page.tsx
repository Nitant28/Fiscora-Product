import { redirect } from "next/navigation";
import AuditMetricCard from "../../../components/audit/AuditMetricCard";
import { getVendorPortalUser, vendorApiFetch } from "../../../lib/vendorApi";

async function getDashboard() {
  const res = await vendorApiFetch("/vendor/dashboard");
  if (!res.ok) return null;
  const data = await res.json();
  return data.dashboard ?? null;
}

export default async function VendorPortalDashboardPage() {
  const user = await getVendorPortalUser();

  if (!user) {
    redirect("/vendor-portal/login");
  }

  const dashboard = await getDashboard();

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h2 className="text-3xl font-bold">
        Welcome, {user.name}
      </h2>
      <p className="mt-2 text-gray-500">
        KYC status: {user.kycStatus} · Account: {user.status}
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AuditMetricCard
          label="Open RFQs"
          value={dashboard?.rfqs ?? 0}
          variant="indigo"
        />
        <AuditMetricCard
          label="Purchase Orders"
          value={dashboard?.purchaseOrders ?? 0}
        />
        <AuditMetricCard
          label="Invoices"
          value={dashboard?.invoices ?? 0}
        />
        <AuditMetricCard
          label="Payments"
          value={dashboard?.payments ?? 0}
        />
      </section>
    </div>
  );
}

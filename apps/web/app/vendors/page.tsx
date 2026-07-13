/**
 * Vendors Directory
 * Purpose: Approved vendor list with spend and risk summary links.
 * Data: GET /vendors (apiFetch).
 * Roles: vendor.view.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { EmptyState } from "@repo/ui/empty-state";
import { apiFetch } from "../../lib/api";
import { formatMoney } from "../../lib/metrics";

async function getVendors() {
  const res = await apiFetch("/vendors");
  if (!res.ok) return [];
  const data = await res.json();
  return data.vendors ?? [];
}

export default async function VendorsPage() {
  const vendors = await getVendors();

  return (
    <PageContainer rhythm>
      <PageHeader
        title="Vendor Directory"
        description="Vendor 360 overview"
      />

      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="Approved vendors will appear here with spend and risk signals."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vendors.map(
            (v: {
              id: number;
              name: string;
              totalSpend: number;
              preferredVendor: boolean;
              riskLevel: string;
              procurementScore: number | null;
            }) => (
              <Link
                key={v.id}
                href={`/vendors/${v.id}`}
                className="rounded-xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-md font-semibold text-foreground">
                    {v.name}
                  </h2>
                  {v.preferredVendor && (
                    <span className="shrink-0 rounded-full bg-success-soft-2 px-2 py-0.5 text-xs font-medium text-success-fg">
                      Preferred
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-foreground-subtle">
                  {v.preferredVendor ? "Preferred Vendor" : "Standard Vendor"}
                </p>
                <p className="mt-4 text-xl font-bold financial-figure text-foreground">
                  {formatMoney(v.totalSpend)}
                </p>
                <p className="mt-0.5 text-xs text-muted">Total spend</p>
                {v.procurementScore != null && (
                  <p className="mt-3 text-sm text-foreground-subtle">
                    Procurement Score: {v.procurementScore}/100
                  </p>
                )}
                <p className="mt-1 text-xs text-muted">Risk: {v.riskLevel}</p>
              </Link>
            )
          )}
        </div>
      )}
    </PageContainer>
  );
}

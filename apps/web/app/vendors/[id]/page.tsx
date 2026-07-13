/**
 * Vendor Detail
 * Purpose: Vendor profile, payment terms, spend history, and intelligence signals.
 * Data: GET /vendors/:id (apiFetch).
 * Roles: vendor.view; vendor.manage for terms updates.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";
import { formatMoney, formatINRCompact } from "../../../lib/metrics";
import VendorPaymentTermsForm from "../../../components/VendorPaymentTermsForm";
import { formatPaymentTermsLabel } from "../../../lib/paymentTerms";
import { apiFetch } from "../../../lib/api";

async function getVendor(id: string) {
  const res = await apiFetch(`/vendors/${id}`);
  if (!res.ok) {
    throw new Error("Vendor not found");
  }
  return res.json();
}

export default async function Vendor360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getVendor(id);
  const v = data.vendor;

  const scores = [
    {
      label: "Reliability",
      value: v.reliabilityScore,
    },
    {
      label: "Delivery",
      value: v.deliveryScore,
    },
    {
      label: "Price Competitiveness",
      value: v.priceCompetitivenessScore,
    },
    {
      label: "Invoice Accuracy",
      value: v.invoiceAccuracyScore,
    },
    {
      label: "Response Time",
      value: v.responseTimeScore,
    },
  ];

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={v.name}
        description="Vendor 360"
        backHref="/vendors"
        badge={
          v.preferredVendor ? (
            <span className="rounded-full bg-success-soft-2 px-2.5 py-0.5 text-xs font-medium text-success-fg">
              Preferred Vendor
            </span>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat
          label="Total Spend"
          value={formatMoney(v.totalSpend)}
        />
        <Stat
          label="Health Score"
          value={`${v.healthScore}/100`}
        />
        <Stat
          label="Procurement Score"
          value={
            v.procurementScore != null
              ? `${v.procurementScore}/100`
              : "—"
          }
        />
        <Stat
          label="Avg Invoice"
          value={formatMoney(v.averagePrice)}
        />
        <Stat
          label="Approval Rate"
          value={`${v.approvalRate}%`}
        />
      </div>

      {v.contractSummary ? (
        <div className="mt-8 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-indigo-950">
                Contract Governance
              </h2>
              <p className="text-sm text-indigo-800">
                {v.contractSummary.title}
              </p>
            </div>
            <Link
              href={`/contracts/${v.contractSummary.id}`}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              View contract →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat
              label="Contract Value"
              value={formatINRCompact(
                v.contractSummary.value
              )}
            />
            <Stat
              label="Expires"
              value={new Date(
                v.contractSummary.endDate
              ).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
            <Stat
              label="Days Remaining"
              value={
                v.contractSummary.daysRemaining <= 0
                  ? "Expired"
                  : String(
                      v.contractSummary.daysRemaining
                    )
              }
            />
            <div>
              <p className="text-sm text-indigo-800/70">
                Status
              </p>
              <div className="mt-1">
                <StatusBadge
                  status={v.contractSummary.status}
                />
              </div>
            </div>
            <Stat
              label="Auto Renew"
              value={
                v.contractSummary.autoRenew
                  ? "Yes"
                  : "No"
              }
            />
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed bg-gray-50 p-6 text-sm text-gray-500">
          No active contract on file for this vendor.
        </div>
      )}

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          Vendor Health
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {scores.map((s) => (
            <div key={s.label}>
              <p className="text-sm text-gray-500">
                {s.label}
              </p>
              <p className="text-xl font-semibold">
                {s.value}/100
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm text-gray-500">
            Contact
          </p>
          <p className="font-medium">
            {v.contactPerson ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">
            Payment Terms
          </p>
          <p className="font-medium">
            {v.paymentTermsDays != null
              ? formatPaymentTermsLabel(
                  v.paymentTermsDays
                )
              : (v.paymentTerms ?? "—")}
          </p>
          {v.msmeRegistered && (
            <p className="mt-1 text-xs text-amber-700">
              MSME · 45-day cap applies
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">
            Contract Expiry
          </p>
          <p className="font-medium">
            {v.contractExpiry
              ? new Date(
                  v.contractExpiry
                ).toLocaleDateString()
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">
            On-Time Delivery
          </p>
          <p className="font-medium">
            {v.onTimeDeliveryRate != null
              ? `${Math.round(v.onTimeDeliveryRate)}%`
              : "—"}
          </p>
        </div>
      </div>

      <VendorPaymentTermsForm
        vendorId={v.id}
        currentTermsDays={
          v.paymentTermsDays
        }
        msmeRegistered={
          v.msmeRegistered ?? false
        }
      />
    </PageContainer>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

/**
 * Contract Detail
 * Purpose: Contract terms, utilization, linked POs, and renewal metadata.
 * Data: GET /contracts/:id (apiFetch).
 * Roles: contract.view; contract.manage for edits.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";
import { formatINR } from "../../../lib/metrics";
import { apiFetch } from "../../../lib/api";

type ContractDetail = {
  id: number;
  contractNumber: string;
  title: string;
  vendor: { id: number; name: string };
  value: number;
  utilized: number;
  remaining: number;
  utilizationPercent: number;
  startDate: string;
  endDate: string;
  renewalDate: string | null;
  autoRenew: boolean;
  documentUrl: string | null;
  status: string;
  daysRemaining: number;
  renewalStatus: string;
  purchaseOrders: {
    id: number;
    poNumber: string;
    vendorName: string;
    amount: number;
    status: string;
    createdAt: string;
  }[];
};

async function getContract(
  id: string
): Promise<ContractDetail | null> {
  const res = await apiFetch(
    `/contracts/${id}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.contract ?? null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await getContract(id);

  if (!contract) {
    return (
      <PageContainer>
        <PageHeader title="Contract not found" backHref="/contracts" />
      </PageContainer>
    );
  }

  const daysRemaining =
    contract.daysRemaining ??
    Math.max(
      0,
      Math.ceil(
        (new Date(contract.endDate).getTime() -
          Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    );
  const utilizationPercent =
    contract.utilizationPercent ?? 0;
  const renewalStatus =
    contract.renewalStatus ?? "On Track";

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={contract.title}
        description={contract.contractNumber}
        backHref="/contracts"
        badge={<StatusBadge status={contract.status ?? "ACTIVE"} />}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <InfoCard
          label="Vendor"
          value={
            <Link
              href={`/vendors/${contract.vendor.id}`}
              className="text-blue-600 hover:underline"
            >
              {contract.vendor.name}
            </Link>
          }
        />
        <InfoCard
          label="Contract Value"
          value={formatINR(contract.value)}
        />
        <InfoCard
          label="Utilized"
          value={formatINR(contract.utilized)}
        />
        <InfoCard
          label="Remaining"
          value={formatINR(contract.remaining)}
        />
        <InfoCard
          label="Start Date"
          value={formatDate(
            contract.startDate
          )}
        />
        <InfoCard
          label="End Date"
          value={formatDate(contract.endDate)}
        />
        <InfoCard
          label="Days Remaining"
          value={
            daysRemaining <= 30 ? (
              <span className="text-red-700">
                {daysRemaining} days
              </span>
            ) : (
              `${daysRemaining} days`
            )
          }
        />
        <InfoCard
          label="Renewal Status"
          value={
            renewalStatus ===
            "Renewal Required" ? (
              <span className="text-red-700">
                {renewalStatus}
              </span>
            ) : (
              renewalStatus
            )
          }
        />
        <InfoCard
          label="Renewal Date"
          value={
            contract.renewalDate
              ? formatDate(
                  contract.renewalDate
                )
              : "Not set"
          }
        />
        <InfoCard
          label="Auto Renew"
          value={
            contract.autoRenew ? "Yes" : "No"
          }
        />
      </div>

      <div className="mb-10 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-3 flex justify-between text-sm">
          <span className="font-medium">
            Contract Utilization
          </span>
          <span className="text-gray-500">
            {utilizationPercent}%
            utilized
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${
              utilizationPercent >= 90
                ? "bg-red-500"
                : utilizationPercent >= 75
                  ? "bg-amber-500"
                  : "bg-indigo-500"
            }`}
            style={{
              width: `${Math.min(
                utilizationPercent,
                100
              )}%`,
            }}
          />
        </div>
      </div>

      {contract.purchaseOrders.length > 0 && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Linked Purchase Orders
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 pr-4">
                    PO Number
                  </th>
                  <th className="pb-3 pr-4">
                    Vendor
                  </th>
                  <th className="pb-3 pr-4">
                    Amount
                  </th>
                  <th className="pb-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {contract.purchaseOrders.map(
                  (po) => (
                    <tr
                      key={po.id}
                      className="border-b"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {po.poNumber}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        {po.vendorName}
                      </td>
                      <td className="py-3 pr-4">
                        {formatINR(po.amount)}
                      </td>
                      <td className="py-3">
                        <StatusBadge
                          status={po.status}
                        />
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-2 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

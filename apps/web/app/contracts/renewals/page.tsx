/**
 * Contract Renewal Queue
 * Purpose: Executive renewal workflow — expiring contracts with risk and actions.
 * Data: GET /contracts/renewals (apiFetch).
 * Roles: contract.view; contract.manage for actions.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import { StatusBadge } from "@repo/ui/status-badge";
import { EmptyState } from "@repo/ui/empty-state";
import {
  DataTable,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@repo/ui/data-table";
import ContractRenewalActions from "../../../components/ContractRenewalActions";
import {
  formatINRCompact,
} from "../../../lib/metrics";
import {
  apiFetch,
  getCurrentUser,
} from "../../../lib/api";

type RenewalRow = {
  id: number;
  contractNumber: string;
  title: string;
  vendor: { id: number; name: string };
  value: number;
  endDate: string;
  autoRenew: boolean;
  status: string;
  risk: {
    level: string;
    daysRemaining: number;
  };
};

async function getRenewalQueue(): Promise<
  RenewalRow[]
> {
  const res = await apiFetch("/contracts/renewals");
  if (!res.ok) return [];
  const data = await res.json();
  return data.queue ?? [];
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

function riskTone(level: string) {
  switch (level) {
    case "CRITICAL":
      return "text-red-700 bg-red-50 border-red-200";
    case "HIGH":
      return "text-orange-700 bg-orange-50 border-orange-200";
    case "MEDIUM":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "LOW":
      return "text-yellow-700 bg-yellow-50 border-yellow-200";
    default:
      return "text-gray-700 bg-gray-50 border-gray-200";
  }
}

export default async function ContractRenewalsPage() {
  const [queue, user] = await Promise.all([
    getRenewalQueue(),
    getCurrentUser(),
  ]);

  return (
    <PageContainer rhythm>
      <PageHeader
        title="Renewal Queue"
        description="Contracts requiring governance action"
        backHref="/contracts"
        actions={
          <Link href="/control-tower">
            <Button variant="secondary">Control Tower</Button>
          </Link>
        }
      />

      {queue.length === 0 ? (
        <EmptyState
          title="No contracts at risk"
          description="All active contracts are beyond the 90-day renewal window."
        />
      ) : (
        <DataTable>
          <THead>
            <TR>
              <TH>Vendor</TH>
              <TH>Contract</TH>
              <TH>Days Left</TH>
              <TH>Risk</TH>
              <TH>Status</TH>
              <TH>Action</TH>
            </TR>
          </THead>
          <TBody>
            {queue.map((row: RenewalRow, index) => (
              <TR key={row.id} hover zebra index={index}>
                <TD>
                  <Link
                    href={`/vendors/${row.vendor.id}`}
                    className="font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    {row.vendor.name}
                  </Link>
                </TD>
                <TD>
                  <Link
                    href={`/contracts/${row.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {row.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {row.contractNumber} · {formatINRCompact(row.value)} ·
                    expires {formatDate(row.endDate)}
                    {row.autoRenew ? " · auto-renew" : ""}
                  </p>
                </TD>
                <TD className="font-semibold">
                  {row.risk.daysRemaining <= 0
                    ? "Expired"
                    : `${row.risk.daysRemaining}d`}
                </TD>
                <TD>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${riskTone(row.risk.level)}`}
                  >
                    {row.risk.level}
                  </span>
                </TD>
                <TD>
                  <StatusBadge status={row.status} />
                </TD>
                <TD>
                  <ContractRenewalActions
                    contractId={row.id}
                    user={user}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      )}
    </PageContainer>
  );
}

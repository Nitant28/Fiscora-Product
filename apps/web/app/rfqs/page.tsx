/**
 * RFQs List
 * Purpose: Sourcing events list with status and savings indicators.
 * Data: GET /rfqs (apiFetch).
 * Roles: rfq.view.
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
import { apiFetch } from "../../lib/api";
import { formatINR, formatText } from "../../lib/metrics";

type RFQListItem = {
  id: number;
  title: string;
  status: string;
  createdAt: string;
  category: { name: string };
  awardedVendor: { id: number; name: string } | null;
  savings: {
    savings: number;
  } | null;
  purchaseOrder: {
    id: number;
    poNumber: string;
  } | null;
};

async function getRFQs(): Promise<RFQListItem[]> {
  const res = await apiFetch("/rfqs");

  if (!res.ok) return [];

  const data = await res.json();
  return data.rfqs ?? [];
}

export default async function RFQsPage() {
  const rfqs = await getRFQs();

  return (
    <PageContainer rhythm>
      <PageHeader
        title="RFQs"
        description="Vendor competition, ranking, and sourcing savings"
        actions={
          <Link href="/rfqs/new">
            <Button variant="primary">Create RFQ</Button>
          </Link>
        }
      />

      {rfqs.length === 0 ? (
        <EmptyState
          title="No RFQs yet"
          description="Create a sourcing event to compare vendor quotes and capture savings."
          action={
            <Link href="/rfqs/new">
              <Button variant="outline">Create your first RFQ</Button>
            </Link>
          }
        />
      ) : (
        <DataTable>
          <THead>
            <TR>
              <TH>RFQ</TH>
              <TH>Category</TH>
              <TH>Status</TH>
              <TH>Winner</TH>
              <TH numeric>Savings</TH>
              <TH>PO</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <TBody>
            {rfqs.map((rfq, index) => (
              <TR key={rfq.id} hover zebra index={index}>
                <TD>
                  <Link
                    href={`/rfqs/${rfq.id}`}
                    className="font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    {formatText(rfq.title)}
                  </Link>
                  <p className="text-xs text-muted">RFQ #{rfq.id}</p>
                </TD>
                <TD>{rfq.category?.name ?? "—"}</TD>
                <TD>
                  <StatusBadge status={rfq.status} />
                </TD>
                <TD>{rfq.awardedVendor?.name ?? "—"}</TD>
                <TD numeric className="financial-figure">
                  {rfq.savings?.savings != null ? (
                    <span className="font-semibold text-success-fg">
                      {formatINR(rfq.savings.savings)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TD>
                <TD>
                  {rfq.purchaseOrder ? (
                    <Link
                      href={`/purchase-orders/${rfq.purchaseOrder.id}`}
                      className="font-semibold text-primary hover:text-primary-hover hover:underline"
                    >
                      {rfq.purchaseOrder.poNumber}
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TD>
                <TD className="text-xs text-muted">
                  {new Date(rfq.createdAt).toLocaleDateString()}
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      )}
    </PageContainer>
  );
}

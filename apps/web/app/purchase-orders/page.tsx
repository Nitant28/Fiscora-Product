/**
 * Purchase Orders List
 * Purpose: PO registry with status, vendor, and amount for procurement tracking.
 * Data: GET /purchase-orders (apiFetch).
 * Roles: po.view.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
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
import { formatMoney } from "../../lib/metrics";

type PurchaseOrder = {
  id: number;
  poNumber: string;
  vendorName: string;
  amount: number;
  status: string;
  createdAt: string;
};

async function getPurchaseOrders(): Promise<
  PurchaseOrder[]
> {
  const res = await apiFetch("/purchase-orders");
  if (!res.ok) return [];
  const data = await res.json();
  return data.purchaseOrders ?? [];
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

export default async function PurchaseOrdersPage() {
  const orders = await getPurchaseOrders();

  return (
    <PageContainer rhythm>
      <PageHeader
        title="Purchase Orders"
        description="POs generated from approved requests"
      />

      {orders.length === 0 ? (
        <EmptyState
          title="No purchase orders yet"
          description="Purchase orders appear here once requests are approved and converted."
        />
      ) : (
        <DataTable>
          <THead>
            <TR>
              <TH>PO Number</TH>
              <TH>Vendor</TH>
              <TH numeric>Amount</TH>
              <TH>Status</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <TBody>
            {orders.map((po, index) => (
              <TR key={po.id} hover zebra index={index}>
                <TD>
                  <Link
                    href={`/purchase-orders/${po.id}`}
                    className="font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    {po.poNumber}
                  </Link>
                </TD>
                <TD className="font-medium">{po.vendorName}</TD>
                <TD numeric className="font-semibold financial-figure">
                  {formatMoney(po.amount)}
                </TD>
                <TD>
                  <StatusBadge status={po.status} />
                </TD>
                <TD className="text-xs text-muted">
                  {formatDate(po.createdAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      )}
    </PageContainer>
  );
}

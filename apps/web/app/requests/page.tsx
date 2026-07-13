/**
 * Purchase Requests List
 * Purpose: Department spend requests with pending-approval panel for managers.
 * Data: GET /purchase-requests, GET /approvals (apiFetch).
 * Roles: request.view; managers see approval queue.
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
import PendingRequestsPanel from "../../components/PendingRequestsPanel";
import { apiFetch } from "../../lib/api";
import { formatMoney } from "../../lib/metrics";

type PurchaseRequest = {
  id: number;
  title: string;
  vendorName: string | null;
  requester: string;
  estimatedAmount: number;
  status: string;
  createdAt: string;
  department?: { name: string } | null;
};

async function getRequests(): Promise<
  PurchaseRequest[]
> {
  const res = await apiFetch("/purchase-requests");
  if (!res.ok) return [];
  const data = await res.json();
  return data.requests ?? [];
}

async function getMyPendingApprovals(): Promise<
  PurchaseRequest[]
> {
  const res = await apiFetch("/approvals");
  if (!res.ok) return [];
  const data = await res.json();
  return data.requests ?? [];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

export default async function RequestsPage() {
  const [requests, pending] = await Promise.all([
    getRequests(),
    getMyPendingApprovals(),
  ]);

  return (
    <PageContainer rhythm>
      <PageHeader
        title="Purchase Requests"
        description="Request queue for manager approval"
        actions={
          <Link href="/requests/new">
            <Button variant="primary">New Request</Button>
          </Link>
        }
      />

      <PendingRequestsPanel requests={pending} />

      {requests.length === 0 ? (
        <EmptyState
          title="No purchase requests yet"
          description="New requests will appear here for review and approval."
          action={
            <Link href="/requests/new">
              <Button variant="outline">Create a request</Button>
            </Link>
          }
        />
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            All Requests
          </h2>
          <DataTable>
            <THead>
              <TR>
                <TH>ID</TH>
                <TH>Title</TH>
                <TH>Department</TH>
                <TH numeric>Amount</TH>
                <TH>Requester</TH>
                <TH>Status</TH>
                <TH>Created</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((req, index) => (
                <TR key={req.id} hover zebra index={index}>
                  <TD>
                    <Link
                      href={`/requests/${req.id}`}
                      className="font-semibold text-primary hover:text-primary-hover hover:underline"
                    >
                      #{req.id}
                    </Link>
                  </TD>
                  <TD className="font-medium">{req.title}</TD>
                  <TD>{req.department?.name ?? "—"}</TD>
                  <TD numeric className="font-semibold financial-figure">
                    {formatMoney(req.estimatedAmount)}
                  </TD>
                  <TD>{req.requester}</TD>
                  <TD>
                    <StatusBadge status={req.status} />
                  </TD>
                  <TD className="text-xs text-muted">
                    {formatDate(req.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </DataTable>
        </div>
      )}
    </PageContainer>
  );
}

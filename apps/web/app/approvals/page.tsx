/**
 * Approvals Inbox
 * Purpose: Unified queue of purchase requests awaiting the current user's approval.
 * Data: GET /approvals (apiFetch).
 * Roles: request.approve and approval.view.
 */
import { apiFetch, getCurrentUser } from "../../lib/api";
import ApprovalInboxActions from "../../components/ApprovalInboxActions";
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { formatMoney } from "../../lib/metrics";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  const res = await apiFetch("/approvals");

  if (!res.ok) {
    return (
      <PageContainer>
        <div className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          Unable to load approvals. Please try again.
        </div>
      </PageContainer>
    );
  }

  const data = await res.json();
  const requests = data?.requests ?? [];
  const invoices = data?.invoices ?? [];

  return (
    <PageContainer width="narrow" rhythm>
      <PageHeader
        title="My Approvals"
        description={`Signed in as ${user?.name} (${user?.role})`}
      />

      <section>
        <h2 className="mb-4 text-md font-semibold text-foreground">
          Purchase Requests
        </h2>
        <ApprovalInboxActions
          requests={requests}
          user={user}
          approver={user?.name ?? "User"}
        />
        {requests.length === 0 && (
          <p className="text-sm text-muted">
            No requests awaiting your approval
          </p>
        )}
      </section>

      {invoices.length > 0 && (
        <section>
          <h2 className="mb-4 text-md font-semibold text-foreground">
            Invoices Waiting Approval
          </h2>
          <div className="space-y-3">
            {invoices.map(
              (inv: {
                id: number;
                invoiceNumber: string | null;
                vendorName: string | null;
                totalAmount: number | null;
              }) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover"
                >
                  <p className="font-medium text-foreground">
                    Invoice #{inv.invoiceNumber ?? inv.id}
                  </p>
                  <p className="text-sm text-foreground-subtle">
                    {inv.vendorName ?? "—"} · {formatMoney(inv.totalAmount)}
                  </p>
                </Link>
              )
            )}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

/**
 * Purchase Order Detail
 * Purpose: PO lifecycle — send, receive goods, close; linked request/RFQ context.
 * Data: GET /purchase-orders/:id (apiFetch).
 * Roles: po.view; po.send, po.receive, po.manage for actions.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";
import POActions from "../../../components/POActions";
import ReceiveGoodsForm from "../../../components/ReceiveGoodsForm";
import { apiFetch, getCurrentUser } from "../../../lib/api";
import {
  formatINRCompact,
} from "../../../lib/metrics";

async function getPO(id: string) {
  const res = await apiFetch(
    `/purchase-orders/${id}`
  );
  if (!res.ok) {
    throw new Error(
      "Failed to fetch purchase order"
    );
  }
  return res.json();
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const LIFECYCLE_STEPS = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
] as const;

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, user] = await Promise.all([
    getPO(id),
    getCurrentUser(),
  ]);
  const po = data.purchaseOrder;

  const totalReceived = (
    po.goodsReceipts ?? []
  ).reduce(
    (
      sum: number,
      r: { quantityReceived: number }
    ) => sum + r.quantityReceived,
    0
  );

  const currentStepIndex =
    LIFECYCLE_STEPS.indexOf(
      po.status as (typeof LIFECYCLE_STEPS)[number]
    );

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={po.poNumber}
        description="Purchase Order"
        backHref="/purchase-orders"
        badge={<StatusBadge status={po.status} />}
      />

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Lifecycle
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {LIFECYCLE_STEPS.map((step, i) => {
            const done =
              currentStepIndex >= i &&
              currentStepIndex !== -1;
            const active =
              po.status === step;

            return (
              <div
                key={step}
                className="flex items-center gap-2"
              >
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    active
                      ? "bg-blue-600 text-white"
                      : done
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {step.replace(/_/g, " ")}
                </span>
                {i <
                  LIFECYCLE_STEPS.length -
                    1 && (
                  <span className="text-gray-300">
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <Field label="Vendor" value={po.vendorName} />
        <Field
          label="Amount"
          value={formatINRCompact(po.amount)}
        />
        {po.leadTimeDays != null && (
          <Field
            label="Lead Time"
            value={`${po.leadTimeDays} days`}
          />
        )}
        {po.warrantyMonths != null && (
          <Field
            label="Warranty"
            value={`${po.warrantyMonths} months`}
          />
        )}
        <Field
          label="Ordered Qty"
          value={
            po.orderedQuantity != null
              ? String(po.orderedQuantity)
              : "—"
          }
        />
        <Field
          label="Received Qty"
          value={String(totalReceived)}
        />
        {po.requestId ? (
          <Field
            label="From Request"
            value={
              <Link
                href={`/requests/${po.requestId}`}
                className="text-blue-600 hover:underline"
              >
                #{po.requestId}
                {po.request?.title
                  ? ` — ${po.request.title}`
                  : ""}
              </Link>
            }
          />
        ) : po.rfq ? (
          <Field
            label="From RFQ"
            value={
              <Link
                href={`/rfqs/${po.rfq.id}`}
                className="text-blue-600 hover:underline"
              >
                {po.rfq.title}
              </Link>
            }
          />
        ) : null}
        <Field
          label="Created"
          value={formatDate(po.createdAt)}
        />
        <Field
          label="Sent"
          value={formatDate(po.sentAt)}
        />
        <Field
          label="Accepted"
          value={formatDate(po.acceptedAt)}
        />
        <Field
          label="Received"
          value={formatDate(po.receivedAt)}
        />
        <Field
          label="Closed"
          value={formatDate(po.closedAt)}
        />
      </div>

      {(po.goodsReceipts?.length ?? 0) >
        0 && (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Receipt History
          </h2>
          <ul className="space-y-2 text-sm">
            {po.goodsReceipts.map(
              (r: {
                id: number;
                quantityReceived: number;
                receivedDate: string;
                receiver: { name: string };
                notes: string | null;
              }) => (
                <li
                  key={r.id}
                  className="rounded-lg border px-4 py-3"
                >
                  <span className="font-medium">
                    {r.quantityReceived}{" "}
                    units
                  </span>
                  <span className="text-gray-500">
                    {" "}
                    · {r.receiver.name} ·{" "}
                    {new Date(
                      r.receivedDate
                    ).toLocaleString()}
                  </span>
                  {r.notes && (
                    <p className="mt-1 text-gray-600">
                      {r.notes}
                    </p>
                  )}
                </li>
              )
            )}
          </ul>
        </section>
      )}

      <div className="mt-8">
        <ReceiveGoodsForm
          poId={po.id}
          orderedQuantity={
            po.orderedQuantity
          }
          totalReceived={totalReceived}
          disabled={
            !["ACCEPTED", "PARTIALLY_RECEIVED"].includes(
              po.status
            )
          }
        />
      </div>

      <div className="mt-8">
        <POActions
          poId={po.id}
          status={po.status}
          user={user}
        />
      </div>
    </PageContainer>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

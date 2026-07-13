/**
 * Payment Detail
 * Purpose: Single payment lifecycle — approve, schedule, process, complete.
 * Data: GET /payments/:id, GET /documents/:invoiceId (apiFetch).
 * Roles: payment.view; payment.approve / payment.process for actions.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";
import PaymentActions from "../../../components/PaymentActions";
import {
  formatINR,
  formatText,
} from "../../../lib/metrics";
import { apiFetch, getCurrentUser } from "../../../lib/api";

type PaymentDetail = {
  id: number;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  createdAt: string;
  vendor: {
    id: number;
    name: string;
    paymentTermsDays: number | null;
    paymentTerms: string | null;
  };
  document: {
    id: number;
    invoiceNumber: string | null;
    vendorName: string | null;
    invoiceDate: string | null;
    totalAmount: number | null;
    status: string;
    purchaseOrderId: number | null;
  };
};

type AuditLog = {
  id: number;
  action: string;
  actor: string;
  createdAt: string;
  entityType: string;
  entityId: number;
};

async function getPayment(
  id: string
): Promise<PaymentDetail | null> {
  const res = await apiFetch(
    `/payments/${id}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.payment ?? null;
}

async function getPaymentAuditLogs(
  paymentId: number
): Promise<AuditLog[]> {
  const res = await apiFetch(
    "/audit-logs?limit=200"
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.logs ?? []).filter(
    (log: AuditLog) =>
      log.entityType === "Payment" &&
      log.entityId === paymentId
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [payment, user] = await Promise.all([
    getPayment(id),
    getCurrentUser(),
  ]);

  if (!payment) {
    notFound();
  }

  const auditLogs =
    await getPaymentAuditLogs(payment.id);

  const termsLabel =
    payment.vendor.paymentTermsDays != null
      ? `Net ${payment.vendor.paymentTermsDays}`
      : payment.vendor.paymentTerms ??
        "Net 30 (default)";

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={`Payment #${payment.id}`}
        description={`${formatText(payment.vendor.name)} · ${formatText(
          payment.document.invoiceNumber ?? `INV-${payment.document.id}`
        )}`}
        backHref="/payments"
        badge={<StatusBadge status={payment.status} />}
      />

      {Boolean(
        (payment.vendor as { msmeRegistered?: boolean })
          .msmeRegistered
      ) &&
        payment.vendor.paymentTermsDays !=
          null &&
        payment.vendor.paymentTermsDays >
          45 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            MSME vendor — due date capped at
            45 days from invoice approval per
            MSME payment rules.
          </div>
        )}

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <InfoCard
          label="Amount"
          value={formatINR(payment.amount)}
        />
        <InfoCard
          label="Due Date"
          value={formatDate(payment.dueDate)}
        />
        <InfoCard
          label="Payment Terms"
          value={termsLabel}
        />
        <InfoCard
          label="Paid Date"
          value={formatDate(payment.paidDate)}
        />
      </div>

      <section className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          Linked Records
        </h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-gray-500">
              Invoice
            </dt>
            <dd>
              <Link
                href={`/invoices/${payment.document.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {formatText(
                  payment.document
                    .invoiceNumber ??
                    `INV-${payment.document.id}`
                )}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">
              Vendor
            </dt>
            <dd>
              <Link
                href={`/vendors/${payment.vendor.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {payment.vendor.name}
              </Link>
            </dd>
          </div>
          {payment.document
            .purchaseOrderId != null && (
            <div>
              <dt className="text-gray-500">
                Purchase Order
              </dt>
              <dd>
                <Link
                  href={`/purchase-orders/${payment.document.purchaseOrderId}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  PO #
                  {
                    payment.document
                      .purchaseOrderId
                  }
                </Link>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">
              Invoice Status
            </dt>
            <dd>
              <StatusBadge
                status={
                  payment.document?.status
                }
              />
            </dd>
          </div>
        </dl>
      </section>

      <div className="mb-8">
        <PaymentActions
          paymentId={payment.id}
          status={payment.status}
          user={user}
        />
      </div>

      {auditLogs.length > 0 && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Audit History
          </h2>
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between border-b pb-3 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {log.action.replace(
                      /_/g,
                      " "
                    )}
                  </p>
                  <p className="text-gray-500">
                    {log.actor}
                  </p>
                </div>
                <p className="text-gray-400">
                  {formatDate(log.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

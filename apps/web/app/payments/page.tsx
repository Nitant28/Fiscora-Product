/**
 * Payments List
 * Purpose: Payment pipeline overview with terms and status across vendors.
 * Data: GET /payments, GET /vendors (apiFetch).
 * Roles: payment.view.
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
import {
  formatINR,
  formatText,
} from "../../lib/metrics";
import { formatPaymentTermsLabel } from "../../lib/paymentTerms";
import { apiFetch } from "../../lib/api";

type Payment = {
  id: number;
  amount: number;
  dueDate: string;
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
    status: string;
  };
};

type CashForecast = {
  next7Days: number;
  next30Days: number;
  next90Days: number;
};

async function getPayments(): Promise<Payment[]> {
  const res = await apiFetch("/payments");
  if (!res.ok) return [];
  const data = await res.json();
  return data.payments ?? [];
}

async function getCashForecast(): Promise<CashForecast | null> {
  const res = await apiFetch(
    "/payments/cash-flow"
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.forecast ?? null;
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

export default async function PaymentsPage() {
  const [payments, forecast] =
    await Promise.all([
      getPayments(),
      getCashForecast(),
    ]);

  return (
    <PageContainer rhythm>
      <PageHeader
        title="Payments"
        description="Accounts payable — schedule, process, and track vendor payments"
      />

      {forecast && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ForecastCard label="Due in 7 Days" amount={forecast.next7Days} />
          <ForecastCard label="Due in 30 Days" amount={forecast.next30Days} />
          <ForecastCard label="Due in 90 Days" amount={forecast.next90Days} />
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState
          title="No payments scheduled yet"
          description="Payments are created when a three-way match is MATCHED and the invoice is approved."
        />
      ) : (
        <DataTable>
          <THead>
            <TR>
              <TH>Vendor</TH>
              <TH>Invoice</TH>
              <TH numeric>Amount</TH>
              <TH>Due Date</TH>
              <TH>Terms</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {payments.map((payment, index) => (
              <TR key={payment.id} hover zebra index={index}>
                <TD>
                  <Link
                    href={`/payments/${payment.id}`}
                    className="font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    {formatText(payment.vendor.name)}
                  </Link>
                </TD>
                <TD>
                  <Link
                    href={`/invoices/${payment.document.id}`}
                    className="text-primary hover:text-primary-hover hover:underline"
                  >
                    {formatText(
                      payment.document.invoiceNumber ??
                        `INV-${payment.document.id}`
                    )}
                  </Link>
                </TD>
                <TD numeric className="font-semibold financial-figure">
                  {formatINR(payment.amount)}
                </TD>
                <TD>{formatDate(payment.dueDate)}</TD>
                <TD>
                  {payment.vendor.paymentTermsDays != null
                    ? formatPaymentTermsLabel(payment.vendor.paymentTermsDays)
                    : (payment.vendor.paymentTerms ?? "Net 30")}
                </TD>
                <TD>
                  <StatusBadge status={payment.status} />
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      )}
    </PageContainer>
  );
}

function ForecastCard({
  label,
  amount,
}: {
  label: string;
  amount: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <p className="kpi-label">{label}</p>
      <p className="mt-2 text-2xl font-bold financial-figure text-foreground">
        {formatINR(amount)}
      </p>
    </div>
  );
}

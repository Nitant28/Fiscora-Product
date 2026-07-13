/**
 * Invoice Detail
 * Purpose: Review extracted invoice fields, fraud alerts, corrections, and approval actions.
 * Data: GET /documents/:id (apiFetch).
 * Roles: invoice.view; invoice.approve for actions.
 */
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";
import DuplicateInvoiceAlert from "../../../components/DuplicateInvoiceAlert";
import InvoiceActions from "../../../components/InvoiceActions";
import StatCard from "../../../components/StatCard";
import type {
  ApprovalStatus,
  PoMatchResult,
} from "../../../lib/analytics-types";
import { apiFetch } from "../../../lib/api";
import {
  formatMoney,
  hasMoney,
  NO_DATA,
} from "../../../lib/metrics";
import { formatDueDate } from "../../../lib/paymentTerms";

async function getInvoice(id: string) {
  const res = await apiFetch(
    `/documents/${id}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch invoice");
  }
  return res.json();
}

const PO_MATCH_STYLES = {
  PASS: "border-green-200 bg-green-50 text-green-800",
  REVIEW: "border-amber-200 bg-amber-50 text-amber-900",
  HIGH_RISK: "border-red-200 bg-red-50 text-red-800",
} as const;

function poMatchLabel(poMatch: PoMatchResult | null): string {
  if (!poMatch?.matched || !poMatch.poMatch) {
    return "No PO";
  }

  return poMatch.poMatch.riskLevel.replace("_", " ");
}

function poMatchStyle(poMatch: PoMatchResult | null): string {
  if (!poMatch?.matched || !poMatch.poMatch) {
    return "bg-white";
  }

  return PO_MATCH_STYLES[poMatch.poMatch.riskLevel];
}

function matchDisplayStatus(
  status: string
): "PENDING" | "MATCHED" | "MISMATCH" {
  if (status === "MATCHED") return "MATCHED";
  if (status === "PENDING") return "PENDING";
  return "MISMATCH";
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getInvoice(id);

  const invoice = data.document;
  const businessFlags = data.businessFlags ?? [];
  const poMatch: PoMatchResult | null =
    data.poMatch ?? null;
  const approvalStatus: ApprovalStatus | null =
    data.approvalStatus ?? null;
  const threeWayMatch =
    data.threeWayMatch ?? null;
  const paymentPreview =
    data.paymentPreview ?? null;
  const duplicateMatch =
    data.duplicateMatch ?? null;
  const paymentBlocked =
    data.paymentBlocked ?? false;
  const matchConfidence =
    invoice.poMatchConfidence ??
    poMatch?.poMatch?.matchConfidence ??
    null;

  const filename =
    invoice.fileUrl || invoice.fileName;
  const pdfUrl = filename
    ? `http://localhost:4000/files/${filename}`
    : undefined;

  const financial = {
    subtotal:
      invoice.subtotal ??
      invoice.extractedData?.subtotal ??
      null,
    shipping:
      invoice.shipping ??
      invoice.extractedData?.shipping ??
      null,
    tax:
      invoice.tax ??
      invoice.extractedData?.tax ??
      null,
    discount:
      invoice.discount ??
      invoice.extractedData?.discount ??
      null,
    balanceDue:
      invoice.balanceDue ??
      invoice.extractedData?.balanceDue ??
      null,
  };

  return (
    <PageContainer>
      <PageHeader
        title={`Invoice #${invoice.invoiceNumber ?? invoice.id}`}
        description={invoice.vendorName ?? undefined}
        backHref="/invoices"
        badge={<StatusBadge status={invoice.status} />}
      />

      {duplicateMatch && (
        <DuplicateInvoiceAlert
          duplicateMatch={duplicateMatch}
        />
      )}

      <div
        className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-4"
        style={{
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
        }}
      >
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">
            Invoice Amount
          </p>
          <p className="mt-1 text-xl font-semibold">
            {hasMoney(invoice.totalAmount)
              ? formatMoney(
                  invoice.totalAmount
                )
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">
            Vendor
          </p>
          <p className="mt-1 text-xl font-semibold">
            {invoice.vendorName ?? "—"}
          </p>
        </div>
        <div
          className={`rounded-xl border p-4 ${poMatchStyle(poMatch)}`}
        >
          <p className="text-sm opacity-80">
            PO Match
          </p>
          <p className="mt-1 text-xl font-bold">
            {poMatchLabel(poMatch)}
          </p>
          {poMatch?.matched &&
            poMatch.poMatch && (
              <>
                {matchConfidence != null && (
                  <p className="mt-1 text-xs font-medium opacity-90">
                    {Math.round(matchConfidence)}%
                    · Matched{" "}
                    {poMatch.poMatch.poNumber}
                  </p>
                )}
                <p className="mt-1 text-xs opacity-80">
                  PO{" "}
                  {formatMoney(
                    poMatch.poMatch.poAmount
                  )}{" "}
                  vs{" "}
                  {formatMoney(
                    poMatch.poMatch.invoiceAmount
                  )}
                </p>
              </>
            )}
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-500">
            Approval Status
          </p>
          <p className="mt-1 text-xl font-semibold">
            {approvalStatus?.label ?? "—"}
          </p>
          {approvalStatus?.detail && (
            <p className="mt-1 text-xs text-gray-500">
              {approvalStatus.detail}
            </p>
          )}
        </div>
        {paymentPreview && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              Payment Terms
            </p>
            <p className="mt-1 text-xl font-semibold text-blue-950">
              {paymentPreview.termsLabel}
            </p>
            <p className="mt-1 text-sm text-blue-900">
              Due:{" "}
              {formatDueDate(
                paymentPreview.dueDate
              )}
            </p>
            {paymentPreview.msmeCapped && (
              <p className="mt-2 text-xs font-medium text-amber-800">
                MSME 45-day cap applied
              </p>
            )}
          </div>
        )}
      </div>

      {threeWayMatch && (
        <div
          className={`mt-4 rounded-xl border p-4 ${
            matchDisplayStatus(
              threeWayMatch.status
            ) === "MATCHED"
              ? "border-green-300 bg-green-50 text-green-900"
              : matchDisplayStatus(
                    threeWayMatch.status
                  ) === "MISMATCH"
                ? "border-red-300 bg-red-50 text-red-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <p className="text-lg font-bold">
            Three-Way Match:{" "}
            {matchDisplayStatus(
              threeWayMatch.status
            )}
          </p>
          {matchDisplayStatus(
            threeWayMatch.status
          ) === "MISMATCH" && (
            <p className="mt-2 text-sm font-medium text-red-800">
              Payment blocked until mismatch is
              resolved.
            </p>
          )}
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
            <p>
              PO Qty:{" "}
              {threeWayMatch.poQuantity ??
                "—"}{" "}
              · Received:{" "}
              {threeWayMatch.receivedQuantity ??
                "—"}{" "}
              · Invoiced:{" "}
              {threeWayMatch.invoicedQuantity ??
                "—"}
            </p>
            <p>
              PO Amount:{" "}
              {threeWayMatch.poAmount != null
                ? formatMoney(
                    threeWayMatch.poAmount
                  )
                : "—"}
            </p>
            <p>
              Invoice Amount:{" "}
              {threeWayMatch.invoiceAmount !=
              null
                ? formatMoney(
                    threeWayMatch.invoiceAmount
                  )
                : "—"}
            </p>
          </div>
          {threeWayMatch.variance != null && (
            <p className="mt-2 text-xs">
              Amount variance:{" "}
              {formatMoney(
                threeWayMatch.variance
              )}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Original Invoice
            </h2>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                Open PDF
              </a>
            )}
          </div>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="h-[900px] w-full rounded-xl border"
            />
          ) : (
            <p className="text-gray-400">
              {NO_DATA}
            </p>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">
            Business Risks
          </h3>
          {businessFlags.length === 0 ? (
            <p className="text-green-700">
              No business risks detected
            </p>
          ) : (
            businessFlags.map(
              (flag: {
                id: number;
                type: string;
                message: string;
                severity: string;
              }) => (
                <div
                  key={flag.id}
                  className="mb-3 rounded-lg border p-4"
                >
                  <p className="font-medium">
                    {flag.type.replace(
                      /_/g,
                      " "
                    )}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {flag.message}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {flag.severity}
                  </p>
                </div>
              )
            )
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">
          Financial Breakdown
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard
            label="Subtotal"
            value={financial.subtotal}
            format="money"
          />
          <StatCard
            label="Shipping"
            value={financial.shipping}
            format="money"
          />
          <StatCard
            label="Tax"
            value={financial.tax}
            format="money"
          />
          <StatCard
            label="Discount"
            value={financial.discount}
            format="money"
          />
          <StatCard
            label="Balance Due"
            value={financial.balanceDue}
            format="money"
            variant="highlight"
          />
        </div>
      </div>

      <div className="mt-8">
        <InvoiceActions
          invoiceId={invoice.id}
          paymentBlocked={paymentBlocked}
          status={invoice.status}
        />
      </div>
    </PageContainer>
  );
}

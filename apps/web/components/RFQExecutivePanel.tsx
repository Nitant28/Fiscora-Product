import Link from "next/link";
import StatusBadge from "./StatusBadge";
/**
 * RFQExecutivePanel
 * Purpose: Executive savings summary and recommendation highlights on RFQ detail.
 * Data: Props from RFQ detail and recommendation API.
 * Roles: rfq.view, control.view.
 */
import { formatINR } from "../lib/metrics";

export default function RFQExecutivePanel({
  status,
  awardedVendorName,
  savingsAmount,
  purchaseOrder,
}: {
  status: string;
  awardedVendorName?: string | null;
  savingsAmount?: number | null;
  purchaseOrder?: {
    id: number;
    poNumber: string;
    status: string;
  } | null;
}) {
  return (
    <section className="mb-8 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 shadow-sm">
      <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Executive Summary
      </h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem label="RFQ Status">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {purchaseOrder && (
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
                PO GENERATED
              </span>
            )}
          </div>
        </SummaryItem>

        <SummaryItem label="Awarded Vendor">
          <p className="text-xl font-bold text-slate-900">
            {awardedVendorName ?? "—"}
          </p>
        </SummaryItem>

        <SummaryItem label="Purchase Order">
          {purchaseOrder ? (
            <div>
              <Link
                href={`/purchase-orders/${purchaseOrder.id}`}
                className="text-xl font-bold text-indigo-600 hover:underline"
              >
                {purchaseOrder.poNumber}
              </Link>
              <p className="mt-1 text-sm text-slate-500">
                Status: {purchaseOrder.status}
              </p>
            </div>
          ) : (
            <p className="text-xl font-bold text-slate-400">
              Not yet generated
            </p>
          )}
        </SummaryItem>

        <SummaryItem label="Savings">
          {savingsAmount != null &&
          savingsAmount > 0 ? (
            <p className="text-3xl font-bold text-green-700">
              {formatINR(savingsAmount)}
            </p>
          ) : (
            <p className="text-xl font-bold text-slate-400">
              —
            </p>
          )}
        </SummaryItem>
      </div>
    </section>
  );
}

function SummaryItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

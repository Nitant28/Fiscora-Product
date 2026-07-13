/**
 * DuplicateInvoiceAlert
 * Purpose: Warn when invoice matches a prior submission (fraud detection).
 * Data: Props from GET /documents/:id fraud flags.
 * Roles: invoice.view, invoice.approve.
 */
import Link from "next/link";
import { formatINR } from "../lib/metrics";

type DuplicateMatch = {
  id: number;
  invoiceNumber: string | null;
  vendorName: string | null;
  totalAmount: number | null;
  uploadedAt: string;
  daysAgo: number | null;
};

export default function DuplicateInvoiceAlert({
  duplicateMatch,
}: {
  duplicateMatch: DuplicateMatch;
}) {
  const uploadedLabel =
    duplicateMatch.daysAgo == null
      ? new Date(
          duplicateMatch.uploadedAt
        ).toLocaleDateString()
      : duplicateMatch.daysAgo === 0
        ? "Today"
        : duplicateMatch.daysAgo === 1
          ? "1 day ago"
          : `${duplicateMatch.daysAgo} days ago`;

  return (
    <div className="mt-8 rounded-2xl border-2 border-red-300 bg-red-50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠</span>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-red-900">
            Potential Duplicate Invoice
          </h2>
          <p className="mt-1 text-sm text-red-800">
            This invoice matches an existing
            record on vendor, invoice number,
            and amount. Payment is blocked.
          </p>

          <div className="mt-4 grid gap-3 rounded-xl border border-red-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Existing Invoice
              </p>
              <Link
                href={`/invoices/${duplicateMatch.id}`}
                className="font-semibold text-blue-700 hover:underline"
              >
                {duplicateMatch.invoiceNumber ??
                  `INV-${duplicateMatch.id}`}
              </Link>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Vendor
              </p>
              <p className="font-semibold">
                {duplicateMatch.vendorName ??
                  "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Amount
              </p>
              <p className="font-semibold">
                {duplicateMatch.totalAmount !=
                null
                  ? formatINR(
                      duplicateMatch.totalAmount
                    )
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Uploaded
              </p>
              <p className="font-semibold">
                {uploadedLabel}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

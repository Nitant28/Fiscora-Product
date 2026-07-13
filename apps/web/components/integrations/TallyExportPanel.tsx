"use client";

import { useMemo, useState } from "react";
import type {
  TallyExportFilters,
  TallyExportSummary,
} from "../../lib/tally-types";
import {
  DEFAULT_TALLY_FILTERS,
  tallyDownloadUrl,
} from "../../lib/tally-types";

type Props = {
  summary: TallyExportSummary;
};

const EXPORTS = [
  {
    type: "vendors" as const,
    title: "Export Vendors",
    description:
      "Verified vendor master — GSTIN, PAN, readiness score, compliance status",
    countKey: "vendors" as const,
    totalKey: "totalVendors" as const,
  },
  {
    type: "purchase-orders" as const,
    title: "Export Purchase Orders",
    description:
      "PO register with department, requester, approver, and vendor governance",
    countKey: "purchaseOrders" as const,
    totalKey: "totalPurchaseOrders" as const,
  },
  {
    type: "invoices" as const,
    title: "Export Invoices",
    description:
      "Invoice register with CGST, SGST, IGST breakdown for Tally vouchers",
    countKey: "invoices" as const,
    totalKey: "totalInvoices" as const,
  },
  {
    type: "payments" as const,
    title: "Export Payments",
    description:
      "Payment register with PAY-2026 IDs, bank reference, approval status",
    countKey: "payments" as const,
    totalKey: undefined,
  },
];

const FILTER_OPTIONS: {
  key: keyof TallyExportFilters;
  label: string;
}[] = [
  { key: "verifiedOnly", label: "Export only verified vendors" },
  { key: "excludeOcr", label: "Exclude OCR-generated vendors" },
  { key: "excludeDuplicates", label: "Exclude duplicate vendors" },
  { key: "excludeInvalidGst", label: "Exclude invalid GST" },
  { key: "excludeDraft", label: "Exclude draft vendors" },
];

export default function TallyExportPanel({ summary }: Props) {
  const [filters, setFilters] = useState<TallyExportFilters>(
    summary.filters ?? DEFAULT_TALLY_FILTERS
  );

  const downloadUrls = useMemo(
    () =>
      Object.fromEntries(
        EXPORTS.map((item) => [
          item.type,
          tallyDownloadUrl(item.type, filters),
        ])
      ) as Record<string, string>,
    [filters]
  );

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
        <h2 className="text-lg font-semibold text-teal-900">
          Governed export — CFO-ready data
        </h2>
        <p className="mt-2 text-sm text-teal-900">
          OCR junk, invalid GST, unverified vendors, and duplicate invoices
          are excluded by default. Only clean rows reach Tally.
        </p>
        <p className="mt-3 text-xs text-teal-700">{summary.note}</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Export filters</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FILTER_OPTIONS.map((option) => (
            <label
              key={option.key}
              className="flex items-center gap-3 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={filters[option.key]}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    [option.key]: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-teal-600"
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      {summary.readinessPreview &&
        summary.readinessPreview.length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">
              Tally readiness score
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4">Vendor</th>
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2 pr-4">Score</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.readinessPreview.map((row) => (
                    <tr
                      key={row.vendorCode}
                      className="border-b last:border-0"
                    >
                      <td className="py-2 pr-4 font-medium">
                        {row.vendorName}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {row.vendorCode}
                      </td>
                      <td className="py-2 pr-4">
                        {row.score}/100
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            row.status === "READY"
                              ? "bg-emerald-50 text-emerald-700"
                              : row.status === "REVIEW"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      <div className="grid gap-4 sm:grid-cols-2">
        {EXPORTS.map((item) => {
          const total = item.totalKey
            ? summary[item.totalKey]
            : undefined;
          const exportable = summary[item.countKey];

          return (
            <div
              key={item.type}
              className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-medium text-gray-500">
                {exportable} exportable
                {total != null ? ` of ${total} total` : ""}
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                {item.title}
              </h3>
              <p className="mt-2 flex-1 text-sm text-gray-600">
                {item.description}
              </p>
              <a
                href={downloadUrls[item.type]}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Download CSV
              </a>
            </div>
          );
        })}
      </div>

      {summary.exportHistory &&
        summary.exportHistory.length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Export history</h3>
            <div className="mt-4 space-y-3">
              {summary.exportHistory.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {row.actorName} exported {row.exportType}
                    </p>
                    <p className="text-gray-500">
                      {row.rowCount} rows
                      {row.excludedCount > 0
                        ? ` (${row.excludedCount} excluded)`
                        : ""}{" "}
                      · {row.filename}
                    </p>
                  </div>
                  <p className="text-gray-500">
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
    </div>
  );
}

"use client";

/**
 * DataQualityLayer
 * Purpose: Surface extraction confidence, field-level quality scores, and review hints on invoices.
 * Data: Props from invoice/document API payload (no direct fetch).
 * Roles: invoice.view.
 */

import { getQualityBand } from "../lib/data-quality";
import { formatScore } from "../lib/metrics";

type Props = {
  extractionConfidence: number;
  financialConfidence: number;
  lineItemConfidence: number;
  vendorConfidence: number;
  dataQualityScore: number;
};

function bandStyles(band: "GREEN" | "YELLOW" | "RED") {
  switch (band) {
    case "GREEN":
      return "border-green-200 bg-green-50 text-green-800";
    case "YELLOW":
      return "border-yellow-200 bg-yellow-50 text-yellow-800";
    case "RED":
      return "border-red-200 bg-red-50 text-red-800";
  }
}

function bandLabel(band: "GREEN" | "YELLOW" | "RED") {
  switch (band) {
    case "GREEN":
      return "Verified";
    case "YELLOW":
      return "Review recommended";
    case "RED":
      return "Needs correction";
  }
}

function MetricRow({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const band = getQualityBand(score);

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">
        {label}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${bandStyles(band)}`}
      >
        {formatScore(score)} ·{" "}
        {bandLabel(band)}
      </span>
    </div>
  );
}

export default function DataQualityLayer({
  extractionConfidence,
  financialConfidence,
  lineItemConfidence,
  vendorConfidence,
  dataQualityScore,
}: Props) {
  const overallBand =
    getQualityBand(dataQualityScore);

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-lg font-semibold">
        Data Quality
      </h3>
      <p className="mb-4 text-xs text-gray-400">
        Extraction errors are tracked
        here — not counted as business
        risk.
      </p>

      <div
        className={`mb-4 rounded-xl border p-4 ${bandStyles(overallBand)}`}
      >
        <p className="text-sm font-medium">
          Overall Data Quality:{" "}
          {formatScore(dataQualityScore)}
        </p>
        <p className="mt-1 text-xs opacity-80">
          GREEN 90–100 · YELLOW 75–89 ·
          RED below 75
        </p>
      </div>

      <div className="space-y-3">
        <MetricRow
          label="Extraction"
          score={extractionConfidence}
        />
        <MetricRow
          label="Financial fields"
          score={financialConfidence}
        />
        <MetricRow
          label="Line items"
          score={lineItemConfidence}
        />
        <MetricRow
          label="Vendor identity"
          score={vendorConfidence}
        />
      </div>
    </div>
  );
}
